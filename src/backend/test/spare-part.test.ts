import { randomUUID } from 'node:crypto'

import { PrismaClient, type Prisma, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const rf05TestTimeout = 180000

const created = {
  buses: [] as string[],
  consumos: [] as string[],
  intervenciones: [] as string[],
  movimientos: [] as string[],
  ordenes: [] as string[],
  repuestos: [] as string[],
  usuarios: [] as string[],
}

interface SparePartFixture {
  adminEmail: string
  adminId: string
  conductorEmail: string
  mecanicoEmail: string
  mecanicoId: string
}

function track(bucket: keyof typeof created) {
  const id = randomUUID()
  created[bucket].push(id)
  return id
}

function shortCode() {
  return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}

function code(prefix: string) {
  return `${prefix}-${shortCode()}`
}

async function ensureRoles() {
  const [admin, mecanico, conductor] = await Promise.all([
    prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: { nombre: 'Administrador' },
      create: {
        codigo: 'ADMINISTRADOR',
        nombre: 'Administrador',
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
      update: { nombre: 'Conductor' },
      create: {
        codigo: 'CONDUCTOR',
        nombre: 'Conductor',
      },
    }),
  ])

  return { admin, conductor, mecanico }
}

async function createUser(email: string, role: Rol) {
  const id = track('usuarios')

  return prisma.usuario.create({
    data: {
      id,
      contrasenaHash: await hash(password, 10),
      email,
      nombre: `Usuario ${email}`,
      rolId: role.id,
    },
  })
}

async function createFixture(): Promise<SparePartFixture> {
  const roles = await ensureRoles()
  const suffix = shortCode().toLowerCase()
  const admin = await createUser(`rf05-admin-${suffix}@test.sgmv.local`, roles.admin)
  const mecanico = await createUser(`rf05-mecanico-${suffix}@test.sgmv.local`, roles.mecanico)
  const conductor = await createUser(`rf05-conductor-${suffix}@test.sgmv.local`, roles.conductor)

  return {
    adminEmail: admin.email,
    adminId: admin.id,
    conductorEmail: conductor.email,
    mecanicoEmail: mecanico.email,
    mecanicoId: mecanico.id,
  }
}

async function loginAgent(email: string) {
  const agent = await createCsrfAgent(createApp())

  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)

  return agent
}

async function createBus() {
  const id = track('buses')

  return prisma.bus.create({
    data: {
      id,
      anio: 2021,
      codigoInterno: code('BUS-RF05'),
      kilometrajeActual: 30000,
      marca: 'Marca RF05',
      modelo: 'Modelo RF05',
      placa: `R${shortCode().slice(0, 6)}`,
    },
  })
}

async function createSparePart(overrides: Partial<Prisma.RepuestoUncheckedCreateInput> = {}) {
  const id = track('repuestos')

  return prisma.repuesto.create({
    data: {
      id,
      codigo: code('REP-RF05'),
      costoUnitario: '100.00',
      nombre: 'Repuesto RF-05',
      stockActual: '5.00',
      stockMinimo: '2.00',
      unidadMedida: 'unidad',
      ...overrides,
    },
  })
}

async function createExecutingOrder(fixture: SparePartFixture) {
  const bus = await createBus()
  const orderId = track('ordenes')
  const interventionId = track('intervenciones')
  const createdAt = new Date()
  const assignedAt = new Date(createdAt.getTime() + 1000)
  const startedAt = new Date(createdAt.getTime() + 2000)

  await prisma.ordenTrabajo.create({
    data: {
      id: orderId,
      busId: bus.id,
      codigo: code('OT-RF05'),
      creadaPorId: fixture.adminId,
      descripcion: 'Orden correctiva para integrar consumo RF-04 con RF-05',
      estado: 'EN_EJECUCION',
      fechaAsignacion: assignedAt,
      fechaCreacion: createdAt,
      fechaInicioEjecucion: startedAt,
      origen: 'CORRECTIVO_DIRECTO',
      prioridad: 'MEDIA',
      tecnicoAsignadoId: fixture.mecanicoId,
      tipo: 'CORRECTIVA',
    },
  })

  await prisma.intervencion.create({
    data: {
      id: interventionId,
      fechaInicio: startedAt,
      ordenTrabajoId: orderId,
      tecnicoId: fixture.mecanicoId,
    },
  })

  return { id: orderId }
}

async function cleanup() {
  await prisma.$transaction(
    async (tx) => {
      await tx.movimientoInventario.deleteMany({
        where: {
          OR: [
            {
              id: {
                in: created.movimientos,
              },
            },
            {
              repuestoId: {
                in: created.repuestos,
              },
            },
            {
              consumoRepuesto: {
                ordenTrabajoId: {
                  in: created.ordenes,
                },
              },
            },
          ],
        },
      })
      await tx.consumoRepuesto.deleteMany({
        where: {
          OR: [
            {
              id: {
                in: created.consumos,
              },
            },
            {
              repuestoId: {
                in: created.repuestos,
              },
            },
            {
              ordenTrabajoId: {
                in: created.ordenes,
              },
            },
          ],
        },
      })
      await tx.intervencion.deleteMany({
        where: {
          id: {
            in: created.intervenciones,
          },
        },
      })
      await tx.ordenEstadoHistorial.deleteMany({
        where: {
          ordenTrabajoId: {
            in: created.ordenes,
          },
        },
      })
      await tx.ordenTrabajo.deleteMany({
        where: {
          id: {
            in: created.ordenes,
          },
        },
      })
      await tx.repuesto.deleteMany({
        where: {
          id: {
            in: created.repuestos,
          },
        },
      })
      await tx.bus.deleteMany({
        where: {
          id: {
            in: created.buses,
          },
        },
      })
      await tx.usuario.deleteMany({
        where: {
          id: {
            in: created.usuarios,
          },
        },
      })
    },
    {
      maxWait: 15000,
      timeout: 60000,
    },
  )
}

describe('RF-05 spare parts inventory API', () => {
  let adminAgent: request.Agent
  let conductorAgent: request.Agent
  let fixture: SparePartFixture
  let mecanicoAgent: request.Agent

  beforeAll(async () => {
    fixture = await createFixture()
    adminAgent = await loginAgent(fixture.adminEmail)
    mecanicoAgent = await loginAgent(fixture.mecanicoEmail)
    conductorAgent = await loginAgent(fixture.conductorEmail)
  }, 60000)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, 60000)

  it(
    'enforces authentication and RF-05 administrative roles',
    async () => {
      await request(createApp()).get('/repuestos/resumen').expect(401)
      await mecanicoAgent.get('/repuestos/resumen').expect(403)
      await conductorAgent.get('/repuestos/resumen').expect(403)

      await adminAgent.get('/repuestos/resumen').expect(200)
    },
    rf05TestTimeout,
  )

  it(
    'creates a spare part with zero stock and rejects direct stock patching',
    async () => {
      const codigo = code('rep-zero').toLowerCase()
      const response = await adminAgent
        .post('/repuestos')
        .send({
          categoria: ' Motor ',
          codigo,
          costoUnitario: '1200.50',
          nombre: ' Filtro principal ',
          stockInicial: '0',
          stockMinimo: '1',
          unidadMedida: ' unidad ',
        })
        .expect(201)

      created.repuestos.push(response.body.data.repuesto.id)

      expect(response.body.data.repuesto.codigo).toBe(codigo.toUpperCase())
      expect(response.body.data.repuesto.disponibilidad).toBe('AGOTADO')
      expect(response.body.data.movimientoInicial).toBeNull()

      await adminAgent
        .patch(`/repuestos/${response.body.data.repuesto.id}`)
        .send({ stockActual: '99' })
        .expect(400)
    },
    rf05TestTimeout,
  )

  it(
    'creates initial stock with a movement and blocks duplicate codes',
    async () => {
      const codigo = code('REP-INIT')
      const key = randomUUID()
      const response = await adminAgent
        .post('/repuestos')
        .send({
          claveIdempotencia: key,
          codigo,
          costoUnitario: '500.00',
          motivoStockInicial: 'Registro inicial RF-05',
          nombre: 'Repuesto con inicial',
          stockInicial: '4',
          stockMinimo: '2',
          unidadMedida: 'unidad',
        })
        .expect(201)

      created.repuestos.push(response.body.data.repuesto.id)
      created.movimientos.push(response.body.data.movimientoInicial.id)

      expect(response.body.data.repuesto.stockActual).toBe('4.00')
      expect(response.body.data.movimientoInicial.tipo).toBe('ENTRADA')

      const retry = await adminAgent
        .post('/repuestos')
        .send({
          claveIdempotencia: key,
          codigo,
          costoUnitario: '500.00',
          motivoStockInicial: 'Registro inicial RF-05',
          nombre: 'Repuesto con inicial',
          stockInicial: '4',
          stockMinimo: '2',
          unidadMedida: 'unidad',
        })
        .expect(201)

      expect(retry.headers['idempotency-replayed']).toBe('true')
      expect(retry.body).toEqual(response.body)

      await adminAgent
        .post('/repuestos')
        .send({
          codigo: codigo.toLowerCase(),
          costoUnitario: '500.00',
          nombre: 'Duplicado',
          stockInicial: '0',
          stockMinimo: '2',
          unidadMedida: 'unidad',
        })
        .expect(409)
    },
    rf05TestTimeout,
  )

  it(
    'lists and summarizes availability with the same stock classification',
    async () => {
      const low = await createSparePart({
        codigo: code('REP-LOW'),
        stockActual: '1.00',
        stockMinimo: '2.00',
      })
      const available = await createSparePart({
        codigo: code('REP-OK'),
        stockActual: '5.00',
        stockMinimo: '2.00',
      })
      const inactive = await createSparePart({
        codigo: code('REP-OFF'),
        estado: 'INACTIVO',
        stockActual: '5.00',
        stockMinimo: '1.00',
      })

      const lowResponse = await adminAgent
        .get('/repuestos')
        .query({ busqueda: low.codigo, disponibilidad: 'BAJO', limite: 10, pagina: 1 })
        .expect(200)
      const availableResponse = await adminAgent
        .get('/repuestos')
        .query({ busqueda: available.codigo, disponibilidad: 'DISPONIBLE', limite: 10, pagina: 1 })
        .expect(200)
      const inactiveResponse = await adminAgent
        .get('/repuestos')
        .query({ busqueda: inactive.codigo, disponibilidad: 'INACTIVO', limite: 10, pagina: 1 })
        .expect(200)

      expect(lowResponse.body.data.repuestos[0].disponibilidad).toBe('BAJO')
      expect(availableResponse.body.data.repuestos[0].disponibilidad).toBe('DISPONIBLE')
      expect(inactiveResponse.body.data.repuestos[0].disponibilidad).toBe('INACTIVO')

      const summary = await adminAgent.get('/repuestos/resumen').expect(200)

      expect(summary.body.data.bajoStock).toBeGreaterThanOrEqual(1)
      expect(summary.body.data.disponibles).toBeGreaterThanOrEqual(1)
      expect(summary.body.data.inactivos).toBeGreaterThanOrEqual(1)
    },
    rf05TestTimeout,
  )

  it(
    'applies entries atomically and uses idempotency keys',
    async () => {
      const part = await createSparePart({ stockActual: '0.00' })
      const key = randomUUID()

      const first = await adminAgent
        .post(`/repuestos/${part.id}/entradas`)
        .send({
          cantidad: '3',
          claveIdempotencia: key,
          costoUnitario: '300.00',
          motivo: 'Entrada RF-05',
        })
        .expect(201)

      const retry = await adminAgent
        .post(`/repuestos/${part.id}/entradas`)
        .set('Idempotency-Key', key)
        .send({
          cantidad: '3',
          costoUnitario: '300.00',
          motivo: 'Entrada RF-05',
        })
        .expect(201)

      const reloaded = await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })
      const movementCount = await prisma.movimientoInventario.count({
        where: {
          claveIdempotencia: key,
        },
      })

      expect(first.body.data.stockAnterior).toBe('0.00')
      expect(retry.headers['idempotency-replayed']).toBe('true')
      expect(retry.body).toEqual(first.body)
      expect(reloaded.stockActual.toFixed(2)).toBe('3.00')
      expect(reloaded.costoUnitario.toFixed(2)).toBe('300.00')
      expect(movementCount).toBe(1)
    },
    rf05TestTimeout,
  )

  it(
    'accumulates concurrent entries without lost updates',
    async () => {
      const part = await createSparePart({ stockActual: '0.00' })
      const responses = await Promise.all([
        adminAgent.post(`/repuestos/${part.id}/entradas`).send({
          cantidad: '2',
          claveIdempotencia: randomUUID(),
          motivo: 'Entrada concurrente A',
        }),
        adminAgent.post(`/repuestos/${part.id}/entradas`).send({
          cantidad: '4',
          claveIdempotencia: randomUUID(),
          motivo: 'Entrada concurrente B',
        }),
      ])

      expect(responses.map((response) => response.status).sort()).toEqual([201, 201])

      const reloaded = await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })
      const movements = await prisma.movimientoInventario.count({
        where: {
          repuestoId: part.id,
          tipo: 'ENTRADA',
        },
      })

      expect(reloaded.stockActual.toFixed(2)).toBe('6.00')
      expect(movements).toBe(2)
    },
    rf05TestTimeout,
  )

  it(
    'applies adjustments, rejects insufficient stock and prevents concurrent negative stock',
    async () => {
      const part = await createSparePart({ stockActual: '2.00', stockMinimo: '1.00' })

      await adminAgent
        .post(`/repuestos/${part.id}/ajustes`)
        .send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          direccion: 'INCREMENTO',
          motivo: 'Conteo fisico mayor',
        })
        .expect(201)

      await adminAgent
        .post(`/repuestos/${part.id}/ajustes`)
        .send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          direccion: 'DISMINUCION',
          motivo: 'Conteo fisico menor',
        })
        .expect(201)

      await adminAgent
        .post(`/repuestos/${part.id}/ajustes`)
        .send({
          cantidad: '99',
          claveIdempotencia: randomUUID(),
          direccion: 'DISMINUCION',
          motivo: 'Intento mayor al stock',
        })
        .expect(409)

      const racePart = await createSparePart({ stockActual: '1.00' })
      const race = await Promise.all([
        adminAgent.post(`/repuestos/${racePart.id}/ajustes`).send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          direccion: 'DISMINUCION',
          motivo: 'Salida concurrente A',
        }),
        adminAgent.post(`/repuestos/${racePart.id}/ajustes`).send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          direccion: 'DISMINUCION',
          motivo: 'Salida concurrente B',
        }),
      ])

      expect(race.map((response) => response.status).sort()).toEqual([201, 409])

      const reloaded = await prisma.repuesto.findUniqueOrThrow({ where: { id: racePart.id } })

      expect(reloaded.stockActual.toFixed(2)).toBe('0.00')
    },
    rf05TestTimeout,
  )

  it(
    'rejects entries and adjustments on inactive spare parts',
    async () => {
      const part = await createSparePart({ estado: 'INACTIVO' })

      await adminAgent
        .post(`/repuestos/${part.id}/entradas`)
        .send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          motivo: 'Entrada inactiva',
        })
        .expect(409)

      await adminAgent
        .post(`/repuestos/${part.id}/ajustes`)
        .send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          direccion: 'INCREMENTO',
          motivo: 'Ajuste inactivo',
        })
        .expect(409)
    },
    rf05TestTimeout,
  )

  it(
    'keeps RF-04 consumption visible in RF-05 movements and preserves historical cost',
    async () => {
      const part = await createSparePart({
        codigo: code('REP-CONS'),
        costoUnitario: '75.00',
        stockActual: '3.00',
      })
      const order = await createExecutingOrder(fixture)

      const consumption = await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          cantidad: '2',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .expect(201)

      created.consumos.push(consumption.body.data.consumo.id)
      created.movimientos.push(consumption.body.data.consumo.movimientoInventario.id)

      await adminAgent
        .patch(`/repuestos/${part.id}`)
        .send({
          costoUnitario: '125.00',
          nombre: part.nombre,
          stockMinimo: '1',
          unidadMedida: part.unidadMedida,
        })
        .expect(200)

      const movements = await adminAgent
        .get('/inventario/movimientos')
        .query({ busqueda: part.codigo, limite: 10, pagina: 1, tipo: 'CONSUMO' })
        .expect(200)

      const movement = movements.body.data.movimientos.find(
        (item: { consumo: { id: string } | null }) =>
          item.consumo?.id === consumption.body.data.consumo.id,
      )
      const reloadedConsumption = await prisma.consumoRepuesto.findUniqueOrThrow({
        where: { id: consumption.body.data.consumo.id },
      })
      const reloadedPart = await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })

      expect(movement).toBeTruthy()
      expect(movement.consumo.orden.id).toBe(order.id)
      expect(reloadedConsumption.costoUnitario.toFixed(2)).toBe('75.00')
      expect(reloadedPart.costoUnitario.toFixed(2)).toBe('125.00')
      expect(reloadedPart.stockActual.toFixed(2)).toBe('1.00')
    },
    rf05TestTimeout,
  )

  it(
    'serializes RF-04 consumption against RF-05 negative adjustment',
    async () => {
      const part = await createSparePart({ stockActual: '1.00' })
      const order = await createExecutingOrder(fixture)
      const results = await Promise.all([
        mecanicoAgent.post(`/ordenes-trabajo/${order.id}/consumos`).send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        }),
        adminAgent.post(`/repuestos/${part.id}/ajustes`).send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          direccion: 'DISMINUCION',
          motivo: 'Ajuste concurrente contra consumo',
        }),
      ])

      expect(results.map((response) => response.status).sort()).toEqual([201, 400])

      const reloaded = await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })
      const movementCount = await prisma.movimientoInventario.count({
        where: {
          repuestoId: part.id,
        },
      })

      expect(reloaded.stockActual.toFixed(2)).toBe('0.00')
      expect(movementCount).toBe(1)
    },
    rf05TestTimeout,
  )

  it(
    'creates a single spare part for concurrent duplicate code attempts',
    async () => {
      const codigo = code('REP-DUP')
      const responses = await Promise.all([
        adminAgent.post('/repuestos').send({
          codigo,
          costoUnitario: '10',
          nombre: 'Duplicado concurrente A',
          stockInicial: '0',
          stockMinimo: '0',
          unidadMedida: 'unidad',
        }),
        adminAgent.post('/repuestos').send({
          codigo: codigo.toLowerCase(),
          costoUnitario: '10',
          nombre: 'Duplicado concurrente B',
          stockInicial: '0',
          stockMinimo: '0',
          unidadMedida: 'unidad',
        }),
      ])

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409])

      const createdResponse = responses.find((response) => response.status === 201)
      created.repuestos.push(createdResponse!.body.data.repuesto.id)

      const count = await prisma.repuesto.count({ where: { codigo } })

      expect(count).toBe(1)
    },
    rf05TestTimeout,
  )
})
