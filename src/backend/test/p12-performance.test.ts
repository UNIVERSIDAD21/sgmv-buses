import { performance } from 'node:perf_hooks'

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'P12-performance-test-123'
let adminEmail = ''

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  return sorted[index] ?? 0
}

describe('P12 derived reports performance baseline', () => {
  beforeAll(async () => {
    const role = await prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
      create: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
    })
    adminEmail = `p12-performance-${Date.now()}@test.sgmv.local`
    await prisma.usuario.create({
      data: {
        contrasenaHash: await hash(password, 10),
        email: adminEmail,
        nombre: 'Administrador P12 rendimiento',
        rolId: role.id,
      },
    })
  })

  afterAll(async () => {
    try {
      await prisma.usuario.delete({ where: { email: adminEmail } })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('keeps representative report reads below the P12 p95 budget', async () => {
    const agent = await createCsrfAgent(createApp())
    await agent.post('/auth/login').send({ contrasena: password, email: adminEmail }).expect(200)

    const samples: number[] = []
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now()
      const [summary, buses, maintenance] = await Promise.all([
        agent.get('/historial/resumen'),
        agent.get('/historial/buses?limite=25&pagina=1'),
        agent.get('/historial/informes/mantenimiento?limite=25&pagina=1'),
      ])
      const elapsed = performance.now() - started
      expect(summary.status).toBe(200)
      expect(buses.status).toBe(200)
      expect(maintenance.status).toBe(200)
      samples.push(elapsed)
    }

    const p50 = percentile(samples, 0.5)
    const p95 = percentile(samples, 0.95)
    const p99 = percentile(samples, 0.99)
    const max = Math.max(...samples)
    console.log(
      JSON.stringify({
        p12Performance: {
          samples: samples.length,
          endpoints: [
            '/historial/resumen',
            '/historial/buses',
            '/historial/informes/mantenimiento',
          ],
          p50Ms: Number(p50.toFixed(2)),
          p95Ms: Number(p95.toFixed(2)),
          p99Ms: Number(p99.toFixed(2)),
          maxMs: Number(max.toFixed(2)),
        },
      }),
    )
    expect(p95).toBeLessThanOrEqual(3_000)
  }, 120_000)
})
