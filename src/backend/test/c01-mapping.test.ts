import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { createBusSchema } from '../src/fleet/fleet.schemas.js'
import { createRutaSchema, createModeloBusSchema } from '../src/fleet/fleet-catalog.schemas.js'
import { createPreventivePlanSchema } from '../src/preventive/preventive-plan.schemas.js'
import {
  createManualWorkOrderSchema,
  interventionUpdateSchema,
} from '../src/work-orders/work-order.schemas.js'
import { loginSchema } from '../src/auth/auth.schemas.js'

const prisma = new PrismaClient()
afterAll(() => prisma.$disconnect())

describe('C-01: mapeado semántico sin pérdida de información', () => {
  it('acepta el límite físico y reserva los códigos internos para la generación automática', () => {
    const route = { nombre: 'N'.repeat(120), origen: 'A', destino: 'B' }
    expect(createRutaSchema.safeParse(route).success).toBe(true)
    expect(createRutaSchema.safeParse({ ...route, codigo: 'R'.repeat(50) }).success).toBe(false)
    for (const key of ['nombre', 'origen', 'destino']) {
      expect(createRutaSchema.safeParse({ ...route, [key]: 'N'.repeat(121) }).success).toBe(false)
    }
    const bus = {
      placa: 'P'.repeat(15),
      marca: 'SGMV-DEMO',
      modelo: 'A',
      anio: 2026,
      kilometrajeActual: 0,
    }
    expect(createBusSchema.safeParse(bus).success).toBe(true)
    expect(createBusSchema.safeParse({ ...bus, codigoInterno: 'B'.repeat(50) }).success).toBe(false)
    expect(createBusSchema.safeParse({ ...bus, placa: 'P'.repeat(16) }).success).toBe(false)
    expect(createBusSchema.safeParse({ ...bus, placa: 'ß'.repeat(8) }).success).toBe(false)
  })

  it('aplica límites de clave y componente sin reducir actividad libre ni diagnóstico', () => {
    const plan = {
      busId: 1,
      claveTarea: 'A'.repeat(80),
      componente: 'C'.repeat(120),
      actividad: 'Actividad detallada. '.repeat(40),
      criterio: 'KILOMETRAJE',
      intervaloKm: 5000,
      anticipacionKm: 500,
      bloqueaAlVencer: true,
      prioridad: 'MEDIA',
    }
    expect(createPreventivePlanSchema.safeParse(plan).success).toBe(true)
    expect(
      createPreventivePlanSchema.safeParse({ ...plan, claveTarea: 'A'.repeat(81) }).success,
    ).toBe(false)
    expect(
      createPreventivePlanSchema.safeParse({ ...plan, componente: 'C'.repeat(121) }).success,
    ).toBe(false)
    expect(
      createManualWorkOrderSchema.safeParse({
        busId: 1,
        descripcion: 'Diagnóstico y contexto técnico. '.repeat(30),
      }).success,
    ).toBe(true)
    expect(
      interventionUpdateSchema.safeParse({ diagnostico: 'Inspección detallada. '.repeat(60) })
        .success,
    ).toBe(true)
  })

  it('el catálogo y el bus conservan marca/modelo de 100 caracteres sin truncamiento', () => {
    const marca = 'M'.repeat(100),
      modelo = 'D'.repeat(100)
    expect(createModeloBusSchema.safeParse({ marca, nombreModelo: modelo }).success).toBe(true)
    expect(
      createBusSchema.safeParse({
        placa: 'SIM123',
        marca,
        modelo,
        anio: 2026,
        kilometrajeActual: 0,
      }).success,
    ).toBe(true)
  })

  it('el correo conserva normalización y respeta la longitud física objetivo', () => {
    const email = 'a'.repeat(60) + '@' + 'b'.repeat(55) + '.com'
    expect(email.length).toBe(120)
    expect(loginSchema.safeParse({ email, contrasena: 'synthetic-test' }).success).toBe(true)
    expect(
      loginSchema.safeParse({ email: 'x' + email, contrasena: 'synthetic-test' }).success,
    ).toBe(false)
  })

  it('PostgreSQL conserva 8.6 km y JSON anidado, pero no admite un código de 51 caracteres', async () => {
    const ids: number[] = []
    const marker = randomUUID()
    try {
      const route = await prisma.ruta.create({
        data: {
          codigo: marker,
          nombre: 'Ruta fraccionaria',
          origen: 'A',
          destino: 'B',
          longitudKmOficial: '8.6',
          procedencia: {
            origenDato: 'SIMULADO_SGMV',
            detalle: { valores: [1, 2], nota: 'N'.repeat(300) },
          },
        },
      })
      ids.push(route.id)
      expect(route.longitudKmOficial?.toNumber()).toBe(8.6)
      expect(route.procedencia).toMatchObject({
        detalle: { valores: [1, 2], nota: 'N'.repeat(300) },
      })
      await expect(
        prisma.ruta.create({
          data: { codigo: 'R'.repeat(51), nombre: 'No persistir', origen: 'A', destino: 'B' },
        }),
      ).rejects.toMatchObject({ code: 'P2000' })
    } finally {
      await prisma.ruta.deleteMany({ where: { id: { in: ids } } })
    }
  })

  it('verifica los catorce tamaños físicos y la separación odómetro/decimal/JSON/fecha', async () => {
    const columns = await prisma.$queryRaw<
      Array<{
        table_name: string
        column_name: string
        data_type: string
        character_maximum_length: number | null
      }>
    >`
      SELECT table_name,column_name,data_type,character_maximum_length FROM information_schema.columns WHERE table_schema='public'`
    const widths: Array<[string, string, number]> = [
      ['roles', 'nombre', 80],
      ['roles', 'descripcion', 255],
      ['usuarios', 'nombre', 120],
      ['usuarios', 'email', 120],
      ['usuarios', 'telefono', 20],
      ['buses', 'codigo_interno', 50],
      ['buses', 'placa', 15],
      ['ordenes_trabajo', 'codigo', 50],
      ['rutas', 'codigo', 50],
      ['rutas', 'nombre', 120],
      ['rutas', 'origen', 120],
      ['rutas', 'destino', 120],
      ['planes_mantenimiento_preventivo', 'clave_tarea', 80],
      ['planes_mantenimiento_preventivo', 'componente', 120],
    ]
    for (const [table_name, column_name, character_maximum_length] of widths)
      expect(columns).toContainEqual({
        table_name,
        column_name,
        character_maximum_length,
        data_type: 'character varying',
      })
    for (const [table, column, type] of [
      ['buses', 'kilometraje_actual', 'integer'],
      ['rutas', 'longitud_km_oficial', 'numeric'],
      ['ordenes_trabajo', 'plan_aplicado', 'jsonb'],
      ['ordenes_trabajo', 'fecha_creacion', 'timestamp with time zone'],
    ])
      expect(
        columns.find((c) => c.table_name === table && c.column_name === column)?.data_type,
      ).toBe(type)
  })
})
