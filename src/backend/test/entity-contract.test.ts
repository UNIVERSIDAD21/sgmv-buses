import { PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { entityIdSchema } from '../src/shared/entity-id.js'

const prisma = new PrismaClient()
afterAll(() => prisma.$disconnect())

describe('Contrato estructural Int', () => {
  it.each([
    0,
    -1,
    1.2,
    2_147_483_648,
    '',
    ' 1',
    '+1',
    '01',
    '1e2',
    '1.0',
    true,
    null,
    'c589a7dd-1a16-420a-8bea-f78bc303d691',
  ])('rechaza identificador inválido %s', (value) => {
    expect(entityIdSchema.safeParse(value).success).toBe(false)
  })

  it('normaliza parámetros HTTP sin coerciones ambiguas', () => {
    expect(entityIdSchema.parse('2147483647')).toBe(2_147_483_647)
    expect(entityIdSchema.parse(17)).toBe(17)
  })

  it('PostgreSQL autoincrementa entidades y mantiene FK y claves técnicas', async () => {
    const ids: number[] = []
    try {
      const first = await prisma.ruta.create({
        data: {
          codigo: `INT-${Date.now()}`,
          nombre: 'Ruta estructural',
          origen: 'A',
          destino: 'B',
        },
      })
      ids.push(first.id)
      const second = await prisma.ruta.create({
        data: {
          codigo: `${first.codigo}-B`,
          nombre: 'Ruta estructural B',
          origen: 'A',
          destino: 'B',
        },
      })
      ids.push(second.id)
      expect(Number.isInteger(first.id)).toBe(true)
      expect(second.id).toBeGreaterThan(first.id)
      const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
        SELECT column_name,data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='solicitudes_idempotentes'
        AND column_name IN ('id','actor_id','clave','request_id')`
      expect(columns).toEqual(
        expect.arrayContaining([
          { column_name: 'id', data_type: 'integer' },
          { column_name: 'actor_id', data_type: 'integer' },
          { column_name: 'clave', data_type: 'uuid' },
          { column_name: 'request_id', data_type: 'uuid' },
        ]),
      )
      await expect(
        prisma.usuario.create({
          data: {
            nombre: 'No persistir',
            email: `invalid-fk-${Date.now()}@test.sgmv.local`,
            contrasenaHash: 'fixture-no-login',
            rolId: 2_147_483_647,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' })
    } finally {
      await prisma.ruta.deleteMany({ where: { id: { in: ids } } })
    }
  })
})
