import { randomUUID } from 'node:crypto'

import { PrismaClient, type RolCodigo } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { alertCatalogEntry, tipoAlertaValues } from '../src/alerts/alert.catalog.js'
import { evaluateJourneyMileageAlerts, materializeAlert } from '../src/alerts/alert.service.js'
import { createApp } from '../src/app.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-alertas-P9-123'
const timeout = 120_000
const runId = randomUUID().replaceAll('-', '').slice(0, 10)
const prefix = `p9-${runId}`

const created = {
  buses: [] as string[],
  journeys: [] as string[],
  novelties: [] as string[],
  orders: [] as string[],
  parts: [] as string[],
  schedules: [] as string[],
  users: [] as string[],
}

type TestUser = Awaited<ReturnType<typeof createUser>>

function code(value: string) {
  return `${value}-${runId}`.toUpperCase()
}

async function createUser(roleCode: RolCodigo, label: string) {
  const role = await prisma.rol.upsert({
    where: { codigo: roleCode },
    update: {},
    create: { codigo: roleCode, nombre: roleCode },
  })
  const user = await prisma.usuario.create({
    data: {
      contrasenaHash: await hash(password, 10),
      email: `${prefix}-${label}@test.sgmv.local`,
      estado: 'ACTIVO',
      nombre: `P9 ${label}`,
      rolId: role.id,
    },
  })
  created.users.push(user.id)
  return { ...user, roleCode }
}

async function createBus(sequence: number) {
  const bus = await prisma.bus.create({
    data: {
      anio: 2024,
      codigoInterno: code(`BUS${sequence}`),
      kilometrajeActual: 10_000 + sequence,
      marca: 'Marca P9',
      modelo: 'Modelo P9',
      placa: `P9${runId.slice(0, 4)}${sequence}`.toUpperCase(),
    },
  })
  created.buses.push(bus.id)
  return bus
}

async function login(user: TestUser) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email: user.email }).expect(200)
  return agent
}

async function cleanup() {
  const alerts = await prisma.alertaInterna.findMany({
    select: { id: true },
    where: {
      OR: [
        { busId: { in: created.buses } },
        { jornadaOperativaId: { in: created.journeys } },
        { novedadId: { in: created.novelties } },
        { ordenTrabajoId: { in: created.orders } },
        { programacionMantenimientoId: { in: created.schedules } },
        { repuestoId: { in: created.parts } },
        { claveDeduplicacion: { startsWith: prefix } },
      ],
    },
  })
  const alertIds = alerts.map((alert) => alert.id)

  await prisma.$transaction(async (tx) => {
    await tx.alertaDestinatario.deleteMany({ where: { usuarioId: { in: created.users } } })
    await tx.alertaDestinatario.deleteMany({ where: { alertaInternaId: { in: alertIds } } })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
    await tx.solicitudIdempotente.deleteMany({ where: { actorId: { in: created.users } } })
    await tx.lecturaKilometraje.deleteMany({
      where: { jornadaOperativaId: { in: created.journeys } },
    })
    await tx.ordenTrabajo.deleteMany({ where: { id: { in: created.orders } } })
    await tx.novedad.deleteMany({ where: { id: { in: created.novelties } } })
    await tx.programacionMantenimiento.deleteMany({ where: { id: { in: created.schedules } } })
    await tx.jornadaOperativa.deleteMany({ where: { id: { in: created.journeys } } })
    await tx.repuesto.deleteMany({ where: { id: { in: created.parts } } })
    await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
    await tx.usuario.deleteMany({ where: { id: { in: created.users } } })
  })
}

describe('P9 alertas internas por destinatario', () => {
  let admin: TestUser
  let adminHistorical: TestUser
  let dispatcher: TestUser
  let mechanic: TestUser
  let driver: TestUser
  let driverTwo: TestUser
  let bus: Awaited<ReturnType<typeof createBus>>
  let futureJourneyId: string
  let pastProgrammedJourneyId: string
  let pastActiveJourneyId: string
  let noveltyId: string
  let orderId: string
  let scheduleId: string
  let partId: string

  beforeAll(async () => {
    admin = await createUser('ADMINISTRADOR', 'admin')
    adminHistorical = await createUser('ADMINISTRADOR', 'admin-historico')
    dispatcher = await createUser('DESPACHADOR', 'despacho')
    mechanic = await createUser('MECANICO', 'mecanico')
    driver = await createUser('CONDUCTOR', 'conductor')
    driverTwo = await createUser('CONDUCTOR', 'conductor-2')

    bus = await createBus(1)
    const busPastProgrammed = await createBus(2)
    const busPastActive = await createBus(3)
    const now = Date.now()

    const futureJourney = await prisma.jornadaOperativa.create({
      data: {
        busId: bus.id,
        conductorId: driver.id,
        estado: 'PROGRAMADA',
        finProgramado: new Date(now + 28 * 60 * 60 * 1000),
        inicioProgramado: new Date(now + 24 * 60 * 60 * 1000),
        programadaPorId: dispatcher.id,
      },
    })
    futureJourneyId = futureJourney.id
    created.journeys.push(futureJourney.id)

    const pastProgrammed = await prisma.jornadaOperativa.create({
      data: {
        busId: busPastProgrammed.id,
        conductorId: driver.id,
        estado: 'PROGRAMADA',
        finProgramado: new Date(now - 30 * 60 * 1000),
        inicioProgramado: new Date(now - 2 * 60 * 60 * 1000),
        programadaPorId: dispatcher.id,
      },
    })
    pastProgrammedJourneyId = pastProgrammed.id
    created.journeys.push(pastProgrammed.id)

    const pastActive = await prisma.jornadaOperativa.create({
      data: {
        busId: busPastActive.id,
        conductorId: driverTwo.id,
        estado: 'PROGRAMADA',
        finProgramado: new Date(now - 30 * 60 * 1000),
        inicioProgramado: new Date(now - 3 * 60 * 60 * 1000),
        programadaPorId: dispatcher.id,
      },
    })
    pastActiveJourneyId = pastActive.id
    created.journeys.push(pastActive.id)
    const startAt = new Date(now - 3 * 60 * 60 * 1000)
    await prisma.$transaction(async (tx) => {
      await tx.jornadaOperativa.update({
        data: {
          estado: 'EN_CURSO',
          iniciadaPorId: driverTwo.id,
          inicioReal: startAt,
        },
        where: { id: pastActive.id },
      })
      await tx.lecturaKilometraje.create({
        data: {
          busId: busPastActive.id,
          fechaLectura: startAt,
          fechaRegistro: startAt,
          jornadaOperativaId: pastActive.id,
          kilometrajeAnterior: busPastActive.kilometrajeActual,
          kilometrajeNuevo: busPastActive.kilometrajeActual,
          registradoPorId: driverTwo.id,
          tipo: 'INICIO_JORNADA',
        },
      })
    })

    const novelty = await prisma.novedad.create({
      data: {
        afectaOperacion: true,
        bloqueaDisponibilidad: false,
        busId: bus.id,
        conductorId: driver.id,
        criticidad: 'CRITICA',
        descripcion: 'Novedad de origen P9',
        estado: 'PENDIENTE_REVISION',
        fechaOcurrencia: new Date(now),
        fechaReporte: new Date(now),
        tipo: 'Prueba P9',
      },
    })
    noveltyId = novelty.id
    created.novelties.push(novelty.id)

    const order = await prisma.ordenTrabajo.create({
      data: {
        busId: bus.id,
        codigo: code('OT'),
        creadaPorId: admin.id,
        descripcion: 'Orden de origen para alertas P9',
        estado: 'PENDIENTE_ASIGNACION',
        origen: 'CORRECTIVO_DIRECTO',
        prioridad: 'MEDIA',
        tipo: 'CORRECTIVA',
      },
    })
    orderId = order.id
    created.orders.push(order.id)

    const schedule = await prisma.programacionMantenimiento.create({
      data: {
        actividad: 'Actividad preventiva P9',
        busId: bus.id,
        creadaPorId: admin.id,
        criterio: 'FECHA',
        fechaProgramada: new Date(now + 7 * 24 * 60 * 60 * 1000),
        prioridad: 'MEDIA',
        tipo: 'Motor',
      },
    })
    scheduleId = schedule.id
    created.schedules.push(schedule.id)

    const part = await prisma.repuesto.create({
      data: {
        codigo: code('REP'),
        costoUnitario: '10',
        nombre: 'Repuesto P9',
        stockActual: '2',
        stockMinimo: '1',
        unidadMedida: 'unidad',
      },
    })
    partId = part.id
    created.parts.push(part.id)
  }, timeout)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, timeout)

  it(
    'configura y materializa los quince tipos con origen real y contexto sanitizado',
    async () => {
      expect(tipoAlertaValues).toHaveLength(15)

      const recipientByRole: Record<RolCodigo, string> = {
        ADMINISTRADOR: admin.id,
        CONDUCTOR: driver.id,
        DESPACHADOR: dispatcher.id,
        MECANICO: mechanic.id,
      }
      const origins = {
        busId: { busId: bus.id },
        jornadaId: { jornadaId: futureJourneyId },
        novedadId: { novedadId: noveltyId },
        ordenId: { ordenId: orderId },
        programacionMantenimientoId: { programacionMantenimientoId: scheduleId },
        repuestoId: { repuestoId: partId },
      }

      for (const tipo of tipoAlertaValues) {
        const catalog = alertCatalogEntry(tipo)
        expect(catalog.contextSchemaVersion).toBe(1)
        expect(catalog.deduplicationScope.length).toBeGreaterThan(5)
        expect(catalog.recipientStrategy.length).toBeGreaterThan(5)

        await prisma.$transaction((tx) =>
          materializeAlert(
            {
              claveDeduplicacion: `${prefix}:catalogo:${tipo}`,
              contextoEvento: {
                busCodigo: bus.codigoInterno,
                contrasena: 'no-debe-persistir',
                diagnostico: 'no-debe-persistir',
                eventAt: new Date().toISOString(),
                token: 'no-debe-persistir',
              },
              destinatarios: {
                kind: 'USERS',
                userIds: [recipientByRole[catalog.allowedRecipientRoles[0]!]],
              },
              mensaje: `Mensaje ${tipo}`,
              origen: origins[catalog.originKind],
              tipo,
              titulo: catalog.defaultTitle,
            },
            tx,
          ),
        )
      }

      const alerts = await prisma.alertaInterna.findMany({
        include: { destinatarios: true },
        where: { claveDeduplicacion: { startsWith: `${prefix}:catalogo:` } },
      })
      expect(alerts).toHaveLength(15)
      for (const alert of alerts) {
        expect(alert.destinatarios).toHaveLength(1)
        const serialized = JSON.stringify(alert.contextoEvento)
        expect(serialized).not.toContain('no-debe-persistir')
        expect(alert.contextoEvento).toMatchObject({ schemaVersion: 1 })
      }
    },
    timeout,
  )

  it(
    'deduplica concurrentemente una ocurrencia y conserva destinatarios únicos',
    async () => {
      const key = `${prefix}:concurrencia`
      await Promise.all(
        Array.from({ length: 8 }, () =>
          prisma.$transaction((tx) =>
            materializeAlert(
              {
                claveDeduplicacion: key,
                contextoEvento: { busCodigo: bus.codigoInterno, eventAt: new Date().toISOString() },
                destinatarios: { kind: 'USERS', userIds: [admin.id, admin.id] },
                mensaje: 'Misma ocurrencia concurrente',
                origen: { ordenId: orderId },
                tipo: 'ORDEN_PENDIENTE_ASIGNACION',
                titulo: 'Orden pendiente',
              },
              tx,
            ),
          ),
        ),
      )

      const alerts = await prisma.alertaInterna.findMany({
        include: { destinatarios: true },
        where: { claveDeduplicacion: key },
      })
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.destinatarios).toHaveLength(1)
    },
    timeout,
  )

  it(
    'mantiene bandeja, lectura y atención estrictamente por destinatario',
    async () => {
      const key = `${prefix}:bandeja`
      await prisma.$transaction((tx) =>
        materializeAlert(
          {
            claveDeduplicacion: key,
            contextoEvento: { busCodigo: bus.codigoInterno, eventAt: new Date().toISOString() },
            destinatarios: { kind: 'USERS', userIds: [admin.id, dispatcher.id] },
            mensaje: 'Alerta compartida con estado individual',
            origen: { novedadId: noveltyId },
            tipo: 'NOVEDAD_CRITICA',
            titulo: 'Novedad crítica',
          },
          tx,
        ),
      )
      const alert = await prisma.alertaInterna.findUniqueOrThrow({
        include: { destinatarios: true },
        where: { claveDeduplicacion: key },
      })
      const adminRecipient = alert.destinatarios.find((item) => item.usuarioId === admin.id)!
      const dispatcherRecipient = alert.destinatarios.find(
        (item) => item.usuarioId === dispatcher.id,
      )!
      const adminAgent = await login(admin)
      const dispatcherAgent = await login(dispatcher)
      const mechanicAgent = await login(mechanic)

      const inbox = await adminAgent.get('/alertas?estado=NO_LEIDA&page=1&pageSize=100').expect(200)
      expect(
        inbox.body.data.items.some((item: { alertaId: string }) => item.alertaId === alert.id),
      ).toBe(true)
      await mechanicAgent.patch(`/alertas/${adminRecipient.id}/leida`).send({}).expect(404)
      await dispatcherAgent.patch(`/alertas/${adminRecipient.id}/leida`).send({}).expect(404)

      await adminAgent.patch(`/alertas/${adminRecipient.id}/leida`).send({}).expect(200)
      await adminAgent.patch(`/alertas/${adminRecipient.id}/leida`).send({}).expect(200)
      await adminAgent.patch(`/alertas/${adminRecipient.id}/atendida`).send({}).expect(200)

      const states = await prisma.alertaDestinatario.findMany({
        where: { id: { in: [adminRecipient.id, dispatcherRecipient.id] } },
      })
      expect(states.find((item) => item.id === adminRecipient.id)).toMatchObject({
        estado: 'ATENDIDA',
      })
      expect(states.find((item) => item.id === dispatcherRecipient.id)).toMatchObject({
        estado: 'NO_LEIDA',
        fechaAtencion: null,
        fechaLectura: null,
      })
    },
    timeout,
  )

  it(
    'conserva la fotografía histórica aunque cambie el rol posteriormente',
    async () => {
      const key = `${prefix}:rol-historico`
      await prisma.$transaction((tx) =>
        materializeAlert(
          {
            claveDeduplicacion: key,
            contextoEvento: { busCodigo: bus.codigoInterno, eventAt: new Date().toISOString() },
            destinatarios: { kind: 'USERS', userIds: [adminHistorical.id] },
            mensaje: 'Fotografía histórica de destinatario',
            origen: { ordenId: orderId },
            tipo: 'ORDEN_PENDIENTE_ASIGNACION',
            titulo: 'Orden pendiente',
          },
          tx,
        ),
      )
      const mechanicRole = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'MECANICO' } })
      await prisma.usuario.update({
        data: { rolId: mechanicRole.id },
        where: { id: adminHistorical.id },
      })

      const alert = await prisma.alertaInterna.findUniqueOrThrow({
        include: { destinatarios: true },
        where: { claveDeduplicacion: key },
      })
      expect(alert.destinatarios.map((item) => item.usuarioId)).toEqual([adminHistorical.id])
      expect(alert.destinatarios.some((item) => item.usuarioId === admin.id)).toBe(false)
    },
    timeout,
  )

  it(
    'evalúa jornadas vencidas sin kilometraje y no duplica el mismo deber de captura',
    async () => {
      const evaluatedAt = new Date()
      await Promise.all([
        prisma.$transaction((tx) =>
          evaluateJourneyMileageAlerts(tx, evaluatedAt, [
            pastProgrammedJourneyId,
            pastActiveJourneyId,
          ]),
        ),
        prisma.$transaction((tx) =>
          evaluateJourneyMileageAlerts(tx, evaluatedAt, [
            pastProgrammedJourneyId,
            pastActiveJourneyId,
          ]),
        ),
      ])

      const alerts = await prisma.alertaInterna.findMany({
        include: { destinatarios: true },
        where: {
          jornadaOperativaId: { in: [pastProgrammedJourneyId, pastActiveJourneyId] },
          tipo: {
            in: ['JORNADA_SIN_KILOMETRAJE_INICIAL', 'JORNADA_SIN_KILOMETRAJE_FINAL'],
          },
        },
      })
      expect(alerts).toHaveLength(2)
      const initial = alerts.find((item) => item.tipo === 'JORNADA_SIN_KILOMETRAJE_INICIAL')!
      const final = alerts.find((item) => item.tipo === 'JORNADA_SIN_KILOMETRAJE_FINAL')!
      expect(initial.destinatarios.map((item) => item.usuarioId)).toEqual(
        expect.arrayContaining([dispatcher.id, driver.id]),
      )
      expect(final.destinatarios.map((item) => item.usuarioId)).toEqual(
        expect.arrayContaining([dispatcher.id, driverTwo.id]),
      )
      expect(initial.destinatarios.some((item) => item.usuarioId === admin.id)).toBe(false)
    },
    timeout,
  )

  it(
    'persiste conflicto de jornada rechazado sin crear la jornada solicitada',
    async () => {
      const dispatcherAgent = await login(dispatcher)
      const key = randomUUID()
      const existingCount = await prisma.jornadaOperativa.count({ where: { busId: bus.id } })
      const existing = await prisma.jornadaOperativa.findUniqueOrThrow({
        where: { id: futureJourneyId },
      })

      const response = await dispatcherAgent
        .post('/jornadas')
        .set('Idempotency-Key', key)
        .send({
          busId: bus.id,
          conductorId: driverTwo.id,
          finProgramado: existing.finProgramado.toISOString(),
          inicioProgramado: existing.inicioProgramado.toISOString(),
        })
        .expect(409)
      expect(response.body.error.code).toBe('JOURNEY_CONFLICT')

      await dispatcherAgent
        .post('/jornadas')
        .set('Idempotency-Key', key)
        .send({
          busId: bus.id,
          conductorId: driverTwo.id,
          finProgramado: existing.finProgramado.toISOString(),
          inicioProgramado: existing.inicioProgramado.toISOString(),
        })
        .expect(409)

      expect(await prisma.jornadaOperativa.count({ where: { busId: bus.id } })).toBe(existingCount)
      const conflictAlerts = await prisma.alertaInterna.findMany({
        include: { destinatarios: true },
        where: {
          claveDeduplicacion: `conflicto-jornada:bus:${bus.id}:solicitud:${key.toLowerCase()}`,
        },
      })
      expect(conflictAlerts).toHaveLength(1)
      expect(conflictAlerts[0]?.busId).toBe(bus.id)
      expect(conflictAlerts[0]?.destinatarios.some((item) => item.usuarioId === admin.id)).toBe(
        true,
      )
      expect(
        conflictAlerts[0]?.destinatarios.some((item) => item.usuarioId === dispatcher.id),
      ).toBe(true)
    },
    timeout,
  )
})
