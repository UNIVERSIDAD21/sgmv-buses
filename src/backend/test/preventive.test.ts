import { createHmac, randomUUID } from 'node:crypto'

import { PrismaClient, type Prisma, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { classifyPreventiveSchedule } from '../src/preventive/preventive.classification.js'
import { PreventiveService } from '../src/preventive/preventive.service.js'

const prisma = new PrismaClient()
const describeDb = process.env.DATABASE_URL ? describe : describe.skip
const password = 'Clave-demo-segura-123'
const fixedNow = new Date('2026-08-27T15:00:00.000Z')
const thresholds = {
  soonDays: 7,
  soonKm: 500,
  timeZone: 'America/Bogota',
}

function databaseSchemaName() {
  const datasourceUrl = process.env.DATABASE_URL

  if (!datasourceUrl) {
    return 'public'
  }

  const schema = new URL(datasourceUrl).searchParams.get('schema') ?? 'public'

  if (!/^[A-Za-z0-9_]+$/.test(schema)) {
    throw new Error('DATABASE_URL schema contains unsupported characters')
  }

  return schema
}

function tableName(table: string) {
  return `"${databaseSchemaName()}"."${table}"`
}

const created = {
  asignaciones: [] as string[],
  buses: [] as string[],
  ordenes: [] as string[],
  programaciones: [] as string[],
  usuarios: [] as string[],
}

interface PreventiveFixture {
  adminEmail: string
  adminId: string
  conductorEmail: string
  conductorId: string
  inactiveAdminEmail: string
  mecanicoEmail: string
  mecanicoId: string
}

function shortCode() {
  return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}

function uniquePlate(prefix = 'P') {
  return `${prefix}${shortCode().slice(0, 6)}`
}

function uniqueBusCode(prefix = 'PREV-BUS') {
  return `${prefix}-${shortCode()}`
}

function dateAtOffset(days: number) {
  return new Date(Date.UTC(2026, 7, 27 + days))
}

function isoDateFromTodayOffset(days: number) {
  const target = new Date(Date.now() + days * 86_400_000)

  return target.toISOString().slice(0, 10)
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
      update: { nombre: 'Mec\u00e1nico' },
      create: {
        codigo: 'MECANICO',
        nombre: 'Mec\u00e1nico',
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

async function createUser(email: string, role: Rol, estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO') {
  const id = randomUUID()
  created.usuarios.push(id)

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

async function createFixture(): Promise<PreventiveFixture> {
  const roles = await ensureRoles()
  const suffix = shortCode().toLowerCase()
  const admin = await createUser(`prev-admin-${suffix}@test.sgmv.local`, roles.admin)
  const inactiveAdmin = await createUser(
    `prev-admin-inactive-${suffix}@test.sgmv.local`,
    roles.admin,
    'INACTIVO',
  )
  const mecanico = await createUser(`prev-mecanico-${suffix}@test.sgmv.local`, roles.mecanico)
  const conductor = await createUser(`prev-conductor-${suffix}@test.sgmv.local`, roles.conductor)

  return {
    adminEmail: admin.email,
    adminId: admin.id,
    conductorEmail: conductor.email,
    conductorId: conductor.id,
    inactiveAdminEmail: inactiveAdmin.email,
    mecanicoEmail: mecanico.email,
    mecanicoId: mecanico.id,
  }
}

async function createBus(overrides: Partial<Prisma.BusCreateInput> = {}) {
  const id = randomUUID()
  created.buses.push(id)

  return prisma.bus.create({
    data: {
      id,
      anio: 2021,
      codigoInterno: uniqueBusCode(),
      kilometrajeActual: 10000,
      marca: 'Marca Preventiva',
      modelo: 'Modelo Preventivo',
      placa: uniquePlate(),
      ...overrides,
    },
  })
}

async function createSchedule(
  busId: string,
  adminId: string,
  overrides: Partial<Prisma.ProgramacionMantenimientoUncheckedCreateInput> = {},
) {
  const id = randomUUID()
  created.programaciones.push(id)

  return prisma.programacionMantenimiento.create({
    data: {
      id,
      actividad: 'Revision preventiva creada para pruebas automatizadas RF-03',
      busId,
      creadaPorId: adminId,
      criterio: 'KILOMETRAJE',
      kilometrajeObjetivo: 10400,
      tipo: 'Revision preventiva',
      ...overrides,
    },
  })
}

async function loginAgent(email: string) {
  const agent = request.agent(createApp())

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

async function cleanup() {
  const linkedOrderIds = (
    await prisma.ordenTrabajo.findMany({
      select: { id: true },
      where: {
        programacionMantenimientoId: {
          in: created.programaciones,
        },
      },
    })
  ).map((order) => order.id)
  const uniqueOrderIds = [...new Set([...created.ordenes, ...linkedOrderIds])]

  await prisma.$transaction(
    async (tx) => {
      await tx.ordenEstadoHistorial.deleteMany({
        where: {
          ordenTrabajoId: {
            in: uniqueOrderIds,
          },
        },
      })
      await tx.ordenTrabajo.deleteMany({
        where: {
          id: {
            in: uniqueOrderIds,
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

describe('Preventive classification rule', () => {
  it('classifies date, mileage and combined criteria with approved boundaries', () => {
    const byDate = (days: number) =>
      classifyPreventiveSchedule({
        fechaProgramada: dateAtOffset(days),
        kilometrajeActual: 10000,
        kilometrajeObjetivo: null,
        now: fixedNow,
        thresholds,
      }).estado

    expect(byDate(8)).toBe('VIGENTE')
    expect(byDate(7)).toBe('PROXIMO')
    expect(byDate(1)).toBe('PROXIMO')
    expect(byDate(0)).toBe('PROXIMO')
    expect(byDate(-1)).toBe('VENCIDO')

    const byMileage = (target: number) =>
      classifyPreventiveSchedule({
        fechaProgramada: null,
        kilometrajeActual: 10000,
        kilometrajeObjetivo: target,
        now: fixedNow,
        thresholds,
      }).estado

    expect(byMileage(10501)).toBe('VIGENTE')
    expect(byMileage(10500)).toBe('PROXIMO')
    expect(byMileage(10001)).toBe('PROXIMO')
    expect(byMileage(10000)).toBe('VENCIDO')
    expect(byMileage(9999)).toBe('VENCIDO')

    expect(
      classifyPreventiveSchedule({
        fechaProgramada: dateAtOffset(-1),
        kilometrajeActual: 10000,
        kilometrajeObjetivo: 10600,
        now: fixedNow,
        thresholds,
      }).estado,
    ).toBe('VENCIDO')
    expect(
      classifyPreventiveSchedule({
        fechaProgramada: dateAtOffset(8),
        kilometrajeActual: 10000,
        kilometrajeObjetivo: 10000,
        now: fixedNow,
        thresholds,
      }).estado,
    ).toBe('VENCIDO')
    expect(
      classifyPreventiveSchedule({
        fechaProgramada: dateAtOffset(8),
        kilometrajeActual: 10000,
        kilometrajeObjetivo: 10500,
        now: fixedNow,
        thresholds,
      }).estado,
    ).toBe('PROXIMO')
    expect(
      classifyPreventiveSchedule({
        fechaProgramada: dateAtOffset(8),
        kilometrajeActual: 10000,
        kilometrajeObjetivo: 10501,
        now: fixedNow,
        thresholds,
      }).estado,
    ).toBe('VIGENTE')
  })
})

describeDb('RF-03 Preventive maintenance API', () => {
  let fixture: PreventiveFixture

  beforeAll(async () => {
    fixture = await createFixture()
  }, 60000)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, 60000)

  it('requires authentication and restricts RF-03 to active Administrators', async () => {
    await request(createApp()).get('/mantenimiento-preventivo/resumen').expect(401)

    const conductor = await loginAgent(fixture.conductorEmail)
    const mecanico = await loginAgent(fixture.mecanicoEmail)

    await conductor.get('/mantenimiento-preventivo/resumen').expect(403)
    await mecanico.get('/mantenimiento-preventivo/programaciones').expect(403)
    await request(createApp())
      .post('/auth/login')
      .send({ contrasena: password, email: fixture.inactiveAdminEmail })
      .expect(403)

    const token = createTokenWithRole(fixture.adminId, fixture.adminEmail, 'ADMIN_SUPERVISOR', 3600)

    await request(createApp())
      .get('/mantenimiento-preventivo/resumen')
      .set('Cookie', `${env.COOKIE_NAME}=${token}`)
      .expect(401)
  }, 60000)

  it('creates schedules by date, mileage and both while deriving responsible data', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({ kilometrajeActual: 10000 })

    const byDate = await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Inspeccion preventiva por fecha calendario',
        busId: bus.id,
        criterio: 'FECHA',
        fechaProgramada: isoDateFromTodayOffset(10),
        tipo: 'Revision de seguridad',
      })
      .expect(201)
    created.programaciones.push(byDate.body.data.programacion.id)

    const byMileage = await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Revision preventiva por kilometraje de aceite',
        busId: bus.id,
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 11000,
        tipo: 'Cambio de aceite',
      })
      .expect(201)
    created.programaciones.push(byMileage.body.data.programacion.id)

    const combined = await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Revision combinada de sistema de frenos',
        busId: bus.id,
        criterio: 'FECHA_KILOMETRAJE',
        fechaProgramada: isoDateFromTodayOffset(15),
        kilometrajeObjetivo: 11200,
        tipo: 'Frenos',
      })
      .expect(201)
    created.programaciones.push(combined.body.data.programacion.id)

    expect(byDate.body.data.programacion.creadaPor.id).toBe(fixture.adminId)
    expect(byMileage.body.data.programacion.bus.kilometrajeActual).toBe(10000)
    expect(combined.body.data.programacion.clasificacion.estado).toBe('VIGENTE')
    expect(JSON.stringify(combined.body)).not.toContain('contrasena')
  }, 60000)

  it('rejects invalid creation data, inactive buses, unknown fields and logical duplicates', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({ kilometrajeActual: 10000 })
    const inactiveBus = await createBus({ estadoOperativo: 'INACTIVO' })

    await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Sin criterio preventivo suficiente',
        busId: bus.id,
        tipo: 'Revision',
      })
      .expect(400)

    await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Programacion con bus inexistente',
        busId: randomUUID(),
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 12000,
        tipo: 'Revision',
      })
      .expect(404)

    await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Programacion sobre bus inactivo',
        busId: inactiveBus.id,
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 12000,
        tipo: 'Revision',
      })
      .expect(400)

    await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Intento de enviar campos internos',
        busId: bus.id,
        creadaPorId: fixture.conductorId,
        criterio: 'KILOMETRAJE',
        estadoCalculado: 'VIGENTE',
        kilometrajeActual: 0,
        kilometrajeObjetivo: 12000,
        tipo: 'Revision',
      })
      .expect(400)

    await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Fecha inexistente en calendario',
        busId: bus.id,
        criterio: 'FECHA',
        fechaProgramada: '2026-02-30',
        tipo: 'Revision',
      })
      .expect(400)

    await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Kilometraje objetivo invalido',
        busId: bus.id,
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 0,
        tipo: 'Revision',
      })
      .expect(400)

    const first = await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: 'Revision duplicada de suspension del bus',
        busId: bus.id,
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 12500,
        tipo: 'Suspension',
      })
      .expect(201)
    created.programaciones.push(first.body.data.programacion.id)

    await admin
      .post('/mantenimiento-preventivo/programaciones')
      .send({
        actividad: '  revision duplicada de suspension del bus ',
        busId: bus.id,
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 12500,
        tipo: ' suspension ',
      })
      .expect(409)
  }, 60000)

  it('lists, searches, filters, paginates, summarizes and returns safe detail DTOs', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({
      codigoInterno: uniqueBusCode('BUS-FILTRO'),
      kilometrajeActual: 10000,
    })
    const schedule = await createSchedule(bus.id, fixture.adminId, {
      actividad: 'Revision filtrable por tablero administrativo preventivo',
      kilometrajeObjetivo: 10400,
      tipo: 'Filtro RF03',
    })

    const list = await admin
      .get('/mantenimiento-preventivo/programaciones')
      .query({
        busqueda: bus.placa,
        criterio: 'KILOMETRAJE',
        estado: 'PROXIMO',
        limite: 1,
        ordenarPor: 'estado',
        pagina: 1,
      })
      .expect(200)

    expect(list.body.data.programaciones).toHaveLength(1)
    expect(list.body.data.programaciones[0].id).toBe(schedule.id)
    expect(list.body.data.paginacion.total).toBe(1)

    const detail = await admin
      .get(`/mantenimiento-preventivo/programaciones/${schedule.id}`)
      .expect(200)
    const serialized = JSON.stringify(detail.body)

    expect(detail.body.data.programacion.clasificacion.estado).toBe('PROXIMO')
    expect(detail.body.data.programacion.clasificacion.kilometrosRestantes).toBe(400)
    expect(serialized).not.toContain('contrasena')
    expect(serialized).not.toContain('token')

    const summary = await admin.get('/mantenimiento-preventivo/resumen').expect(200)

    expect(summary.body.data.total).toBeGreaterThanOrEqual(1)
    expect(summary.body.data.estados.PROXIMO).toBeGreaterThanOrEqual(1)
    expect(summary.body.data.umbrales).toEqual({ dias: 7, kilometros: 500 })

    await admin.get(`/mantenimiento-preventivo/programaciones/${randomUUID()}`).expect(404)
  }, 60000)

  it('updates only allowed schedule fields and recalculates classification from the server', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({ kilometrajeActual: 10000 })
    const schedule = await createSchedule(bus.id, fixture.adminId, {
      actividad: 'Revision editable de filtros preventivos',
      kilometrajeObjetivo: 11000,
      tipo: 'Editable',
    })

    const updated = await admin
      .patch(`/mantenimiento-preventivo/programaciones/${schedule.id}`)
      .send({
        actividad: 'Revision reprogramada por kilometraje cercano',
        kilometrajeObjetivo: 10450,
      })
      .expect(200)

    expect(updated.body.data.programacion.clasificacion.estado).toBe('PROXIMO')
    expect(updated.body.data.programacion.clasificacion.kilometrosRestantes).toBe(450)

    await admin
      .patch(`/mantenimiento-preventivo/programaciones/${schedule.id}`)
      .send({
        busId: randomUUID(),
        creadaPorId: fixture.conductorId,
      })
      .expect(400)
  }, 60000)

  it('changes preventive classification after RF-01 records a new official mileage reading', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({ kilometrajeActual: 10000 })
    const schedule = await createSchedule(bus.id, fixture.adminId, {
      kilometrajeObjetivo: 10600,
      tipo: 'Kilometraje oficial',
    })

    const before = await admin
      .get(`/mantenimiento-preventivo/programaciones/${schedule.id}`)
      .expect(200)
    expect(before.body.data.programacion.clasificacion.estado).toBe('VIGENTE')

    await admin
      .post(`/flota/buses/${bus.id}/kilometraje`)
      .send({
        kilometrajeNuevo: 10100,
        motivo: 'Lectura oficial para recalculo preventivo',
      })
      .expect(200)

    const after = await admin
      .get(`/mantenimiento-preventivo/programaciones/${schedule.id}`)
      .expect(200)
    expect(after.body.data.programacion.clasificacion.estado).toBe('PROXIMO')
    expect(after.body.data.programacion.clasificacion.kilometrosRestantes).toBe(500)
  }, 60000)

  it('generates preventive orders only for eligible schedules and keeps idempotency', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({ kilometrajeActual: 10000 })
    const proxima = await createSchedule(bus.id, fixture.adminId, {
      kilometrajeObjetivo: 10400,
      tipo: 'Orden proxima',
    })
    const vigente = await createSchedule(bus.id, fixture.adminId, {
      actividad: 'Revision vigente no elegible',
      kilometrajeObjetivo: 11000,
      tipo: 'Orden vigente',
    })
    const vencida = await createSchedule(bus.id, fixture.adminId, {
      actividad: 'Revision vencida por kilometraje actual',
      kilometrajeObjetivo: 10000,
      tipo: 'Orden vencida',
    })

    const generated = await admin
      .post(`/mantenimiento-preventivo/programaciones/${proxima.id}/generar-orden`)
      .send({
        observacion: 'Generacion preventiva automatizada por administrador',
        prioridad: 'ALTA',
      })
      .expect(200)
    const orderId = generated.body.data.orden.id as string
    created.ordenes.push(orderId)

    expect(generated.body.data.yaExistia).toBe(false)
    expect(generated.body.data.orden.estado).toBe('PENDIENTE_ASIGNACION')
    expect(generated.body.data.orden.origen).toBe('PREVENTIVO')
    expect(generated.body.data.orden.prioridad).toBe('ALTA')

    const order = await prisma.ordenTrabajo.findUniqueOrThrow({
      include: { estadosHistorial: true },
      where: { id: orderId },
    })

    expect(order.busId).toBe(bus.id)
    expect(order.programacionMantenimientoId).toBe(proxima.id)
    expect(order.tipo).toBe('PREVENTIVA')
    expect(order.origen).toBe('PREVENTIVO')
    expect(order.estado).toBe('PENDIENTE_ASIGNACION')
    expect(order.tecnicoAsignadoId).toBeNull()
    expect(order.creadaPorId).toBe(fixture.adminId)
    expect(order.kilometrajeObjetivoPreventivo).toBe(10400)
    expect(order.estadosHistorial).toHaveLength(1)
    expect(order.estadosHistorial[0].estadoNuevo).toBe('PENDIENTE_ASIGNACION')

    const repeated = await admin
      .post(`/mantenimiento-preventivo/programaciones/${proxima.id}/generar-orden`)
      .send({ prioridad: 'MEDIA' })
      .expect(200)

    expect(repeated.body.data.yaExistia).toBe(true)
    expect(repeated.body.data.orden.id).toBe(orderId)
    await admin
      .post(`/mantenimiento-preventivo/programaciones/${vigente.id}/generar-orden`)
      .send({ prioridad: 'MEDIA' })
      .expect(400)

    const overdue = await admin
      .post(`/mantenimiento-preventivo/programaciones/${vencida.id}/generar-orden`)
      .send({ prioridad: 'BAJA' })
      .expect(200)
    created.ordenes.push(overdue.body.data.orden.id)
  }, 60000)

  it('blocks schedule updates when an active preventive order already exists', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({ kilometrajeActual: 10000 })
    const schedule = await createSchedule(bus.id, fixture.adminId, {
      kilometrajeObjetivo: 10400,
      tipo: 'Bloqueada por orden',
    })
    const generated = await admin
      .post(`/mantenimiento-preventivo/programaciones/${schedule.id}/generar-orden`)
      .send({ prioridad: 'MEDIA' })
      .expect(200)
    created.ordenes.push(generated.body.data.orden.id)

    await admin
      .patch(`/mantenimiento-preventivo/programaciones/${schedule.id}`)
      .send({ kilometrajeObjetivo: 10800 })
      .expect(400)
  }, 60000)

  it('does not create duplicate preventive orders under concurrent requests', async () => {
    const bus = await createBus({ kilometrajeActual: 10000 })
    const schedule = await createSchedule(bus.id, fixture.adminId, {
      kilometrajeObjetivo: 10400,
      tipo: 'Concurrente',
    })
    const [adminA, adminB] = await Promise.all([
      loginAgent(fixture.adminEmail),
      loginAgent(fixture.adminEmail),
    ])

    const [first, second] = await Promise.all([
      adminA
        .post(`/mantenimiento-preventivo/programaciones/${schedule.id}/generar-orden`)
        .send({ prioridad: 'MEDIA' }),
      adminB
        .post(`/mantenimiento-preventivo/programaciones/${schedule.id}/generar-orden`)
        .send({ prioridad: 'MEDIA' }),
    ])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(first.body.data.orden.id).toBe(second.body.data.orden.id)

    const order = await prisma.ordenTrabajo.findFirstOrThrow({
      where: { programacionMantenimientoId: schedule.id },
    })
    created.ordenes.push(order.id)
    const [orderCount, historyCount, orphanOrderRows, orphanHistoryRows] = await Promise.all([
      prisma.ordenTrabajo.count({
        where: { programacionMantenimientoId: schedule.id },
      }),
      prisma.ordenEstadoHistorial.count({
        where: { ordenTrabajoId: order.id },
      }),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
        SELECT count(*)::bigint AS count
        FROM ${tableName('ordenes_trabajo')} AS "orden"
        LEFT JOIN ${tableName('programaciones_mantenimiento')} AS "programacion"
          ON "programacion"."id" = "orden"."programacion_mantenimiento_id"
        WHERE "orden"."programacion_mantenimiento_id" IS NOT NULL
          AND "programacion"."id" IS NULL
      `),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
        SELECT count(*)::bigint AS count
        FROM ${tableName('orden_estado_historial')} AS "historial"
        LEFT JOIN ${tableName('ordenes_trabajo')} AS "orden"
          ON "orden"."id" = "historial"."orden_trabajo_id"
        WHERE "orden"."id" IS NULL
      `),
    ])
    const responses = [first.body.data.yaExistia, second.body.data.yaExistia]
    const orphanOrderCount = Number(orphanOrderRows[0]?.count ?? 0)
    const orphanHistoryCount = Number(orphanHistoryRows[0]?.count ?? 0)

    expect(responses.filter((value) => value === false)).toHaveLength(1)
    expect(responses.filter((value) => value === true)).toHaveLength(1)
    expect(orderCount).toBe(1)
    expect(historyCount).toBe(1)
    expect(orphanOrderCount).toBe(0)
    expect(orphanHistoryCount).toBe(0)
  }, 60000)

  it('rolls back the preventive order transaction when one step fails', async () => {
    const bus = await createBus({ kilometrajeActual: 10000 })
    const schedule = await createSchedule(bus.id, fixture.adminId, {
      kilometrajeObjetivo: 10400,
      tipo: 'Rollback',
    })
    const fakeAdmin: AuthenticatedUser = {
      email: 'fake-admin@test.sgmv.local',
      estado: 'ACTIVO',
      id: randomUUID(),
      nombre: 'Fake Admin',
      rol: {
        codigo: 'ADMINISTRADOR',
        nombre: 'Administrador',
      },
    }
    const service = new PreventiveService()

    await expect(
      service.generateOrder(
        schedule.id,
        {
          prioridad: 'MEDIA',
        },
        fakeAdmin,
      ),
    ).rejects.toBeTruthy()

    const [orderCount, historyCount] = await Promise.all([
      prisma.ordenTrabajo.count({ where: { programacionMantenimientoId: schedule.id } }),
      prisma.ordenEstadoHistorial.count({
        where: {
          ordenTrabajo: {
            programacionMantenimientoId: schedule.id,
          },
        },
      }),
    ])

    expect(orderCount).toBe(0)
    expect(historyCount).toBe(0)
  }, 60000)
})
