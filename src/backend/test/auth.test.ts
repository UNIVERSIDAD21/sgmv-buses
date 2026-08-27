import { randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { authenticate, authorizeRoles } from '../src/auth/auth.middleware.js'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'

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
      where: { codigo: 'ADMIN_SUPERVISOR' },
      update: {},
      create: {
        codigo: 'ADMIN_SUPERVISOR',
        nombre: 'Administrador / Supervisor',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'MECANICO' },
      update: {},
      create: {
        codigo: 'MECANICO',
        nombre: 'Personal Tecnico / Mecanico',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'CONDUCTOR_OPERADOR' },
      update: {},
      create: {
        codigo: 'CONDUCTOR_OPERADOR',
        nombre: 'Conductor / Operador',
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
    expect(response.body.data.user.rol.codigo).toBe('ADMIN_SUPERVISOR')
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

  it('rejects authenticated users with an unauthorized role', async () => {
    const app = createApp((testApp) => {
      testApp.get(
        '/test/admin-only',
        authenticate,
        authorizeRoles('ADMIN_SUPERVISOR'),
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
