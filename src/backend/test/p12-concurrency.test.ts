import { randomUUID } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  IdempotencyRepository,
  type IdempotencyDecision,
} from '../src/idempotency/idempotency.repository.js'
import { hashIdempotentPayload } from '../src/idempotency/idempotency.service.js'

const prisma = new PrismaClient()
const password = 'P12-concurrency-test-123'
let actorId = ''
let roleId = ''

describe('P12 real PostgreSQL concurrency', () => {
  beforeAll(async () => {
    const role = await prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
      create: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
    })
    roleId = role.id
    actorId = randomUUID()

    await prisma.usuario.create({
      data: {
        contrasenaHash: await hash(password, 10),
        email: `p12-concurrency-${actorId.slice(0, 8)}@test.sgmv.local`,
        id: actorId,
        nombre: 'Actor P12 concurrencia',
        rolId: roleId,
      },
    })
  })

  afterAll(async () => {
    try {
      await prisma.solicitudIdempotente.deleteMany({ where: { actorId } })
      await prisma.usuario.delete({ where: { id: actorId } })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('permits exactly one reservation for concurrent requests with the same key', async () => {
    const repository = new IdempotencyRepository()
    const clave = randomUUID()
    const hashSolicitud = hashIdempotentPayload({ body: { p12: true }, params: {}, query: {} })
    const base = {
      actorId,
      clave,
      hashSolicitud,
      metodo: 'POST',
      operacion: 'POST /p12-concurrency',
      rutaPlantilla: '/p12-concurrency',
    }

    const decisions = await Promise.all(
      [randomUUID(), randomUUID()].map((requestId) =>
        repository.reserve({ ...base, requestId }, 120_000),
      ),
    )

    const reserved = decisions.filter(
      (decision: IdempotencyDecision) => decision.kind === 'RESERVED',
    )
    const inProgress = decisions.filter(
      (decision: IdempotencyDecision) => decision.kind === 'IN_PROGRESS',
    )
    const stored = await prisma.solicitudIdempotente.findMany({ where: { actorId, clave } })

    expect(reserved).toHaveLength(1)
    expect(inProgress).toHaveLength(1)
    expect(stored).toHaveLength(1)
    expect(stored[0]?.estado).toBe('EN_PROCESO')
  })
})
