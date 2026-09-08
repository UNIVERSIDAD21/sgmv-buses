import { createHmac, randomUUID } from 'node:crypto'

import { Prisma, PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const rf04TestTimeout = 180000

const created = {
  asignaciones: [] as string[],
  buses: [] as string[],
  compatibilidades: [] as string[],
  consumos: [] as string[],
  jornadas: [] as string[],
  movimientos: [] as string[],
  novedades: [] as string[],
  ordenes: [] as string[],
  programaciones: [] as string[],
  repuestos: [] as string[],
  usuarios: [] as string[],
}

interface WorkOrderFixture {
  adminEmail: string
  adminId: string
  conductorEmail: string
  conductorId: string
  inactiveAdminEmail: string
  inactiveMechanicId: string
  mecanicoAltEmail: string
  mecanicoAltId: string
  mecanicoEmail: string
  mecanicoId: string
  despachadorEmail: string
  despachadorId: string
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

function uniquePlate(prefix = 'W') {
  return `${prefix}${shortCode().slice(0, 6)}`
}

function uniqueBusCode(prefix = 'OT-BUS') {
  return `${prefix}-${shortCode()}`
}

function isoDateFromTodayOffset(days: number) {
  const target = new Date(Date.now() + days * 86_400_000)

  return target.toISOString().slice(0, 10)
}

function dateOnlyFromTodayOffset(days: number) {
  return new Date(`${isoDateFromTodayOffset(days)}T00:00:00.000Z`)
}

async function ensureRoles() {
  const [admin, mecanico, conductor, despachador] = await Promise.all([
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
    prisma.rol.upsert({
      where: { codigo: 'DESPACHADOR' },
      update: { nombre: 'Despachador' },
      create: {
        codigo: 'DESPACHADOR',
        nombre: 'Despachador',
      },
    }),
  ])

  return { admin, conductor, despachador, mecanico }
}

async function createUser(email: string, role: Rol, estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO') {
  const id = track('usuarios')

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

async function createFixture(): Promise<WorkOrderFixture> {
  const roles = await ensureRoles()
  const suffix = shortCode().toLowerCase()
  const admin = await createUser(`ot-admin-${suffix}@test.sgmv.local`, roles.admin)
  const inactiveAdmin = await createUser(
    `ot-admin-inactive-${suffix}@test.sgmv.local`,
    roles.admin,
    'INACTIVO',
  )
  const mecanico = await createUser(`ot-mecanico-${suffix}@test.sgmv.local`, roles.mecanico)
  const mecanicoAlt = await createUser(`ot-mecanico-alt-${suffix}@test.sgmv.local`, roles.mecanico)
  const inactiveMechanic = await createUser(
    `ot-mecanico-inactive-${suffix}@test.sgmv.local`,
    roles.mecanico,
    'INACTIVO',
  )
  const conductor = await createUser(`ot-conductor-${suffix}@test.sgmv.local`, roles.conductor)
  const despachador = await createUser(
    `ot-despachador-${suffix}@test.sgmv.local`,
    roles.despachador,
  )

  return {
    adminEmail: admin.email,
    adminId: admin.id,
    conductorEmail: conductor.email,
    conductorId: conductor.id,
    inactiveAdminEmail: inactiveAdmin.email,
    inactiveMechanicId: inactiveMechanic.id,
    mecanicoAltEmail: mecanicoAlt.email,
    mecanicoAltId: mecanicoAlt.id,
    mecanicoEmail: mecanico.email,
    mecanicoId: mecanico.id,
    despachadorEmail: despachador.email,
    despachadorId: despachador.id,
  }
}

async function createBus(overrides: Partial<Prisma.BusCreateInput> = {}) {
  const id = track('buses')

  return prisma.bus.create({
    data: {
      id,
      anio: 2022,
      codigoInterno: uniqueBusCode(),
      kilometrajeActual: 20000,
      marca: 'Marca RF04',
      modelo: 'Modelo RF04',
      placa: uniquePlate(),
      ...overrides,
    },
  })
}

async function createPendingCorrectiveOrder(
  fixture: WorkOrderFixture,
  overrides: Partial<Prisma.OrdenTrabajoUncheckedCreateInput> = {},
) {
  const order = await prisma.ordenTrabajo.create({
    data: {
      id: track('ordenes'),
      busId: overrides.busId ?? (await createBus()).id,
      codigo: code('OT-RF04'),
      creadaPorId: fixture.adminId,
      descripcion: 'Orden correctiva directa para pruebas automatizadas RF-04',
      estado: 'PENDIENTE_ASIGNACION',
      origen: 'CORRECTIVO_DIRECTO',
      prioridad: 'MEDIA',
      tecnicoAsignadoId: null,
      tipo: 'CORRECTIVA',
      ...overrides,
    },
  })

  await prisma.ordenEstadoHistorial.create({
    data: {
      cambiadoPorId: fixture.adminId,
      estadoAnterior: null,
      estadoNuevo: 'PENDIENTE_ASIGNACION',
      observacion: 'Orden creada para pruebas RF-04',
      ordenTrabajoId: order.id,
    },
  })

  return order
}

async function createRepuesto(overrides: Partial<Prisma.RepuestoUncheckedCreateInput> = {}) {
  const id = track('repuestos')

  return prisma.repuesto.create({
    data: {
      id,
      codigo: code('REP-RF04'),
      costoUnitario: '123.45',
      nombre: 'Repuesto RF-04',
      stockActual: '2',
      stockMinimo: '0',
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
      especificacionesValidadas: { fuente: 'fixture RF-04' },
      fechaDefinicion: new Date('2026-01-01T00:00:00.000Z'),
      id,
      permitido: true,
      repuestoId,
      version: 1,
      vigente: true,
    },
  })
}

async function createNovelty(
  fixture: WorkOrderFixture,
  busId: string,
  overrides: Partial<Prisma.NovedadUncheckedCreateInput> = {},
) {
  const novelty = await prisma.novedad.create({
    data: {
      id: track('novedades'),
      busId,
      conductorId: fixture.conductorId,
      descripcion: 'Novedad operativa que origina una orden correctiva RF-04',
      tipo: 'Falla mecanica RF-04',
      ...overrides,
    },
  })

  return novelty
}

async function createEligibleSchedule(fixture: WorkOrderFixture, busId: string) {
  const schedule = await prisma.programacionMantenimiento.create({
    data: {
      id: track('programaciones'),
      actividad: 'Revision preventiva que origina orden RF-04',
      busId,
      creadaPorId: fixture.adminId,
      criterio: 'KILOMETRAJE',
      kilometrajeObjetivo: 19900,
      tipo: 'Revision RF-04',
    },
  })

  return schedule
}

async function loginAgent(email: string) {
  const agent = await createCsrfAgent(createApp())

  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)

  return agent
}

function createTokenWithRole(userId: string, email: string, rol: string, expiresInSeconds: number) {
  if (!env.JWT_SECRET) {
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
  const signature = createHmac('sha256', env.JWT_SECRET).update(unsignedToken).digest('base64url')

  return `${unsignedToken}.${signature}`
}

async function prepareExecutionOrder(fixture: WorkOrderFixture) {
  const order = await createPendingCorrectiveOrder(fixture)
  const admin = await loginAgent(fixture.adminEmail)
  const mecanico = await loginAgent(fixture.mecanicoEmail)

  await admin
    .post(`/ordenes-trabajo/${order.id}/asignar`)
    .send({ tecnicoId: fixture.mecanicoId })
    .expect(200)
  await mecanico.post(`/ordenes-trabajo/${order.id}/iniciar`).send({}).expect(200)

  return { admin, mecanico, order }
}

async function prepareCompletableOrder(fixture: WorkOrderFixture) {
  const context = await prepareExecutionOrder(fixture)

  await context.mecanico
    .patch(`/ordenes-trabajo/${context.order.id}/intervencion`)
    .send({
      diagnostico: 'Diagnostico correctivo valido para completar la orden',
      observaciones: 'Observaciones tecnicas iniciales',
    })
    .expect(200)
  await context.mecanico
    .post(`/ordenes-trabajo/${context.order.id}/actividades`)
    .send({ descripcion: 'Actividad tecnica registrada durante la ejecucion' })
    .expect(201)

  return context
}

async function cleanup() {
  const linkedOrderIds = (
    await prisma.ordenTrabajo.findMany({
      select: { id: true },
      where: {
        OR: [
          {
            novedadId: {
              in: created.novedades,
            },
          },
          {
            programacionMantenimientoId: {
              in: created.programaciones,
            },
          },
        ],
      },
    })
  ).map((order) => order.id)
  const orderIds = [...new Set([...created.ordenes, ...linkedOrderIds])]

  await prisma.$transaction(
    async (tx) => {
      const alerts = await tx.alertaInterna.findMany({
        select: { id: true },
        where: {
          OR: [
            { novedadId: { in: created.novedades } },
            { ordenTrabajoId: { in: orderIds } },
            { programacionMantenimientoId: { in: created.programaciones } },
            { repuestoId: { in: created.repuestos } },
          ],
        },
      })
      const alertIds = alerts.map((alert) => alert.id)
      await tx.alertaDestinatario.deleteMany({
        where: {
          OR: [{ alertaInternaId: { in: alertIds } }, { usuarioId: { in: created.usuarios } }],
        },
      })
      await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
      await tx.movimientoInventario.deleteMany({
        where: {
          OR: [
            {
              consumoRepuesto: {
                ordenTrabajoId: {
                  in: orderIds,
                },
              },
            },
            {
              repuestoId: {
                in: created.repuestos,
              },
            },
            {
              responsableId: {
                in: created.usuarios,
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
              ordenTrabajoId: {
                in: orderIds,
              },
            },
            {
              repuestoId: {
                in: created.repuestos,
              },
            },
          ],
        },
      })
      await tx.compatibilidadRepuesto.deleteMany({
        where: { id: { in: created.compatibilidades } },
      })
      await tx.actividadOrden.deleteMany({
        where: {
          intervencion: {
            ordenTrabajoId: {
              in: orderIds,
            },
          },
        },
      })
      await tx.lecturaKilometraje.deleteMany({
        where: {
          ordenTrabajoId: { in: orderIds },
        },
      })
      await tx.intervencion.deleteMany({
        where: {
          ordenTrabajoId: {
            in: orderIds,
          },
        },
      })
      await tx.ordenReasignacion.deleteMany({
        where: {
          ordenTrabajoId: {
            in: orderIds,
          },
        },
      })
      await tx.ordenEstadoHistorial.deleteMany({
        where: {
          ordenTrabajoId: {
            in: orderIds,
          },
        },
      })
      await tx.ordenTrabajo.deleteMany({
        where: {
          id: {
            in: orderIds,
          },
        },
      })
      await tx.novedad.deleteMany({
        where: {
          id: {
            in: created.novedades,
          },
        },
      })
      await tx.programacionMantenimiento.deleteMany({
        where: {
          id: {
            in: created.programaciones,
          },
        },
      })
      await tx.lecturaKilometraje.deleteMany({
        where: {
          busId: {
            in: created.buses,
          },
        },
      })
      await tx.jornadaOperativa.deleteMany({
        where: { id: { in: created.jornadas } },
      })
      await tx.asignacionConductor.deleteMany({
        where: {
          OR: [
            {
              id: {
                in: created.asignaciones,
              },
            },
            {
              busId: {
                in: created.buses,
              },
            },
            {
              conductorId: {
                in: created.usuarios,
              },
            },
            {
              asignadoPorId: {
                in: created.usuarios,
              },
            },
          ],
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

describe('RF-04 Work order tracking API', () => {
  let fixture: WorkOrderFixture

  beforeAll(async () => {
    fixture = await createFixture()
  }, rf04TestTimeout)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, rf04TestTimeout)

  it(
    'requires sessions, canonical roles and active authorized users',
    async () => {
      await request(createApp()).get('/ordenes-trabajo/resumen').expect(401)

      const conductor = await loginAgent(fixture.conductorEmail)

      await conductor.get('/ordenes-trabajo/resumen').expect(403)
      await conductor.get('/ordenes-trabajo').expect(403)
      await request(createApp())
        .post('/auth/login')
        .send({ contrasena: password, email: fixture.inactiveAdminEmail })
        .expect(403)

      const token = createTokenWithRole(fixture.adminId, fixture.adminEmail, 'SUPERVISOR', 3600)

      await request(createApp())
        .get('/ordenes-trabajo/resumen')
        .set('Cookie', `${env.COOKIE_NAME}=${token}`)
        .expect(401)
    },
    rf04TestTimeout,
  )

  it(
    'creates manual corrective orders and rejects protected client fields',
    async () => {
      const admin = await loginAgent(fixture.adminEmail)
      const bus = await createBus()

      const createdOrder = await admin
        .post('/ordenes-trabajo')
        .send({
          busId: bus.id,
          descripcion: 'Orden correctiva directa creada por el Administrador',
          prioridad: 'ALTA',
          tipo: 'CORRECTIVA',
        })
        .expect(201)
      const orderId = createdOrder.body.data.orden.id as string
      created.ordenes.push(orderId)

      expect(createdOrder.body.data.orden.estado).toBe('PENDIENTE_ASIGNACION')
      expect(createdOrder.body.data.orden.origen).toBe('CORRECTIVO_DIRECTO')
      expect(createdOrder.body.data.orden.tipo).toBe('CORRECTIVA')
      expect(createdOrder.body.data.orden.tecnicoAsignado).toBeNull()
      expect(createdOrder.body.data.orden.creadaPor.id).toBe(fixture.adminId)
      expect(createdOrder.body.data.orden.historialEstados).toHaveLength(1)

      await admin
        .post('/ordenes-trabajo')
        .send({
          busId: bus.id,
          descripcion: 'Orden preventiva manual no soportada por el modelo actual',
          tipo: 'PREVENTIVA',
        })
        .expect(400)

      await admin
        .post('/ordenes-trabajo')
        .send({
          busId: bus.id,
          descripcion: 'Intento de enviar campos internos protegidos',
          estado: 'CERRADA',
          fechaCierre: new Date().toISOString(),
          novedadId: randomUUID(),
          programacionMantenimientoId: randomUUID(),
          tecnicoAsignadoId: fixture.mecanicoId,
          tipo: 'CORRECTIVA',
        })
        .expect(400)
    },
    rf04TestTimeout,
  )

  it(
    'exposes RF-02 and RF-03 orders in RF-04 preserving source and bus links',
    async () => {
      const admin = await loginAgent(fixture.adminEmail)
      const noveltyBus = await createBus()
      const preventiveBus = await createBus()
      const journeyId = track('jornadas')
      const noveltyId = track('novedades')
      const journeyStartedAt = new Date(Date.now() - 7_140_000)
      const noveltyAt = new Date(Date.now() - 3_900_000)
      const novelty = await prisma.$transaction(async (tx) => {
        await tx.jornadaOperativa.create({
          data: {
            busId: noveltyBus.id,
            conductorId: fixture.conductorId,
            estado: 'EN_CURSO',
            finProgramado: new Date(Date.now() + 60_000),
            id: journeyId,
            iniciadaPorId: fixture.conductorId,
            inicioProgramado: new Date(Date.now() - 7_200_000),
            inicioReal: journeyStartedAt,
            programadaPorId: fixture.despachadorId,
          },
        })
        await tx.lecturaKilometraje.create({
          data: {
            busId: noveltyBus.id,
            fechaLectura: journeyStartedAt,
            jornadaOperativaId: journeyId,
            kilometrajeAnterior: 20000,
            kilometrajeNuevo: 20000,
            registradoPorId: fixture.conductorId,
            tipo: 'INICIO_JORNADA',
          },
        })
        const noveltyReading = await tx.lecturaKilometraje.create({
          data: {
            busId: noveltyBus.id,
            fechaLectura: noveltyAt,
            jornadaOperativaId: journeyId,
            kilometrajeAnterior: 20000,
            kilometrajeNuevo: 20000,
            registradoPorId: fixture.conductorId,
            tipo: 'NOVEDAD',
          },
        })
        return tx.novedad.create({
          data: {
            afectaOperacion: true,
            bloqueaDisponibilidad: true,
            busId: noveltyBus.id,
            conductorId: fixture.conductorId,
            descripcion: 'Novedad operativa que origina una orden correctiva RF-04',
            fechaOcurrencia: noveltyAt,
            id: noveltyId,
            jornadaOperativaId: journeyId,
            lecturaKilometrajeId: noveltyReading.id,
            tipo: 'Falla mecanica RF-04',
          },
        })
      })
      const schedule = await createEligibleSchedule(fixture, preventiveBus.id)

      const corrective = await admin
        .post(`/novedades/${novelty.id}/convertir-orden`)
        .send({
          observacion: 'Convertida para seguimiento RF-04',
          prioridad: 'ALTA',
        })
        .expect(200)
      const correctiveOrderId = corrective.body.data.orden.id as string
      created.ordenes.push(correctiveOrderId)

      const preventive = await admin
        .post(`/mantenimiento-preventivo/programaciones/${schedule.id}/generar-orden`)
        .send({
          descripcionOrden: 'Orden preventiva disponible en RF-04',
          observacion: 'Generada para seguimiento RF-04',
          prioridad: 'MEDIA',
        })
        .expect(200)
      const preventiveOrderId = preventive.body.data.orden.id as string
      created.ordenes.push(preventiveOrderId)

      const noveltyDetail = await admin.get(`/ordenes-trabajo/${correctiveOrderId}`).expect(200)
      const preventiveDetail = await admin.get(`/ordenes-trabajo/${preventiveOrderId}`).expect(200)

      expect(noveltyDetail.body.data.orden.bus.id).toBe(noveltyBus.id)
      expect(noveltyDetail.body.data.orden.novedad.id).toBe(novelty.id)
      expect(noveltyDetail.body.data.orden.jornadaOperativa).toEqual(
        expect.objectContaining({ estado: 'EN_CURSO', id: journeyId }),
      )
      expect(noveltyDetail.body.data.orden.origen).toBe('NOVEDAD')
      expect(noveltyDetail.body.data.orden.tipo).toBe('CORRECTIVA')
      expect(preventiveDetail.body.data.orden.bus.id).toBe(preventiveBus.id)
      expect(preventiveDetail.body.data.orden.programacionMantenimiento.id).toBe(schedule.id)
      expect(preventiveDetail.body.data.orden.kilometrajeObjetivoPreventivo).toBe(19900)
      expect(preventiveDetail.body.data.orden.origen).toBe('PREVENTIVO')
      expect(preventiveDetail.body.data.orden.tipo).toBe('PREVENTIVA')

      const filtered = await admin
        .get('/ordenes-trabajo')
        .query({ busId: noveltyBus.id, origen: 'NOVEDAD', tipo: 'CORRECTIVA' })
        .expect(200)

      expect(filtered.body.data.ordenes.map((item: { id: string }) => item.id)).toContain(
        correctiveOrderId,
      )
    },
    rf04TestTimeout,
  )

  it(
    'lists, filters and limits mechanics to their assigned orders',
    async () => {
      const admin = await loginAgent(fixture.adminEmail)
      const mecanico = await loginAgent(fixture.mecanicoEmail)
      const bus = await createBus({ codigoInterno: uniqueBusCode('BUS-FILTRO') })
      const ownOrder = await createPendingCorrectiveOrder(fixture, {
        busId: bus.id,
        descripcion: 'Orden propia filtrable por placa y mecanico',
      })
      const foreignOrder = await createPendingCorrectiveOrder(fixture)

      await admin
        .post(`/ordenes-trabajo/${ownOrder.id}/asignar`)
        .send({ tecnicoId: fixture.mecanicoId })
        .expect(200)
      await admin
        .post(`/ordenes-trabajo/${foreignOrder.id}/asignar`)
        .send({ tecnicoId: fixture.mecanicoAltId })
        .expect(200)

      const adminList = await admin
        .get('/ordenes-trabajo')
        .query({
          busqueda: bus.placa,
          estado: 'ASIGNADA',
          limite: 5,
          pagina: 1,
          tecnicoId: fixture.mecanicoId,
        })
        .expect(200)
      const ownList = await mecanico.get('/ordenes-trabajo/mis-ordenes').expect(200)
      const ownIds = ownList.body.data.ordenes.map((item: { id: string }) => item.id)
      const summary = await mecanico.get('/ordenes-trabajo/resumen').expect(200)

      expect(adminList.body.data.ordenes).toHaveLength(1)
      expect(adminList.body.data.ordenes[0].id).toBe(ownOrder.id)
      expect(ownIds).toContain(ownOrder.id)
      expect(ownIds).not.toContain(foreignOrder.id)
      expect(summary.body.data.total).toBeGreaterThanOrEqual(1)
      expect(JSON.stringify(adminList.body)).not.toContain('contrasena')

      await mecanico.get(`/ordenes-trabajo/${foreignOrder.id}`).expect(403)
    },
    rf04TestTimeout,
  )

  it(
    'assigns and reassigns mechanics with traceability and immediate permission changes',
    async () => {
      const admin = await loginAgent(fixture.adminEmail)
      const oldMechanic = await loginAgent(fixture.mecanicoEmail)
      const newMechanic = await loginAgent(fixture.mecanicoAltEmail)
      const order = await createPendingCorrectiveOrder(fixture)

      await admin
        .post(`/ordenes-trabajo/${order.id}/asignar`)
        .send({ tecnicoId: fixture.conductorId })
        .expect(400)
      await admin
        .post(`/ordenes-trabajo/${order.id}/asignar`)
        .send({ tecnicoId: fixture.inactiveMechanicId })
        .expect(400)

      const assigned = await admin
        .post(`/ordenes-trabajo/${order.id}/asignar`)
        .send({
          observacion: 'Asignacion inicial RF-04',
          tecnicoId: fixture.mecanicoId,
        })
        .expect(200)

      expect(assigned.body.data.orden.estado).toBe('ASIGNADA')
      expect(assigned.body.data.orden.tecnicoAsignado.id).toBe(fixture.mecanicoId)

      await admin
        .post(`/ordenes-trabajo/${order.id}/asignar`)
        .send({ tecnicoId: fixture.mecanicoId })
        .expect(400)
      await admin
        .post(`/ordenes-trabajo/${order.id}/reasignar`)
        .send({ motivo: '  ', tecnicoId: fixture.mecanicoAltId })
        .expect(400)
      await admin
        .post(`/ordenes-trabajo/${order.id}/reasignar`)
        .send({ motivo: 'Mismo mecanico no permitido', tecnicoId: fixture.mecanicoId })
        .expect(400)

      const reassigned = await admin
        .post(`/ordenes-trabajo/${order.id}/reasignar`)
        .send({
          motivo: 'Balance de carga del taller',
          tecnicoId: fixture.mecanicoAltId,
        })
        .expect(200)

      expect(reassigned.body.data.orden.tecnicoAsignado.id).toBe(fixture.mecanicoAltId)
      expect(reassigned.body.data.orden.reasignaciones).toHaveLength(1)
      expect(reassigned.body.data.orden.reasignaciones[0].tecnicoAnterior.id).toBe(
        fixture.mecanicoId,
      )

      await oldMechanic.post(`/ordenes-trabajo/${order.id}/iniciar`).send({}).expect(403)
      await newMechanic.post(`/ordenes-trabajo/${order.id}/iniciar`).send({}).expect(200)
    },
    rf04TestTimeout,
  )

  it(
    'starts execution, records diagnostics, observations and activities for the assigned mechanic only',
    async () => {
      const { mecanico, order } = await prepareExecutionOrder(fixture)
      const foreignMechanic = await loginAgent(fixture.mecanicoAltEmail)

      await foreignMechanic
        .patch(`/ordenes-trabajo/${order.id}/intervencion`)
        .send({ diagnostico: 'Intento de escritura ajena' })
        .expect(403)
      await mecanico.post(`/ordenes-trabajo/${order.id}/iniciar`).send({}).expect(400)
      await mecanico
        .patch(`/ordenes-trabajo/${order.id}/intervencion`)
        .send({ diagnostico: '   ' })
        .expect(400)

      const updated = await mecanico
        .patch(`/ordenes-trabajo/${order.id}/intervencion`)
        .send({
          diagnostico: 'Diagnostico tecnico registrado en RF-04',
          observaciones: 'Observaciones tecnicas registradas en RF-04',
        })
        .expect(200)

      expect(updated.body.data.orden.estado).toBe('EN_EJECUCION')
      expect(updated.body.data.orden.intervenciones[0].diagnostico).toBe(
        'Diagnostico tecnico registrado en RF-04',
      )

      await mecanico
        .post(`/ordenes-trabajo/${order.id}/actividades`)
        .send({ descripcion: '  ' })
        .expect(400)

      const activity = await mecanico
        .post(`/ordenes-trabajo/${order.id}/actividades`)
        .send({ descripcion: 'Revision de sistema de frenos y prueba funcional' })
        .expect(201)

      expect(activity.body.data.orden.intervenciones[0].actividades).toHaveLength(1)
      expect(activity.body.data.orden.intervenciones[0].actividades[0].registradaPor.id).toBe(
        fixture.mecanicoId,
      )
    },
    rf04TestTimeout,
  )

  it(
    'registers spare-part consumptions with stock, movement, cost and idempotency guarantees',
    async () => {
      const { mecanico, order } = await prepareCompletableOrder(fixture)
      const repuesto = await createRepuesto({ costoUnitario: '123.45', stockActual: '2' })
      await allowPartForBus(repuesto.id, order.busId, fixture.adminId)
      const inactivePart = await createRepuesto({ estado: 'INACTIVO', stockActual: '5' })
      const claveIdempotencia = randomUUID()

      await mecanico
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          cantidad: '1.5',
          costoUnitario: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: repuesto.id,
        })
        .expect(400)

      const first = await mecanico
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          cantidad: '1.5',
          claveIdempotencia,
          repuestoId: repuesto.id,
        })
        .expect(201)

      expect(first.body.data.consumo.costoUnitario).toBe('123.45')
      expect(first.body.data.consumo.subtotal).toBe('185.18')
      expect(first.body.data.consumo.movimientoInventario.tipo).toBe('CONSUMO')
      expect(first.body.data.orden.costoTotal).toBe('185.18')

      const repeated = await mecanico
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          cantidad: '1.5',
          claveIdempotencia,
          repuestoId: repuesto.id,
        })
        .expect(201)

      expect(repeated.headers['idempotency-replayed']).toBe('true')
      expect(repeated.body).toEqual(first.body)
      expect(repeated.body.data.consumo.id).toBe(first.body.data.consumo.id)

      await mecanico
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          cantidad: '0',
          claveIdempotencia: randomUUID(),
          repuestoId: repuesto.id,
        })
        .expect(400)
      await mecanico
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: inactivePart.id,
        })
        .expect(400)
      await mecanico
        .post(`/ordenes-trabajo/${order.id}/consumos`)
        .send({
          cantidad: '0.6',
          claveIdempotencia: randomUUID(),
          repuestoId: repuesto.id,
        })
        .expect(400)

      const [storedPart, consumptionCount, movementCount, orderReloaded] = await Promise.all([
        prisma.repuesto.findUniqueOrThrow({ where: { id: repuesto.id } }),
        prisma.consumoRepuesto.count({
          where: { ordenTrabajoId: order.id, repuestoId: repuesto.id },
        }),
        prisma.movimientoInventario.count({
          where: {
            consumoRepuesto: {
              ordenTrabajoId: order.id,
              repuestoId: repuesto.id,
            },
            tipo: 'CONSUMO',
          },
        }),
        prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: order.id } }),
      ])

      expect(storedPart.stockActual.toString()).toBe('0.5')
      expect(consumptionCount).toBe(1)
      expect(movementCount).toBe(1)
      expect(orderReloaded.costoTotal.toString()).toBe('185.18')
    },
    rf04TestTimeout,
  )

  it(
    'serializes concurrent stock consumption and concurrent incompatible assignment',
    async () => {
      const adminA = await loginAgent(fixture.adminEmail)
      const adminB = await loginAgent(fixture.adminEmail)
      const orderToAssign = await createPendingCorrectiveOrder(fixture)

      const assignmentResults = await Promise.all([
        adminA
          .post(`/ordenes-trabajo/${orderToAssign.id}/asignar`)
          .send({ tecnicoId: fixture.mecanicoId }),
        adminB
          .post(`/ordenes-trabajo/${orderToAssign.id}/asignar`)
          .send({ tecnicoId: fixture.mecanicoAltId }),
      ])
      const assignmentStatuses = assignmentResults.map((response) => response.status).sort()
      const assignmentHistoryCount = await prisma.ordenEstadoHistorial.count({
        where: {
          estadoNuevo: 'ASIGNADA',
          ordenTrabajoId: orderToAssign.id,
        },
      })

      expect(assignmentStatuses).toEqual([200, 400])
      expect(assignmentHistoryCount).toBe(1)

      const { mecanico, order } = await prepareCompletableOrder(fixture)
      const repuesto = await createRepuesto({ stockActual: '1' })
      await allowPartForBus(repuesto.id, order.busId, fixture.adminId)
      const consumptionResults = await Promise.all([
        mecanico.post(`/ordenes-trabajo/${order.id}/consumos`).send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: repuesto.id,
        }),
        mecanico.post(`/ordenes-trabajo/${order.id}/consumos`).send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: repuesto.id,
        }),
      ])
      const consumptionStatuses = consumptionResults.map((response) => response.status).sort()
      const [stock, consumptionCount] = await Promise.all([
        prisma.repuesto.findUniqueOrThrow({ where: { id: repuesto.id } }),
        prisma.consumoRepuesto.count({
          where: { ordenTrabajoId: order.id, repuestoId: repuesto.id },
        }),
      ])

      expect(consumptionStatuses).toEqual([201, 400])
      expect(stock.stockActual.toString()).toBe('0')
      expect(consumptionCount).toBe(1)
    },
    rf04TestTimeout,
  )

  it(
    'enforces technical completion preconditions and blocks technical writes afterwards',
    async () => {
      const missingActivity = await prepareExecutionOrder(fixture)

      await missingActivity.mecanico
        .patch(`/ordenes-trabajo/${missingActivity.order.id}/intervencion`)
        .send({ diagnostico: 'Diagnostico sin actividad' })
        .expect(200)
      await missingActivity.mecanico
        .post(`/ordenes-trabajo/${missingActivity.order.id}/completar`)
        .send({})
        .expect(400)

      const missingDiagnosis = await prepareExecutionOrder(fixture)

      await missingDiagnosis.mecanico
        .post(`/ordenes-trabajo/${missingDiagnosis.order.id}/actividades`)
        .send({ descripcion: 'Actividad sin diagnostico correctivo' })
        .expect(201)
      await missingDiagnosis.mecanico
        .post(`/ordenes-trabajo/${missingDiagnosis.order.id}/completar`)
        .send({})
        .expect(400)

      const complete = await prepareCompletableOrder(fixture)
      const completed = await complete.mecanico
        .post(`/ordenes-trabajo/${complete.order.id}/completar`)
        .send({ observacion: 'Completado tecnico validado' })
        .expect(200)

      expect(completed.body.data.orden.estado).toBe('COMPLETADA_TECNICO')
      expect(completed.body.data.orden.fechaCompletadaTecnico).toBeTruthy()
      await complete.mecanico
        .post(`/ordenes-trabajo/${complete.order.id}/actividades`)
        .send({ descripcion: 'Actividad posterior no permitida' })
        .expect(400)
      await complete.mecanico
        .post(`/ordenes-trabajo/${complete.order.id}/consumos`)
        .send({
          cantidad: '1',
          claveIdempotencia: randomUUID(),
          repuestoId: (await createRepuesto()).id,
        })
        .expect(400)
    },
    rf04TestTimeout,
  )

  it(
    'returns orders for correction, resumes them and closes administratively as terminal',
    async () => {
      const context = await prepareCompletableOrder(fixture)
      const completed = await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/completar`)
        .send({})
        .expect(200)

      expect(completed.body.data.orden.estado).toBe('COMPLETADA_TECNICO')

      await context.admin
        .post(`/ordenes-trabajo/${context.order.id}/devolver`)
        .send({ motivo: '  ' })
        .expect(400)

      const returned = await context.admin
        .post(`/ordenes-trabajo/${context.order.id}/devolver`)
        .send({ motivo: 'Corregir evidencia tecnica antes del cierre' })
        .expect(200)

      expect(returned.body.data.orden.estado).toBe('DEVUELTA_CORRECCION')
      expect(returned.body.data.orden.motivoDevolucionActual).toBe(
        'Corregir evidencia tecnica antes del cierre',
      )

      const resumed = await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/reanudar`)
        .send({ observacion: 'Correccion reanudada' })
        .expect(200)

      expect(resumed.body.data.orden.estado).toBe('EN_EJECUCION')
      expect(resumed.body.data.orden.intervenciones.length).toBeGreaterThanOrEqual(2)

      await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/actividades`)
        .send({ descripcion: 'Correccion realizada despues de devolucion administrativa' })
        .expect(201)
      await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/completar`)
        .send({ observacion: 'Segundo completado tecnico' })
        .expect(200)

      const closeResults = await Promise.all([
        context.admin.post(`/ordenes-trabajo/${context.order.id}/cerrar`).send({
          observacion: 'Cierre administrativo final',
        }),
        context.admin.post(`/ordenes-trabajo/${context.order.id}/cerrar`).send({
          observacion: 'Doble cierre no permitido',
        }),
      ])
      const closeStatuses = closeResults.map((response) => response.status).sort()
      const closedDetail = await context.admin
        .get(`/ordenes-trabajo/${context.order.id}`)
        .expect(200)

      expect(closeStatuses).toEqual([200, 400])
      expect(closedDetail.body.data.orden.estado).toBe('CERRADA')
      expect(closedDetail.body.data.orden.fechaCierre).toBeTruthy()
      expect(closedDetail.body.data.orden.cerradaPor.id).toBe(fixture.adminId)
      expect(
        closedDetail.body.data.orden.historialEstados.map(
          (history: { estadoNuevo: string }) => history.estadoNuevo,
        ),
      ).toEqual([
        'PENDIENTE_ASIGNACION',
        'ASIGNADA',
        'EN_EJECUCION',
        'COMPLETADA_TECNICO',
        'DEVUELTA_CORRECCION',
        'EN_EJECUCION',
        'COMPLETADA_TECNICO',
        'CERRADA',
      ])

      await context.admin
        .post(`/ordenes-trabajo/${context.order.id}/reasignar`)
        .send({ motivo: 'Intento sobre cerrada', tecnicoId: fixture.mecanicoAltId })
        .expect(400)
      await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/actividades`)
        .send({ descripcion: 'Intento sobre cerrada' })
        .expect(400)
      await context.admin
        .post(`/ordenes-trabajo/${context.order.id}/lecturas`)
        .send({
          fechaEvento: new Date().toISOString(),
          kilometraje: 20001,
          tipo: 'CIERRE_MANTENIMIENTO',
        })
        .expect(400)
    },
    rf04TestTimeout,
  )

  it(
    'registra lecturas tecnicas con fecha de evento, intervencion y replay idempotente',
    async () => {
      const context = await prepareCompletableOrder(fixture)
      const ingresoAt = new Date(Date.now() - 120_000)
      const ingresoKey = randomUUID()

      const ingreso = await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/lecturas`)
        .set('Idempotency-Key', ingresoKey)
        .send({
          fechaEvento: ingresoAt.toISOString(),
          kilometraje: 20001,
          motivo: 'Ingreso tecnico al taller',
          tipo: 'INGRESO_TALLER',
        })
        .expect(201)

      const replay = await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/lecturas`)
        .set('Idempotency-Key', ingresoKey)
        .send({
          fechaEvento: ingresoAt.toISOString(),
          kilometraje: 20001,
          motivo: 'Ingreso tecnico al taller',
          tipo: 'INGRESO_TALLER',
        })
        .expect(201)

      expect(replay.headers['idempotency-replayed']).toBe('true')
      expect(replay.body).toEqual(ingreso.body)

      const revisionAt = new Date(Date.now() - 60_000)
      const revision = await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/lecturas`)
        .send({
          fechaEvento: revisionAt.toISOString(),
          kilometraje: 20002,
          tipo: 'REVISION_TECNICA',
        })
        .expect(201)

      expect(revision.body.data.orden.lecturasTecnicas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fechaLectura: ingresoAt.toISOString(),
            intervencionId: null,
            kilometraje: 20001,
            tipo: 'INGRESO_TALLER',
          }),
          expect.objectContaining({
            fechaLectura: revisionAt.toISOString(),
            intervencionId: expect.any(String),
            kilometraje: 20002,
            tipo: 'REVISION_TECNICA',
          }),
        ]),
      )

      const readingCount = await prisma.lecturaKilometraje.count({
        where: { ordenTrabajoId: context.order.id },
      })
      expect(readingCount).toBe(2)

      const bus = await prisma.bus.findUniqueOrThrow({ where: { id: context.order.busId } })
      expect(bus.kilometrajeActual).toBe(20002)
    },
    rf04TestTimeout,
  )

  it(
    'rechaza lecturas de revision sin intervencion activa y fechas futuras sin mutar datos',
    async () => {
      const order = await createPendingCorrectiveOrder(fixture)
      const admin = await loginAgent(fixture.adminEmail)
      const mecanico = await loginAgent(fixture.mecanicoEmail)

      await admin
        .post(`/ordenes-trabajo/${order.id}/asignar`)
        .send({ tecnicoId: fixture.mecanicoId })
        .expect(200)

      await mecanico
        .post(`/ordenes-trabajo/${order.id}/lecturas`)
        .send({
          fechaEvento: new Date(Date.now() - 60_000).toISOString(),
          kilometraje: 20001,
          tipo: 'REVISION_TECNICA',
        })
        .expect(400)

      await mecanico
        .post(`/ordenes-trabajo/${order.id}/lecturas`)
        .send({
          fechaEvento: new Date(Date.now() + 60_000).toISOString(),
          kilometraje: 20001,
          tipo: 'INGRESO_TALLER',
        })
        .expect(400)

      await expect(
        prisma.lecturaKilometraje.count({ where: { ordenTrabajoId: order.id } }),
      ).resolves.toBe(0)
    },
    rf04TestTimeout,
  )

  it(
    'conserva el historial de intervenciones al reasignar una orden en ejecucion',
    async () => {
      const context = await prepareExecutionOrder(fixture)

      await context.mecanico
        .patch(`/ordenes-trabajo/${context.order.id}/intervencion`)
        .send({ diagnostico: 'Diagnostico previo a reasignacion' })
        .expect(200)
      await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/actividades`)
        .send({ descripcion: 'Actividad del primer mecanico' })
        .expect(201)

      const reassigned = await context.admin
        .post(`/ordenes-trabajo/${context.order.id}/reasignar`)
        .send({ motivo: 'Relevo tecnico durante ejecucion', tecnicoId: fixture.mecanicoAltId })
        .expect(200)

      expect(reassigned.body.data.orden.tecnicoAsignado.id).toBe(fixture.mecanicoAltId)
      expect(reassigned.body.data.orden.intervenciones).toHaveLength(2)
      expect(reassigned.body.data.orden.intervenciones[0].fechaFin).toBeTruthy()
      expect(reassigned.body.data.orden.intervenciones[0].diagnostico).toBe(
        'Diagnostico previo a reasignacion',
      )
      expect(reassigned.body.data.orden.intervenciones[0].actividades).toEqual([
        expect.objectContaining({ descripcion: 'Actividad del primer mecanico' }),
      ])
      expect(reassigned.body.data.orden.intervenciones[1].fechaFin).toBeNull()
      expect(reassigned.body.data.orden.reasignaciones).toEqual([
        expect.objectContaining({
          tecnicoAnterior: expect.objectContaining({ id: fixture.mecanicoId }),
          tecnicoNuevo: expect.objectContaining({ id: fixture.mecanicoAltId }),
        }),
      ])
    },
    rf04TestTimeout,
  )

  it(
    'calcula disponibilidad al cierre conservando restricciones restantes',
    async () => {
      const bus = await createBus()
      const novelty = await createNovelty(fixture, bus.id)
      await prisma.novedad.update({
        where: { id: novelty.id },
        data: { afectaOperacion: true, bloqueaDisponibilidad: true },
      })
      const context = await prepareCompletableOrder(fixture)

      // Reubica el escenario de la orden al bus que conserva la novedad.
      await prisma.ordenTrabajo.update({
        where: { id: context.order.id },
        data: { busId: bus.id },
      })
      await context.mecanico
        .post(`/ordenes-trabajo/${context.order.id}/completar`)
        .send({})
        .expect(200)

      const closed = await context.admin
        .post(`/ordenes-trabajo/${context.order.id}/cerrar`)
        .send({ observacion: 'Cierre con novedad bloqueante restante' })
      expect(closed.status, JSON.stringify(closed.body)).toBe(200)

      expect(closed.body.data.orden.disponibilidadAlCierre).toBe(false)
      expect(
        closed.body.data.orden.historialEstados.map(
          (history: { estadoNuevo: string }) => history.estadoNuevo,
        ),
      ).toContain('CERRADA')

      const dispatcher = await loginAgent(fixture.despachadorEmail)
      const projectionResponse = await dispatcher.get('/ordenes-trabajo/despacho').expect(200)
      const closedProjection = projectionResponse.body.data.ordenes.find(
        (item: { orden: { id: string } }) => item.orden.id === context.order.id,
      )
      expect(closedProjection).toEqual(
        expect.objectContaining({
          orden: expect.objectContaining({
            disponibilidadAlCierre: false,
            estado: 'CERRADA',
            fechaCierre: expect.any(String),
          }),
        }),
      )
      expect(JSON.stringify(closedProjection)).not.toMatch(
        /diagnostico|actividad|intervencion|consumo|costo|planAplicado/i,
      )
    },
    rf04TestTimeout,
  )

  it(
    'entrega al Despachador solo una proyeccion operativa sin datos tecnicos o administrativos',
    async () => {
      const context = await prepareExecutionOrder(fixture)
      const dispatcher = await loginAgent(fixture.despachadorEmail)

      const response = await dispatcher.get('/ordenes-trabajo/despacho').expect(200)
      const projection = response.body.data.ordenes.find(
        (item: { orden: { id: string } }) => item.orden.id === context.order.id,
      )

      expect(projection).toEqual(
        expect.objectContaining({
          disponibilidad: expect.objectContaining({
            causas: expect.any(Array),
            disponible: expect.any(Boolean),
          }),
          orden: expect.objectContaining({
            bus: expect.objectContaining({ id: context.order.busId }),
            id: context.order.id,
          }),
        }),
      )
      const serialized = JSON.stringify(projection)
      expect(serialized).not.toMatch(
        /diagnostico|actividad|intervencion|consumo|costo|planAplicado/i,
      )
      await dispatcher.get(`/ordenes-trabajo/${context.order.id}`).expect(403)
    },
    rf04TestTimeout,
  )

  it(
    'serializa lecturas tecnicas concurrentes sin retroceder ni duplicar el odometro',
    async () => {
      const bus = await createBus()
      const first = await createPendingCorrectiveOrder(fixture, { busId: bus.id })
      const second = await createPendingCorrectiveOrder(fixture, { busId: bus.id })
      const admin = await loginAgent(fixture.adminEmail)
      const mecanico = await loginAgent(fixture.mecanicoEmail)

      await admin
        .post(`/ordenes-trabajo/${first.id}/asignar`)
        .send({ tecnicoId: fixture.mecanicoId })
        .expect(200)
      await admin
        .post(`/ordenes-trabajo/${second.id}/asignar`)
        .send({ tecnicoId: fixture.mecanicoId })
        .expect(200)
      await mecanico.post(`/ordenes-trabajo/${first.id}/iniciar`).send({}).expect(200)
      await mecanico.post(`/ordenes-trabajo/${second.id}/iniciar`).send({}).expect(200)

      const eventBase = Date.now() - 120_000
      const results = await Promise.all([
        mecanico.post(`/ordenes-trabajo/${first.id}/lecturas`).send({
          fechaEvento: new Date(eventBase).toISOString(),
          kilometraje: 20001,
          tipo: 'INGRESO_TALLER',
        }),
        mecanico.post(`/ordenes-trabajo/${second.id}/lecturas`).send({
          fechaEvento: new Date(eventBase + 1_000).toISOString(),
          kilometraje: 20002,
          tipo: 'INGRESO_TALLER',
        }),
      ])

      expect(results.map((result) => result.status).sort()).toEqual([201, 201])
      const readings = await prisma.lecturaKilometraje.findMany({
        orderBy: { fechaLectura: 'asc' },
        where: { busId: bus.id },
      })
      expect(readings.map((reading) => reading.kilometrajeNuevo)).toEqual([20001, 20002])
      expect(readings.map((reading) => reading.kilometrajeAnterior)).toEqual([20000, 20001])
      const reloadedBus = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })
      expect(reloadedBus.kilometrajeActual).toBe(20002)
    },
    rf04TestTimeout,
  )

  it(
    'closes preventive orders without creating RF-05 or RF-06 behavior',
    async () => {
      const admin = await loginAgent(fixture.adminEmail)
      const mecanico = await loginAgent(fixture.mecanicoEmail)
      const bus = await createBus({ kilometrajeActual: 20000 })
      const schedule = await prisma.programacionMantenimiento.create({
        data: {
          id: track('programaciones'),
          actividad: 'Preventiva para cierre administrativo RF-04',
          busId: bus.id,
          creadaPorId: fixture.adminId,
          criterio: 'FECHA',
          fechaProgramada: dateOnlyFromTodayOffset(-1),
          tipo: 'Preventiva cierre',
        },
      })

      const generated = await admin
        .post(`/mantenimiento-preventivo/programaciones/${schedule.id}/generar-orden`)
        .send({ prioridad: 'MEDIA' })
        .expect(200)
      const orderId = generated.body.data.orden.id as string
      created.ordenes.push(orderId)

      await admin
        .post(`/ordenes-trabajo/${orderId}/asignar`)
        .send({ tecnicoId: fixture.mecanicoId })
        .expect(200)
      await mecanico.post(`/ordenes-trabajo/${orderId}/iniciar`).send({}).expect(200)
      await mecanico
        .post(`/ordenes-trabajo/${orderId}/actividades`)
        .send({ descripcion: 'Actividad preventiva ejecutada' })
        .expect(201)
      await mecanico.post(`/ordenes-trabajo/${orderId}/completar`).send({}).expect(200)

      const closed = await admin
        .post(`/ordenes-trabajo/${orderId}/cerrar`)
        .send({ observacion: 'Cierre preventivo RF-04' })
        .expect(200)
      const reloadedSchedule = await prisma.programacionMantenimiento.findUniqueOrThrow({
        where: { id: schedule.id },
      })
      const activeOrderCount = await prisma.ordenTrabajo.count({
        where: {
          estado: {
            not: 'CERRADA',
          },
          programacionMantenimientoId: schedule.id,
        },
      })

      expect(closed.body.data.orden.estado).toBe('CERRADA')
      expect(closed.body.data.orden.programacionMantenimiento.id).toBe(schedule.id)
      expect(reloadedSchedule.fechaProgramada?.toISOString().slice(0, 10)).toBe(
        schedule.fechaProgramada?.toISOString().slice(0, 10),
      )
      expect(activeOrderCount).toBe(0)
    },
    rf04TestTimeout,
  )
})
