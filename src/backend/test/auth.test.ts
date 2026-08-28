import { createHmac, randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { authenticate, authorizeRoles } from '../src/auth/auth.middleware.js'
import { createApp } from '../src/app.js'
import { env, parseBooleanEnv } from '../src/config/env.js'

const prisma = new PrismaClient()
const describeDb = process.env.DATABASE_URL ? describe : describe.skip
const password = 'Clave-demo-segura-123'
const createdUserIds: string[] = []

interface AuthFixture {
  adminEmail: string
  conductorEmail: string
  inactiveEmail: string
  mecanicoEmail: string
  rateLimitedEmail: string
}

async function ensureRoles() {
  const [admin, mecanico, conductor] = await Promise.all([
    prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
      create: {
        codigo: 'ADMINISTRADOR',
        nombre: 'Administrador',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'MECANICO' },
      update: {},
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

  return { admin, conductor, mecanico }
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
  const mecanicoEmail = `auth-mecanico-${suffix}@test.sgmv.local`
  const conductorEmail = `auth-conductor-${suffix}@test.sgmv.local`
  const inactiveEmail = `auth-inactivo-${suffix}@test.sgmv.local`
  const rateLimitedEmail = `auth-rate-${suffix}@test.sgmv.local`

  await createUser(adminEmail, roles.admin)
  await createUser(mecanicoEmail, roles.mecanico)
  await createUser(conductorEmail, roles.conductor)
  await createUser(inactiveEmail, roles.admin, 'INACTIVO')
  await createUser(rateLimitedEmail, roles.admin)

  return {
    adminEmail,
    conductorEmail,
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
  rol: 'ADMINISTRADOR' | 'MECANICO' | 'CONDUCTOR',
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

describeDb('Auth API', () => {
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

  it('starts a valid session with an HttpOnly cookie and sanitized user data', async () => {
    const response = await request(createApp())
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

  it('rejects an incorrect password', async () => {
    await request(createApp())
      .post('/auth/login')
      .send({
        contrasena: 'clave-incorrecta',
        email: fixture.adminEmail,
      })
      .expect(401)
  })

  it('rejects a non-existent user with a safe response', async () => {
    const response = await request(createApp())
      .post('/auth/login')
      .send({
        contrasena: password,
        email: `no-existe-${randomUUID().slice(0, 8)}@test.sgmv.local`,
      })
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('temporarily blocks repeated invalid login attempts for a real user', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(createApp())
        .post('/auth/login')
        .send({
          contrasena: `clave-incorrecta-${attempt}`,
          email: fixture.rateLimitedEmail,
        })
        .expect(401)
    }

    const response = await request(createApp())
      .post('/auth/login')
      .send({
        contrasena: 'clave-incorrecta-final',
        email: fixture.rateLimitedEmail,
      })
      .expect(429)

    expect(response.body.error.code).toBe('RATE_LIMITED')
  })

  it('rejects an inactive user', async () => {
    const response = await request(createApp())
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
    const agent = request.agent(createApp())

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

  it('keeps only the three canonical roles and rejects legacy role aliases in session tokens', async () => {
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
      'MECANICO',
    ])
    expect(roles.map((role) => role.nombre).sort()).toEqual([
      'Administrador',
      'Conductor',
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
    const agent = request.agent(app)

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
    const agent = request.agent(createApp())

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
