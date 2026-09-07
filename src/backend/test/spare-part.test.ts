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
  compatibilidades: [] as string[],
  modelos: [] as string[],
  consumos: [] as string[],
  intervenciones: [] as string[],
  movimientos: [] as string[],
  ordenes: [] as string[],
  repuestos: [] as string[],
  autorizaciones: [] as string[],
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

async function allowPartForBus(repuestoId: string, busId: string, adminId: string) {
  const id = track('compatibilidades')
  await prisma.compatibilidadRepuesto.create({
    data: {
      busId,
      definidaPorId: adminId,
      especificacionesValidadas: { fuente: 'fixture RF-05' },
      fechaDefinicion: new Date('2026-01-01T00:00:00.000Z'),
      id,
      permitido: true,
      repuestoId,
      version: 1,
      vigente: true,
    },
  })
}

async function purgeStaleRf05Fixtures() {
  const [parts, orders, buses] = await Promise.all([
    prisma.repuesto.findMany({
      where: { codigo: { startsWith: 'REP-RF05-' } },
      select: { id: true },
    }),
    prisma.ordenTrabajo.findMany({
      where: { codigo: { startsWith: 'OT-RF05-' } },
      select: { id: true },
    }),
    prisma.bus.findMany({
      where: { codigoInterno: { startsWith: 'BUS-RF05-' } },
      select: { id: true },
    }),
  ])
  const partIds = parts.map((part) => part.id)
  const orderIds = orders.map((order) => order.id)
  const busIds = buses.map((bus) => bus.id)
  if (partIds.length === 0 && orderIds.length === 0 && busIds.length === 0) return

  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      where: { OR: [{ ordenTrabajoId: { in: orderIds } }, { repuestoId: { in: partIds } }] },
      select: { id: true },
    })
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: alerts.map((alert) => alert.id) } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((alert) => alert.id) } } })
    await tx.movimientoInventario.deleteMany({
      where: {
        OR: [
          { repuestoId: { in: partIds } },
          { consumoRepuesto: { ordenTrabajoId: { in: orderIds } } },
        ],
      },
    })
    await tx.consumoRepuesto.deleteMany({
      where: { OR: [{ repuestoId: { in: partIds } }, { ordenTrabajoId: { in: orderIds } }] },
    })
    await tx.autorizacionExcepcionConsumo.deleteMany({
      where: { OR: [{ repuestoId: { in: partIds } }, { ordenTrabajoId: { in: orderIds } }] },
    })
    await tx.compatibilidadRepuesto.deleteMany({
      where: { OR: [{ repuestoId: { in: partIds } }, { busId: { in: busIds } }] },
    })
    await tx.actividadOrden.deleteMany({
      where: { intervencion: { ordenTrabajoId: { in: orderIds } } },
    })
    await tx.intervencion.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenEstadoHistorial.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenTrabajo.deleteMany({ where: { id: { in: orderIds } } })
    await tx.bus.updateMany({ data: { modeloBusId: null }, where: { id: { in: busIds } } })
    await tx.bus.deleteMany({ where: { id: { in: busIds } } })
    await tx.repuesto.deleteMany({ where: { id: { in: partIds } } })
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
      const alertas = await tx.alertaInterna.findMany({
        select: { id: true },
        where: { ordenTrabajoId: { in: created.ordenes } },
      })
      await tx.alertaDestinatario.deleteMany({
        where: { alertaInternaId: { in: alertas.map((alerta) => alerta.id) } },
      })
      await tx.alertaInterna.deleteMany({
        where: { id: { in: alertas.map((alerta) => alerta.id) } },
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
      await tx.autorizacionExcepcionConsumo.deleteMany({
        where: {
          OR: [
            { id: { in: created.autorizaciones } },
            { ordenTrabajoId: { in: created.ordenes } },
            { repuestoId: { in: created.repuestos } },
          ],
        },
      })
      await tx.compatibilidadRepuesto.deleteMany({
        where: {
          OR: [
            { id: { in: created.compatibilidades } },
            { repuestoId: { in: created.repuestos } },
            { busId: { in: created.buses } },
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
      await tx.bus.updateMany({
        data: { modeloBusId: null },
        where: { id: { in: created.buses } },
      })
      await tx.modeloBus.deleteMany({ where: { id: { in: created.modelos } } })
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
    await purgeStaleRf05Fixtures()
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
    'versions compatibility rules, applies bus precedence and rejects without positive evidence',
    async () => {
      const part = await createSparePart({ stockActual: '2.00' })
      const order = await createExecutingOrder(fixture)
      const orderBus = await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: order.id } })
      const model = await prisma.modeloBus.create({
        data: {
          id: track('modelos'),
          marca: `Modelo P8 ${shortCode()}`,
          nombreModelo: `Modelo P8 ${shortCode()}`,
          especificaciones: { fuente: 'test' },
        },
      })
      await prisma.bus.update({ where: { id: orderBus.busId }, data: { modeloBusId: model.id } })
      created.buses.push(orderBus.busId)
      const modelRule = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades`)
        .send({
          modeloBusId: model.id,
          permitido: false,
          especificacionesValidadas: { homologacion: 'modelo' },
        })
        .expect(201)
      const busRule = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades`)
        .send({
          busId: orderBus.busId,
          permitido: true,
          especificacionesValidadas: { homologacion: 'bus' },
        })
        .expect(201)
      const rules = await adminAgent.get(`/repuestos/${part.id}/compatibilidades`).expect(200)
      expect(
        rules.body.data.compatibilidades.map((rule: { version: number }) => rule.version).sort(),
      ).toEqual([1, 1])
      expect(modelRule.body.data.compatibilidad.vigente).toBe(true)
      expect(busRule.body.data.compatibilidad.permitido).toBe(true)
      const compatible = await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({ cantidad: '1.25', claveIdempotencia: randomUUID(), repuestoId: part.id })
        .expect(201)
      expect(compatible.body.data.consumo.resultadoCompatibilidad).toBe('COMPATIBLE')
      expect(compatible.body.data.consumo.reglaCompatibilidadId).toBe(
        busRule.body.data.compatibilidad.id,
      )
    },
    rf05TestTimeout,
  )

  it(
    'creates a rejected-consumption alert and consumes only with a prior admin exception',
    async () => {
      const part = await createSparePart({ stockActual: '2.00' })
      const order = await createExecutingOrder(fixture)
      const orderRecord = await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: order.id } })
      const intervention = await prisma.intervencion.findFirstOrThrow({
        where: { ordenTrabajoId: order.id },
      })
      const key = randomUUID()
      await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({ cantidad: '1', claveIdempotencia: key, repuestoId: part.id })
        .expect(409)
      const alert = await prisma.alertaInterna.findFirstOrThrow({
        where: { ordenTrabajoId: order.id, repuestoId: null, tipo: 'CONSUMO_INCOMPATIBLE' },
        include: { destinatarios: { include: { usuario: { include: { rol: true } } } } },
      })
      expect(alert.contextoEvento).toMatchObject({ repuestoId: part.id })
      expect(alert.destinatarios.length).toBeGreaterThan(0)
      expect(
        alert.destinatarios.every(({ usuario }) =>
          ['ADMINISTRADOR', 'DESPACHADOR'].includes(usuario.rol.codigo),
        ),
      ).toBe(true)
      expect(alert.destinatarios.some(({ usuario }) => usuario.id === fixture.mecanicoId)).toBe(
        false,
      )
      expect(await prisma.consumoRepuesto.count({ where: { ordenTrabajoId: order.id } })).toBe(0)

      const replay = await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({ cantidad: '1', claveIdempotencia: key, repuestoId: part.id })
        .expect(409)
      expect(replay.headers['idempotency-replayed']).toBe('true')
      expect(
        await prisma.alertaInterna.count({
          where: { claveDeduplicacion: `consumo-incompatible:${key}` },
        }),
      ).toBe(1)
      const authorization = await adminAgent
        .post(`/ordenes-trabajo/${order.id}/excepciones-consumo`)
        .send({
          cantidadMaxima: '1.25',
          intervencionId: intervention.id,
          motivo: 'Autorizacion puntual por disponibilidad operacional',
          repuestoId: part.id,
        })
        .expect(201)
      created.autorizaciones.push(authorization.body.data.autorizacion.id)
      const consumed = await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          autorizacionExcepcionId: authorization.body.data.autorizacion.id,
          cantidad: '1.25',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .then((response) => {
          expect(response.status).toBe(201)
          return response
        })
      expect(consumed.body.data.consumo.resultadoCompatibilidad).toBe('EXCEPCION_AUTORIZADA')
      expect(consumed.body.data.consumo.autorizadoPorId).toBe(fixture.adminId)
      expect(
        (await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })).stockActual.toFixed(
          2,
        ),
      ).toBe('0.75')
      expect(orderRecord.tecnicoAsignadoId).toBe(fixture.mecanicoId)
      await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          autorizacionExcepcionId: authorization.body.data.autorizacion.id,
          cantidad: '0.5',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .expect(409)
    },
    rf05TestTimeout,
  )

  it(
    'versions and inactivates a compatibility rule idempotently',
    async () => {
      const part = await createSparePart()
      const bus = await createBus()
      const firstKey = randomUUID()
      const firstInput = {
        busId: bus.id,
        permitido: true,
        especificacionesValidadas: { homologacion: 'primera-version' },
      }

      const first = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades`)
        .set('Idempotency-Key', firstKey)
        .send(firstInput)
        .expect(201)
      const firstRuleId = first.body.data.compatibilidad.id as string
      created.compatibilidades.push(firstRuleId)

      const retry = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades`)
        .set('Idempotency-Key', firstKey)
        .send(firstInput)
        .expect(201)

      expect(retry.headers['idempotency-replayed']).toBe('true')
      expect(retry.body).toEqual(first.body)

      const second = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades`)
        .set('Idempotency-Key', randomUUID())
        .send({
          ...firstInput,
          permitido: false,
          especificacionesValidadas: { homologacion: 'segunda-version' },
        })
        .expect(201)
      const secondRuleId = second.body.data.compatibilidad.id as string
      created.compatibilidades.push(secondRuleId)

      expect(second.body.data.compatibilidad.version).toBe(2)
      expect(second.body.data.compatibilidad.vigente).toBe(true)

      const deactivateKey = randomUUID()
      const deactivated = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades/${secondRuleId}/inactivar`)
        .set('Idempotency-Key', deactivateKey)
        .send({})
        .expect(200)
      const deactivateRetry = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades/${secondRuleId}/inactivar`)
        .set('Idempotency-Key', deactivateKey)
        .send({})
        .expect(200)

      expect(deactivated.body.data.compatibilidad.vigente).toBe(false)
      expect(deactivateRetry.headers['idempotency-replayed']).toBe('true')
      expect(deactivateRetry.body).toEqual(deactivated.body)

      const rules = await prisma.compatibilidadRepuesto.findMany({
        orderBy: { version: 'asc' },
        where: { repuestoId: part.id, busId: bus.id },
      })
      expect(rules.map((rule) => [rule.version, rule.vigente])).toEqual([
        [1, false],
        [2, false],
      ])
    },
    rf05TestTimeout,
  )

  it(
    'serializes competing compatibility versions and leaves one current rule',
    async () => {
      const part = await createSparePart()
      const bus = await createBus()
      const requestVersion = (homologacion: string) =>
        adminAgent
          .post(`/repuestos/${part.id}/compatibilidades`)
          .set('Idempotency-Key', randomUUID())
          .send({
            busId: bus.id,
            permitido: true,
            especificacionesValidadas: { homologacion },
          })

      const responses = await Promise.all([
        requestVersion('concurrente-a'),
        requestVersion('concurrente-b'),
      ])
      responses.forEach((response) => expect(response.status).toBe(201))
      created.compatibilidades.push(
        ...responses.map((response) => response.body.data.compatibilidad.id as string),
      )

      const rules = await prisma.compatibilidadRepuesto.findMany({
        orderBy: { version: 'asc' },
        where: { busId: bus.id, repuestoId: part.id },
      })
      expect(rules.map((rule) => rule.version)).toEqual([1, 2])
      expect(rules.filter((rule) => rule.vigente)).toHaveLength(1)
      expect(rules.find((rule) => rule.vigente)?.version).toBe(2)
    },
    rf05TestTimeout,
  )

  it(
    'does not fall back to a compatible model rule when the bus rule is negative',
    async () => {
      const part = await createSparePart({ stockActual: '2.00' })
      const order = await createExecutingOrder(fixture)
      const orderBus = await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: order.id } })
      const model = await prisma.modeloBus.create({
        data: {
          id: track('modelos'),
          marca: `Modelo P8 ${shortCode()}`,
          nombreModelo: `Modelo P8 ${shortCode()}`,
          especificaciones: { fuente: 'test' },
        },
      })
      await prisma.bus.update({ where: { id: orderBus.busId }, data: { modeloBusId: model.id } })
      created.buses.push(orderBus.busId)

      const modelRule = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades`)
        .send({
          modeloBusId: model.id,
          permitido: true,
          especificacionesValidadas: { homologacion: 'modelo-compatible' },
        })
        .expect(201)
      created.compatibilidades.push(modelRule.body.data.compatibilidad.id)

      const busRule = await adminAgent
        .post(`/repuestos/${part.id}/compatibilidades`)
        .send({
          busId: orderBus.busId,
          permitido: false,
          especificacionesValidadas: { homologacion: 'bus-no-compatible' },
        })
        .expect(201)
      created.compatibilidades.push(busRule.body.data.compatibilidad.id)

      await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({ cantidad: '1', claveIdempotencia: randomUUID(), repuestoId: part.id })
        .expect(409)

      const reloaded = await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })
      expect(reloaded.stockActual.toFixed(2)).toBe('2.00')
      expect(await prisma.consumoRepuesto.count({ where: { ordenTrabajoId: order.id } })).toBe(0)
      const alert = await prisma.alertaInterna.findFirstOrThrow({
        where: { ordenTrabajoId: order.id, tipo: 'CONSUMO_INCOMPATIBLE' },
      })
      expect(alert.contextoEvento).toMatchObject({
        destino: 'BUS',
        permitido: false,
        reglaId: busRule.body.data.compatibilidad.id,
      })
    },
    rf05TestTimeout,
  )

  it(
    'rejects consumption with a revoked exception',
    async () => {
      const part = await createSparePart({ stockActual: '2.00' })
      const order = await createExecutingOrder(fixture)
      const intervention = await prisma.intervencion.findFirstOrThrow({
        where: { ordenTrabajoId: order.id, fechaFin: null },
      })
      const authorization = await adminAgent
        .post(`/ordenes-trabajo/${order.id}/excepciones-consumo`)
        .send({
          cantidadMaxima: '1.00',
          intervencionId: intervention.id,
          motivo: 'Excepcion revocable de prueba',
          repuestoId: part.id,
        })
        .expect(201)
      const authorizationId = authorization.body.data.autorizacion.id as string
      created.autorizaciones.push(authorizationId)

      await adminAgent
        .post(`/ordenes-trabajo/${order.id}/excepciones-consumo/${authorizationId}/revocar`)
        .send({})
        .expect(200)

      const revoked = await prisma.autorizacionExcepcionConsumo.findUniqueOrThrow({
        where: { id: authorizationId },
      })
      expect(revoked.estado).toBe('REVOCADA')

      await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          autorizacionExcepcionId: authorizationId,
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .expect(409)

      expect(await prisma.consumoRepuesto.count({ where: { ordenTrabajoId: order.id } })).toBe(0)
      expect(
        (await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })).stockActual.toFixed(
          2,
        ),
      ).toBe('2.00')
    },
    rf05TestTimeout,
  )

  it(
    'rejects an expired exception without changing stock or creating consumption',
    async () => {
      const part = await createSparePart({ stockActual: '2.00' })
      const order = await createExecutingOrder(fixture)
      const intervention = await prisma.intervencion.findFirstOrThrow({
        where: { ordenTrabajoId: order.id, fechaFin: null },
      })
      const authorizationId = track('autorizaciones')
      const now = Date.now()
      await prisma.autorizacionExcepcionConsumo.create({
        data: {
          autorizadoPorId: fixture.adminId,
          cantidadMaxima: '1.00',
          fechaAutorizacion: new Date(now - 120_000),
          fechaExpiracion: new Date(now - 60_000),
          id: authorizationId,
          intervencionId: intervention.id,
          motivo: 'Excepcion expirada de prueba P8',
          ordenTrabajoId: order.id,
          repuestoId: part.id,
        },
      })

      await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          autorizacionExcepcionId: authorizationId,
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .expect(409)

      expect(await prisma.consumoRepuesto.count({ where: { ordenTrabajoId: order.id } })).toBe(0)
      expect(
        (await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })).stockActual.toFixed(
          2,
        ),
      ).toBe('2.00')
    },
    rf05TestTimeout,
  )

  it(
    'rejects reused and out-of-context consumption exceptions',
    async () => {
      const part = await createSparePart({ stockActual: '3.00' })
      const order = await createExecutingOrder(fixture)
      const otherOrder = await createExecutingOrder(fixture)
      const intervention = await prisma.intervencion.findFirstOrThrow({
        where: { ordenTrabajoId: order.id, fechaFin: null },
      })
      const authorization = await adminAgent
        .post(`/ordenes-trabajo/${order.id}/excepciones-consumo`)
        .send({
          cantidadMaxima: '1.00',
          intervencionId: intervention.id,
          motivo: 'Excepcion de un solo uso',
          repuestoId: part.id,
        })
        .expect(201)
      const authorizationId = authorization.body.data.autorizacion.id as string
      created.autorizaciones.push(authorizationId)

      await mecanicoAgent
        .post(`/ordenes-trabajo/${otherOrder.id}/consumos`)
        .send({
          autorizacionExcepcionId: authorizationId,
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .expect(409)

      const consumed = await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          autorizacionExcepcionId: authorizationId,
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .expect(201)
      created.consumos.push(consumed.body.data.consumo.id)
      created.movimientos.push(consumed.body.data.consumo.movimientoInventario.id)

      const used = await prisma.autorizacionExcepcionConsumo.findUniqueOrThrow({
        where: { id: authorizationId },
      })
      expect(used.estado).toBe('USADA')

      await mecanicoAgent
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          autorizacionExcepcionId: authorizationId,
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: part.id,
        })
        .expect(409)

      expect(await prisma.consumoRepuesto.count({ where: { repuestoId: part.id } })).toBe(1)
      expect(
        (await prisma.repuesto.findUniqueOrThrow({ where: { id: part.id } })).stockActual.toFixed(
          2,
        ),
      ).toBe('2.00')
    },
    rf05TestTimeout,
  )

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
      const orderBus = await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: order.id } })
      await allowPartForBus(part.id, orderBus.busId, fixture.adminId)

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
      const orderBus = await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: order.id } })
      await allowPartForBus(part.id, orderBus.busId, fixture.adminId)
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
