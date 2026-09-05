import { createHmac, randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { authenticate, authorizeRoles } from '../src/auth/auth.middleware.js'
import { createApp } from '../src/app.js'
import { env, parseBooleanEnv } from '../src/config/env.js'
import { AppError } from '../src/shared/http.js'
import { RateLimitRepository } from '../src/security/rate-limit.repository.js'
import { RateLimitService } from '../src/security/rate-limit.service.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const createdUserIds: string[] = []

interface AuthFixture {
  adminEmail: string
  conductorEmail: string
  despachadorEmail: string
  inactiveEmail: string
  mecanicoEmail: string
  rateLimitedEmail: string
}

async function ensureRoles() {
  const [admin, despachador, mecanico, conductor] = await Promise.all([
    prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
      create: {
        codigo: 'ADMINISTRADOR',
        nombre: 'Administrador',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'DESPACHADOR' },
      update: {},
      create: {
        codigo: 'DESPACHADOR',
        nombre: 'Despachador',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'MECANICO' },
      update: { nombre: 'Mecánico' },
      create: {
        codigo: 'MECANICO',
        nombre: 'Mecánico',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'CONDUCTOR' },
      update: {},
      create: {
        codigo: 'CONDUCTOR',
        nombre: 'Conductor',
      },
    }),
  ])

  return { admin, conductor, despachador, mecanico }
}

async function createUser(email: string, role: Rol, estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO') {
  const id = randomUUID()
  createdUserIds.push(id)

  return prisma.usuario.create({
    data: {
      id,
      contrasenaHash: await hash(password, 10),
      email,
      estado,
      nombre: `Usuario ${email}`,
      rolId: role.id,
    },
  })
}

async function createFixture(): Promise<AuthFixture> {
  const roles = await ensureRoles()
  const suffix = randomUUID().slice(0, 8)
  const adminEmail = `auth-admin-${suffix}@test.sgmv.local`
  const despachadorEmail = `auth-despachador-${suffix}@test.sgmv.local`
  const mecanicoEmail = `auth-mecanico-${suffix}@test.sgmv.local`
  const conductorEmail = `auth-conductor-${suffix}@test.sgmv.local`
  const inactiveEmail = `auth-inactivo-${suffix}@test.sgmv.local`
  const rateLimitedEmail = `auth-rate-${suffix}@test.sgmv.local`

  await createUser(adminEmail, roles.admin)
  await createUser(despachadorEmail, roles.despachador)
  await createUser(mecanicoEmail, roles.mecanico)
  await createUser(conductorEmail, roles.conductor)
  await createUser(inactiveEmail, roles.admin, 'INACTIVO')
  await createUser(rateLimitedEmail, roles.admin)

  return {
    adminEmail,
    conductorEmail,
    despachadorEmail,
    inactiveEmail,
    mecanicoEmail,
    rateLimitedEmail,
  }
}

function expectNoSensitiveUserFields(body: unknown) {
  const serialized = JSON.stringify(body)

  expect(serialized).not.toContain('contrasena')
  expect(serialized).not.toContain('contrasenaHash')
  expect(serialized).not.toContain('hash')
}

function createTokenWithRole(userId: string, email: string, rol: string, expiresInSeconds: number) {
  const secret = env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET test configuration is missing')
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      email,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iat: Math.floor(Date.now() / 1000) - 3600,
      rol,
      sub: userId,
    }),
  ).toString('base64url')
  const unsignedToken = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(unsignedToken).digest('base64url')

  return `${unsignedToken}.${signature}`
}

function createExpiredToken(
  userId: string,
  email: string,
  rol: 'ADMINISTRADOR' | 'DESPACHADOR' | 'MECANICO' | 'CONDUCTOR',
) {
  return createTokenWithRole(userId, email, rol, -60)
}

describe('Environment parsing', () => {
  it('parses string boolean flags explicitly', () => {
    expect(parseBooleanEnv('false')).toBe(false)
    expect(parseBooleanEnv('0')).toBe(false)
    expect(parseBooleanEnv('true')).toBe(true)
    expect(parseBooleanEnv('1')).toBe(true)
  })
})

describe('Auth API', () => {
  let fixture: AuthFixture

  beforeAll(async () => {
    fixture = await createFixture()
  }, 60000)

  afterAll(async () => {
    try {
      await prisma.usuario.deleteMany({
        where: {
          id: {
            in: createdUserIds,
          },
        },
      })
    } finally {
      await prisma.$disconnect()
    }
  }, 60000)

  it('issues a signed CSRF token in a hardened cookie', async () => {
    const response = await request(createApp()).get('/auth/csrf').expect(200)
    const cookies = response.headers['set-cookie']?.join(';') ?? ''

    expect(response.body.data.csrfToken).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]{43}\./)
    expect(cookies).toContain(`${env.CSRF_COOKIE_NAME}=`)
    expect(cookies).toContain('HttpOnly')
    expect(cookies).toContain('SameSite=Lax')
    expect(cookies).toContain('Path=/')
  })

  it('rejects mutations without a CSRF cookie and header', async () => {
    const response = await request(createApp())
      .post('/auth/login')
      .set('Origin', env.CORS_ORIGIN)
      .send({ contrasena: password, email: fixture.adminEmail })
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('rejects mutations when the CSRF header is missing or tampered', async () => {
    const agent = request.agent(createApp())
    const csrf = await agent.get('/auth/csrf').expect(200)
    const csrfToken = csrf.body.data.csrfToken as string

    await agent
      .post('/auth/login')
      .set('Origin', env.CORS_ORIGIN)
      .send({ contrasena: password, email: fixture.adminEmail })
      .expect(403)

    await agent
      .post('/auth/login')
      .set('Origin', env.CORS_ORIGIN)
      .set('X-CSRF-Token', `${csrfToken}alterado`)
      .send({ contrasena: password, email: fixture.adminEmail })
      .expect(403)
  })

  it('rejects a disallowed origin even when the CSRF token is valid', async () => {
    const agent = request.agent(createApp())
    const csrf = await agent.get('/auth/csrf').expect(200)

    await agent
      .post('/auth/login')
      .set('Origin', 'https://origen-no-autorizado.test')
      .set('X-CSRF-Token', csrf.body.data.csrfToken as string)
      .send({ contrasena: password, email: fixture.adminEmail })
      .expect(403)
  })

  it('only advertises CORS credentials to the configured frontend origin', async () => {
    const allowed = await request(createApp())
      .options('/auth/login')
      .set('Origin', env.CORS_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
    const denied = await request(createApp())
      .options('/auth/login')
      .set('Origin', 'https://origen-no-autorizado.test')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)

    expect(allowed.headers['access-control-allow-origin']).toBe(env.CORS_ORIGIN)
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')
    expect(denied.headers['access-control-allow-origin']).not.toBe(
      'https://origen-no-autorizado.test',
    )
  })

  it('starts a valid session with an HttpOnly cookie and sanitized user data', async () => {
    const agent = await createCsrfAgent(createApp())
    const response = await agent
      .post('/auth/login')
      .send({
        contrasena: password,
        email: fixture.adminEmail,
      })
      .expect(200)

    expect(response.headers['set-cookie']?.join(';')).toContain('HttpOnly')
    expect(response.body.data.user.email).toBe(fixture.adminEmail)
    expect(response.body.data.user.rol.codigo).toBe('ADMINISTRADOR')
    expectNoSensitiveUserFields(response.body)
  })

  it('issues JWT sessions with fixed headers and hardened registered claims', async () => {
    const agent = await createCsrfAgent(createApp())
    const response = await agent
      .post('/auth/login')
      .send({ contrasena: password, email: fixture.adminEmail })
      .expect(200)
    const sessionCookie = response.headers['set-cookie']?.find((cookie) =>
      cookie.startsWith(`${env.COOKIE_NAME}=`),
    )
    const token = sessionCookie?.split(';')[0]?.slice(env.COOKIE_NAME.length + 1)

    expect(token).toBeTruthy()

    const header = decodeProtectedHeader(token as string)
    const claims = decodeJwt(token as string)

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(claims.iss).toBe(env.JWT_ISSUER)
    expect(claims.aud).toBe(env.JWT_AUDIENCE)
    expect(claims.sub).toMatch(/^[0-9a-f-]{36}$/i)
    expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/i)
    expect(claims.nbf).toBeTypeOf('number')
    expect((claims.exp as number) - (claims.iat as number)).toBe(3600)
  })

  it('rejects unsigned JWTs and signed tokens with an invalid audience or type', async () => {
    const user = await prisma.usuario.findUniqueOrThrow({
      where: { email: fixture.adminEmail },
    })
    const now = Math.floor(Date.now() / 1000)
    const unsignedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    )
    const unsignedClaims = Buffer.from(
      JSON.stringify({
        aud: env.JWT_AUDIENCE,
        email: user.email,
        exp: now + 3600,
        iat: now,
        iss: env.JWT_ISSUER,
        jti: randomUUID(),
        nbf: now,
        rol: 'ADMINISTRADOR',
        sub: user.id,
      }),
    ).toString('base64url')
    const unsignedToken = `${unsignedHeader}.${unsignedClaims}.`
    const secret = env.JWT_SECRET

    if (!secret) {
      throw new Error('JWT_SECRET test configuration is missing')
    }

    const invalidAudience = await new SignJWT({
      email: user.email,
      rol: 'ADMINISTRADOR',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'NOT_JWT' })
      .setSubject(user.id)
      .setIssuer(env.JWT_ISSUER)
      .setAudience('audiencia-no-autorizada')
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + 3600)
      .setJti(randomUUID())
      .sign(new TextEncoder().encode(secret))

    for (const token of [unsignedToken, invalidAudience]) {
      const response = await request(createApp())
        .get('/auth/me')
        .set('Cookie', `${env.COOKIE_NAME}=${token}`)
        .expect(401)

      expect(response.body.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('starts a valid dispatcher session with the canonical role', async () => {
    const agent = await createCsrfAgent(createApp())
    const response = await agent
      .post('/auth/login')
      .send({
        contrasena: password,
        email: fixture.despachadorEmail,
      })
      .expect(200)

    expect(response.body.data.user.rol.codigo).toBe('DESPACHADOR')
    expectNoSensitiveUserFields(response.body)
  })

  it('persists a sanitized audit event for a critical mutation', async () => {
    const agent = await createCsrfAgent(createApp())
    const response = await agent
      .post('/auth/login')
      .send({ contrasena: password, email: fixture.mecanicoEmail })
      .expect(200)
    const requestId = response.headers['x-request-id'] as string

    await expect
      .poll(
        () =>
          prisma.eventoAuditoria.findFirst({
            where: { requestId },
          }),
        { timeout: 5000 },
      )
      .toMatchObject({
        actorId: expect.any(String),
        ipHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        metodo: 'POST',
        resultado: 'EXITO',
        ruta: '/auth/login',
        statusHttp: 200,
      })

    const auditEvent = await prisma.eventoAuditoria.findFirstOrThrow({
      where: { requestId },
    })
    const serialized = JSON.stringify(auditEvent)

    expect(serialized).not.toContain(password)
    expect(serialized).not.toContain(fixture.mecanicoEmail)
  })

  it('rejects an incorrect password', async () => {
    const agent = await createCsrfAgent(createApp())

    await agent
      .post('/auth/login')
      .send({
        contrasena: 'clave-incorrecta',
        email: fixture.adminEmail,
      })
      .expect(401)
  })

  it('rejects a non-existent user with a safe response', async () => {
    const agent = await createCsrfAgent(createApp())
    const response = await agent
      .post('/auth/login')
      .send({
        contrasena: password,
        email: `no-existe-${randomUUID().slice(0, 8)}@test.sgmv.local`,
      })
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('temporarily blocks repeated invalid login attempts for a real user', async () => {
    const agent = await createCsrfAgent(createApp())

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await agent
        .post('/auth/login')
        .send({
          contrasena: `clave-incorrecta-${attempt}`,
          email: fixture.rateLimitedEmail,
        })
        .expect(401)
    }

    const response = await agent
      .post('/auth/login')
      .send({
        contrasena: 'clave-incorrecta-final',
        email: fixture.rateLimitedEmail,
      })
      .expect(429)

    expect(response.body.error.code).toBe('RATE_LIMITED')
    expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1)
  })

  it('serializes identity and IP limits across independent database clients', async () => {
    const databaseA = new PrismaClient()
    const databaseB = new PrismaClient()
    const serviceA = new RateLimitService(new RateLimitRepository(databaseA))
    const serviceB = new RateLimitService(new RateLimitRepository(databaseB))
    const suffix = randomUUID()
    const originalIpLimit = env.LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS

    try {
      const identityAttempts = await Promise.allSettled(
        Array.from({ length: 6 }, (_, index) =>
          (index % 2 === 0 ? serviceA : serviceB).consumeLoginAttempt({
            identity: `concurrente-${suffix}@test.sgmv.local`,
            ip: `198.51.100.${index + 1}`,
          }),
        ),
      )

      expect(identityAttempts.filter((result) => result.status === 'fulfilled')).toHaveLength(5)
      expect(identityAttempts.filter((result) => result.status === 'rejected')).toHaveLength(1)
      expect(
        identityAttempts.some(
          (result) =>
            result.status === 'rejected' &&
            result.reason instanceof AppError &&
            result.reason.code === 'RATE_LIMITED',
        ),
      ).toBe(true)

      env.LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS = 5

      const ipAttempts = await Promise.allSettled(
        Array.from({ length: 6 }, (_, index) =>
          (index % 2 === 0 ? serviceA : serviceB).consumeLoginAttempt({
            identity: `ip-${index}-${suffix}@test.sgmv.local`,
            ip: `203.0.113.${suffix.charCodeAt(0)}`,
          }),
        ),
      )

      expect(ipAttempts.filter((result) => result.status === 'fulfilled')).toHaveLength(5)
      expect(ipAttempts.filter((result) => result.status === 'rejected')).toHaveLength(1)
    } finally {
      env.LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS = originalIpLimit
      await Promise.all([databaseA.$disconnect(), databaseB.$disconnect()])
    }
  })

  it('rejects an inactive user', async () => {
    const agent = await createCsrfAgent(createApp())
    const response = await agent
      .post('/auth/login')
      .send({
        contrasena: password,
        email: fixture.inactiveEmail,
      })
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('rejects session reads without a session cookie', async () => {
    await request(createApp()).get('/auth/me').expect(401)
  })

  it('rejects malformed session cookies with a safe response', async () => {
    const response = await request(createApp())
      .get('/auth/me')
      .set('Cookie', `${env.COOKIE_NAME}=malformed.session.value`)
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects expired session cookies with a safe response', async () => {
    const user = await prisma.usuario.findUniqueOrThrow({
      include: { rol: true },
      where: { email: fixture.adminEmail },
    })
    const expiredToken = createExpiredToken(user.id, user.email, user.rol.codigo)

    const response = await request(createApp())
      .get('/auth/me')
      .set('Cookie', `${env.COOKIE_NAME}=${expiredToken}`)
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns the current session without password or hash fields', async () => {
    const agent = await createCsrfAgent(createApp())

    await agent
      .post('/auth/login')
      .send({
        contrasena: password,
        email: fixture.mecanicoEmail,
      })
      .expect(200)

    const response = await agent.get('/auth/me').expect(200)

    expect(response.body.data.user.email).toBe(fixture.mecanicoEmail)
    expect(response.body.data.user.rol.codigo).toBe('MECANICO')
    expectNoSensitiveUserFields(response.body)
  })

  it('keeps only the canonical roles and rejects legacy role aliases in session tokens', async () => {
    const roles = await prisma.rol.findMany({
      orderBy: { codigo: 'asc' },
      select: { codigo: true, nombre: true },
    })
    const user = await prisma.usuario.findUniqueOrThrow({
      where: { email: fixture.adminEmail },
    })

    expect(roles.map((role) => role.codigo).sort()).toEqual([
      'ADMINISTRADOR',
      'CONDUCTOR',
      'DESPACHADOR',
      'MECANICO',
    ])
    expect(roles.map((role) => role.nombre).sort()).toEqual([
      'Administrador',
      'Conductor',
      'Despachador',
      'Mecánico',
    ])

    for (const legacyRole of [
      'SUPERVISOR',
      'OPERADOR',
      'OPERARIO',
      'TECNICO',
      'ADMIN_SUPERVISOR',
      'CONDUCTOR_OPERADOR',
    ]) {
      const legacyToken = createTokenWithRole(user.id, user.email, legacyRole, 3600)

      await request(createApp())
        .get('/auth/me')
        .set('Cookie', `${env.COOKIE_NAME}=${legacyToken}`)
        .expect(401)
    }
  }, 60000)

  it('rejects authenticated users with an unauthorized role', async () => {
    const app = createApp((testApp) => {
      testApp.get(
        '/test/admin-only',
        authenticate,
        authorizeRoles('ADMINISTRADOR'),
        (_request, response) => response.status(200).json({ data: { ok: true } }),
      )
    })
    const agent = await createCsrfAgent(app)

    await agent
      .post('/auth/login')
      .send({
        contrasena: password,
        email: fixture.conductorEmail,
      })
      .expect(200)

    const response = await agent.get('/test/admin-only').expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('closes a session and removes the cookie', async () => {
    const agent = await createCsrfAgent(createApp())

    await agent
      .post('/auth/login')
      .send({
        contrasena: password,
        email: fixture.adminEmail,
      })
      .expect(200)

    const logout = await agent.post('/auth/logout').expect(200)

    expect(logout.headers['set-cookie']?.join(';')).toContain('sgmv_session=')
    await agent.get('/auth/me').expect(401)
  })
})
