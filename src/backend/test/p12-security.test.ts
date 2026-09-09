import { randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'P12-seguridad-test-123'
const createdUserIds: string[] = []

interface Fixture {
  adminEmail: string
  dispatcherEmail: string
}

async function createUser(email: string, role: Rol) {
  const id = randomUUID()
  createdUserIds.push(id)

  return prisma.usuario.create({
    data: {
      contrasenaHash: await hash(password, 10),
      email,
      id,
      nombre: `P12 ${role.codigo}`,
      rolId: role.id,
    },
  })
}

async function createFixture(): Promise<Fixture> {
  const [adminRole, dispatcherRole] = await Promise.all([
    prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
      create: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
    }),
    prisma.rol.upsert({
      where: { codigo: 'DESPACHADOR' },
      update: {},
      create: { codigo: 'DESPACHADOR', nombre: 'Despachador' },
    }),
  ])

  const suffix = randomUUID().slice(0, 8)
  const adminEmail = `p12-admin-${suffix}@test.sgmv.local`
  const dispatcherEmail = `p12-dispatcher-${suffix}@test.sgmv.local`
  await createUser(adminEmail, adminRole)
  await createUser(dispatcherEmail, dispatcherRole)

  return { adminEmail, dispatcherEmail }
}

async function login(email: string) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)
  return agent
}

function expectSafeError(body: unknown) {
  const serialized = JSON.stringify(body)
  expect(serialized).not.toContain('contrasenaHash')
  expect(serialized).not.toContain('JWT_SECRET')
  expect(serialized).not.toContain('DATABASE_URL')
  expect(serialized).toContain('requestId')
}

function expectSafeProjection(body: unknown) {
  const serialized = JSON.stringify(body)
  expect(serialized).not.toContain('contrasenaHash')
  expect(serialized).not.toContain('JWT_SECRET')
  expect(serialized).not.toContain('DATABASE_URL')
}

describe('P12 security and RBAC matrix', () => {
  let fixture: Fixture

  beforeAll(async () => {
    fixture = await createFixture()
  }, 60_000)

  afterAll(async () => {
    try {
      await prisma.usuario.deleteMany({ where: { id: { in: createdUserIds } } })
    } finally {
      await prisma.$disconnect()
    }
  }, 60_000)

  it('rejects unauthenticated, cross-origin and malformed requests safely', async () => {
    const app = createApp()

    const allowedPreflight = await request(app)
      .options('/auth/login')
      .set('Origin', env.CORS_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
    expect(allowedPreflight.headers['access-control-allow-origin']).toBe(env.CORS_ORIGIN)

    const rejectedPreflight = await request(app)
      .options('/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(200)
    expect(rejectedPreflight.headers['access-control-allow-origin']).toBeUndefined()

    const unauthenticated = await request(app).get('/historial/resumen').expect(401)
    expectSafeError(unauthenticated.body)

    const invalidOrigin = await request(app)
      .post('/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ contrasena: password, email: fixture.adminEmail })
      .expect(403)
    expectSafeError(invalidOrigin.body)

    const admin = await login(fixture.adminEmail)
    const malformedId = await admin.get('/historial/buses/not-a-uuid').expect(400)
    expect(malformedId.body.error.code).toBe('VALIDATION_ERROR')
    expectSafeError(malformedId.body)
  })

  it('enforces role authorization independently of authentication', async () => {
    const dispatcher = await login(fixture.dispatcherEmail)

    const forbiddenReport = await dispatcher.get('/historial/informes/costos').expect(403)
    expect(forbiddenReport.body.error.code).toBe('FORBIDDEN')
    expectSafeError(forbiddenReport.body)

    const allowedOperational = await dispatcher.get('/historial/resumen').expect(200)
    expect(allowedOperational.body).toHaveProperty('data')
    expect(JSON.stringify(allowedOperational.body)).not.toContain('costoUnitario')
    expect(JSON.stringify(allowedOperational.body)).not.toContain('costoTotal')
  })

  it('requires CSRF and the configured origin for mutations', async () => {
    const app = createApp()
    const csrfAgent = await createCsrfAgent(app)
    await csrfAgent
      .post('/auth/login')
      .send({ contrasena: password, email: fixture.adminEmail })
      .expect(200)

    const missingCsrf = await csrfAgent.post('/auth/logout').unset('X-CSRF-Token').expect(403)
    expect(missingCsrf.body.error.code).toBe('FORBIDDEN')
    expectSafeError(missingCsrf.body)
  })

  it('rejects injection-shaped queries and oversized payloads without leaking internals', async () => {
    const admin = await login(fixture.adminEmail)
    const injection = await admin
      .get('/historial/resumen')
      .query({ busqueda: "' OR 1=1 --" })
      .expect(200)
    expectSafeProjection(injection.body)

    const oversized = await request(createApp())
      .post('/auth/login')
      .set('Origin', env.CORS_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ email: 'payload@test.sgmv.local', contrasena: 'x'.repeat(1_100_000) })
      .expect(413)
    expect(oversized.body.error.code).toBe('PAYLOAD_TOO_LARGE')
    expectSafeError(oversized.body)
  })
})
