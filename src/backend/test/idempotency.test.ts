import { randomUUID } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import type { RequestHandler } from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { authenticate, authorizeRoles } from '../src/auth/auth.middleware.js'
import { createApp } from '../src/app.js'
import { idempotent } from '../src/idempotency/idempotency.middleware.js'
import { IdempotencyRepository } from '../src/idempotency/idempotency.repository.js'
import { hashIdempotentPayload } from '../src/idempotency/idempotency.service.js'
import { prisma as applicationPrisma } from '../src/prisma/client.js'
import { AppError, sendData } from '../src/shared/http.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const inputSchema = z.object({
  nombre: z.string().trim().min(3).max(160),
  rechazar: z.boolean().optional(),
  respuestaInsegura: z.boolean().optional(),
})

let actorId = ''
let actorEmail = ''
let agent: Awaited<ReturnType<typeof createCsrfAgent>>

const testHandler: RequestHandler = async (request, response) => {
  const input = inputSchema.parse(request.body)
  const updated = await applicationPrisma.usuario.update({
    where: { id: request.user!.id },
    data: { nombre: input.nombre },
    select: { id: true, nombre: true },
  })

  if (input.rechazar) {
    throw new AppError(409, 'TEST_DOMAIN_REJECTION', 'Rechazo de dominio controlado')
  }

  response.status(201)
  sendData(
    response,
    input.respuestaInsegura ? { ...updated, token: 'no-persistir' } : updated,
    'Mutacion idempotente de prueba',
  )
}

function createTestApp() {
  return createApp((app) => {
    app.post(
      '/p2-idempotencia/:targetId',
      authenticate,
      authorizeRoles('ADMINISTRADOR'),
      idempotent(testHandler),
    )
  })
}

describe('P2-10 HTTP idempotency', () => {
  beforeAll(async () => {
    const role = await prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
      create: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
    })

    actorId = randomUUID()
    actorEmail = `idempotencia-${randomUUID().slice(0, 8)}@test.sgmv.local`

    await prisma.usuario.create({
      data: {
        contrasenaHash: await hash(password, 10),
        email: actorEmail,
        id: actorId,
        nombre: 'Actor idempotencia',
        rolId: role.id,
      },
    })

    agent = await createCsrfAgent(createTestApp())
    await agent.post('/auth/login').send({ contrasena: password, email: actorEmail }).expect(200)
  })

  afterAll(async () => {
    try {
      await prisma.solicitudIdempotente.deleteMany({ where: { actorId } })
      await prisma.usuario.deleteMany({ where: { id: actorId } })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('requires a valid UUID v4 Idempotency-Key on marked operations', async () => {
    const path = `/p2-idempotencia/${actorId}`

    const missing = await agent
      .post(path)
      .unset('Idempotency-Key')
      .send({ nombre: 'Sin clave' })
      .expect(400)
    const invalid = await agent
      .post(path)
      .set('Idempotency-Key', 'no-es-uuid')
      .send({ nombre: 'Clave invalida' })
      .expect(400)
    const mismatch = await agent
      .post(path)
      .send({ claveIdempotencia: randomUUID(), nombre: 'Claves distintas' })
      .set('Idempotency-Key', randomUUID())
      .expect(400)

    expect(missing.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')
    expect(mismatch.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('replays the exact terminal status and body without executing twice', async () => {
    const key = randomUUID()
    const path = `/p2-idempotencia/${actorId}`
    const body = { nombre: 'Nombre aplicado una vez' }

    const first = await agent.post(path).set('Idempotency-Key', key).send(body).expect(201)
    const replay = await agent.post(path).set('Idempotency-Key', key).send(body).expect(201)
    const stored = await prisma.solicitudIdempotente.findFirstOrThrow({
      where: { actorId, clave: key },
    })

    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect(replay.body).toEqual(first.body)
    expect(stored.estado).toBe('COMPLETADA')
    expect(stored.statusHttp).toBe(201)
    expect(stored.respuestaSegura).toEqual(first.body)
  })

  it('rejects reuse with a different payload', async () => {
    const key = randomUUID()
    const path = `/p2-idempotencia/${actorId}`

    await agent
      .post(path)
      .set('Idempotency-Key', key)
      .send({ nombre: 'Contenido original' })
      .expect(201)
    const conflict = await agent
      .post(path)
      .set('Idempotency-Key', key)
      .send({ nombre: 'Contenido diferente' })
      .expect(409)

    expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('reports an in-progress request and recovers an expired reservation', async () => {
    const key = randomUUID()
    const path = `/p2-idempotencia/${actorId}`
    const route = '/p2-idempotencia/:targetId'
    const body = { nombre: 'Reserva recuperada' }
    const repository = new IdempotencyRepository()
    const hashSolicitud = hashIdempotentPayload({
      body,
      params: { targetId: actorId },
      query: {},
    })

    const decision = await repository.reserve(
      {
        actorId,
        clave: key,
        hashSolicitud,
        metodo: 'POST',
        operacion: `POST ${route}`,
        requestId: randomUUID(),
        rutaPlantilla: route,
      },
      120_000,
    )

    expect(decision.kind).toBe('RESERVED')

    const inProgress = await agent.post(path).set('Idempotency-Key', key).send(body).expect(409)

    expect(inProgress.body.error.code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS')
    expect(inProgress.headers['retry-after']).toBe('1')

    await prisma.solicitudIdempotente.updateMany({
      where: { actorId, clave: key },
      data: { expiraAt: new Date(Date.now() - 1_000) },
    })

    const recovered = await agent.post(path).set('Idempotency-Key', key).send(body).expect(201)

    expect(recovered.headers['idempotency-replayed']).toBeUndefined()
  })

  it('rolls back domain failures, stores them after rollback and replays them', async () => {
    const key = randomUUID()
    const path = `/p2-idempotencia/${actorId}`
    const before = await prisma.usuario.findUniqueOrThrow({ where: { id: actorId } })
    const body = { nombre: 'Este nombre debe revertirse', rechazar: true }

    const first = await agent.post(path).set('Idempotency-Key', key).send(body).expect(409)
    const after = await prisma.usuario.findUniqueOrThrow({ where: { id: actorId } })
    const replay = await agent.post(path).set('Idempotency-Key', key).send(body).expect(409)

    expect(first.body.error.code).toBe('TEST_DOMAIN_REJECTION')
    expect(after.nombre).toBe(before.nombre)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect(replay.body).toEqual(first.body)
  })

  it('does not commit business data when the safe response cannot be finalized', async () => {
    const key = randomUUID()
    const path = `/p2-idempotencia/${actorId}`
    const before = await prisma.usuario.findUniqueOrThrow({ where: { id: actorId } })

    await agent
      .post(path)
      .set('Idempotency-Key', key)
      .send({ nombre: 'No debe confirmarse', respuestaInsegura: true })
      .expect(500)

    const after = await prisma.usuario.findUniqueOrThrow({ where: { id: actorId } })
    const reservation = await prisma.solicitudIdempotente.findFirstOrThrow({
      where: { actorId, clave: key },
    })

    expect(after.nombre).toBe(before.nombre)
    expect(reservation.estado).toBe('EN_PROCESO')
  })
})
