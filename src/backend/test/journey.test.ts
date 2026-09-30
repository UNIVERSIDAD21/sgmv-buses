import { testEntityId } from './entity-id.js'
import { randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { evaluateJourneyMileageAlerts } from '../src/alerts/alert.service.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const created = {
  buses: [] as string[],
  jornadas: [] as string[],
  lecturas: [] as string[],
  ordenes: [] as string[],
  rutas: [] as string[],
  usuarios: [] as string[],
}

interface JourneyFixture {
  adminEmail: string
  conductorEmail: string
  conductorId: number
  conductorOtroEmail: string
  conductorOtroId: number
  despachadorEmail: string
  mecanicoEmail: string
  mecanicoId: number
}

function code(prefix: string) {
  return `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

function past(minutes: number) {
  return new Date(Date.now() - minutes * 60_000)
}

async function ensureRoles() {
  const codes = ['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR'] as const
  const roles = await Promise.all(
    codes.map((codigo) =>
      prisma.rol.upsert({
        where: { codigo },
        update: {},
        create: { codigo, nombre: codigo },
      }),
    ),
  )
  return Object.fromEntries(roles.map((role) => [role.codigo, role])) as Record<
    (typeof codes)[number],
    Rol
  >
}

async function createUser(label: string, role: Rol) {
  const id = testEntityId()
  created.usuarios.push(id)
  return prisma.usuario.create({
    data: {
      contrasenaHash: await hash(password, 10),
      email: `jornada-${label}-${String(id)}@test.sgmv.local`,
      id,
      nombre: `Usuario ${label}`,
      rolId: role.id,
    },
  })
}

async function createFixture(): Promise<JourneyFixture> {
  const roles = await ensureRoles()
  const [admin, dispatcher, driver, otherDriver, mechanic] = await Promise.all([
    createUser('admin', roles.ADMINISTRADOR),
    createUser('despachador', roles.DESPACHADOR),
    createUser('conductor', roles.CONDUCTOR),
    createUser('conductor-otro', roles.CONDUCTOR),
    createUser('mecanico', roles.MECANICO),
  ])
  return {
    adminEmail: admin.email,
    conductorEmail: driver.email,
    conductorId: driver.id,
    conductorOtroEmail: otherDriver.email,
    conductorOtroId: otherDriver.id,
    despachadorEmail: dispatcher.email,
    mecanicoEmail: mechanic.email,
    mecanicoId: mechanic.id,
  }
}

async function createDriver(label: string) {
  const roles = await ensureRoles()
  return createUser(label, roles.CONDUCTOR)
}

async function createBus(estadoOperativo: 'OPERATIVO' | 'EN_MANTENIMIENTO' = 'OPERATIVO') {
  const id = testEntityId()
  created.buses.push(id)
  return prisma.bus.create({
    data: {
      anio: 2024,
      codigoInterno: code('J-BUS'),
      estadoOperativo,
      id,
      kilometrajeActual: 0,
      marca: 'Marca prueba',
      modelo: 'Modelo prueba',
      placa: code('JP').replaceAll('-', '').slice(0, 10),
    },
  })
}

async function createRoute(activa = true) {
  const id = testEntityId()
  created.rutas.push(id)
  return prisma.ruta.create({
    data: {
      activa,
      codigo: code('J-RUTA'),
      destino: 'Terminal norte',
      id,
      nombre: 'Ruta de jornada',
      origen: 'Patio central',
    },
  })
}

async function loginAgent(email: string) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)
  return agent
}

async function programJourney(
  agent: Awaited<ReturnType<typeof loginAgent>>,
  input: {
    busId: number
    conductorId: number
    finProgramado?: Date
    inicioProgramado?: Date
    rutaId?: number
  },
) {
  const response = await agent.post('/jornadas').send({
    busId: input.busId,
    conductorId: input.conductorId,
    finProgramado: (input.finProgramado ?? past(30)).toISOString(),
    inicioProgramado: (input.inicioProgramado ?? past(120)).toISOString(),
    rutaId: input.rutaId,
  })
  if (response.status === 201) created.jornadas.push(response.body.data.jornada.id as string)
  return response
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      select: { id: true },
      where: {
        OR: [
          { busId: { in: created.buses } },
          { ordenTrabajoId: { in: created.ordenes } },
          { jornadaOperativaId: { in: created.jornadas } },
          { novedad: { jornadaOperativaId: { in: created.jornadas } } },
          { ordenTrabajo: { jornadaOperativaId: { in: created.jornadas } } },
        ],
      },
    })
    const alertIds = alerts.map((alert) => alert.id)
    await tx.alertaDestinatario.deleteMany({
      where: {
        OR: [{ usuarioId: { in: created.usuarios } }, { alertaInternaId: { in: alertIds } }],
      },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
    await tx.novedad.deleteMany({ where: { jornadaOperativaId: { in: created.jornadas } } })
    await tx.lecturaKilometraje.deleteMany({
      where: {
        OR: [
          { id: { in: created.lecturas } },
          { jornadaOperativaId: { in: created.jornadas } },
          { ordenTrabajoId: { in: created.ordenes } },
        ],
      },
    })
    await tx.actividadOrden.deleteMany({
      where: { intervencion: { ordenTrabajoId: { in: created.ordenes } } },
    })
    await tx.intervencion.deleteMany({ where: { ordenTrabajoId: { in: created.ordenes } } })
    await tx.ordenReasignacion.deleteMany({ where: { ordenTrabajoId: { in: created.ordenes } } })
    await tx.ordenEstadoHistorial.deleteMany({ where: { ordenTrabajoId: { in: created.ordenes } } })
    await tx.ordenTrabajo.deleteMany({
      where: {
        OR: [{ jornadaOperativaId: { in: created.jornadas } }, { id: { in: created.ordenes } }],
      },
    })
    await tx.jornadaOperativa.deleteMany({ where: { id: { in: created.jornadas } } })
    await tx.asignacionConductor.deleteMany({
      where: {
        OR: [{ busId: { in: created.buses } }, { conductorId: { in: created.usuarios } }],
      },
    })
    await tx.busEstadoHistorial.deleteMany({ where: { busId: { in: created.buses } } })
    await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
    await tx.ruta.deleteMany({ where: { id: { in: created.rutas } } })
    await tx.usuario.deleteMany({ where: { id: { in: created.usuarios } } })
  })
}

describe('P4 - jornadas operativas y kilometraje contextual', () => {
  let fixture: JourneyFixture

  beforeAll(async () => {
    fixture = await createFixture()
  }, 60_000)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, 60_000)

  it('recupera la programada vencida antes de la futura y confirma hechos una sola vez sin levantar bloqueos', async () => {
    const owner = await createDriver('pendiente-y-futura')
    const bus = await createBus()
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const driver = await loginAgent(owner.email)
    const otherDriver = await loginAgent(fixture.conductorOtroEmail)
    const expired = await programJourney(dispatcher, { busId: bus.id, conductorId: owner.id })
    expect(expired.status).toBe(201)
    const id = expired.body.data.jornada.id
    const future = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: owner.id,
      inicioProgramado: past(-60),
      finProgramado: past(-120),
    })
    expect(future.status).toBe(201)
    const before = await prisma.lecturaKilometraje.count({ where: { busId: bus.id } })
    for (let i = 0; i < 2; i++) {
      const own = (await driver.get('/jornadas/mi-jornada').expect(200)).body.data
      expect(own.jornadaActual).toBeNull()
      expect(own.jornadaPendiente.id).toBe(id)
      expect(own.jornadaPendiente.acciones.puedeIniciar).toBe(true)
      expect(own.proximaJornada.id).toBe(future.body.data.jornada.id)
      expect(own.proximaJornada.acciones.puedeIniciar).toBe(false)
    }
    expect(await prisma.lecturaKilometraje.count({ where: { busId: bus.id } })).toBe(before)
    const startBody = { fechaEvento: past(100).toISOString(), kilometraje: 100 }
    await otherDriver.post(`/jornadas/${id}/iniciar`).send(startBody).expect(403)
    await driver
      .post(`/jornadas/${future.body.data.jornada.id}/iniciar`)
      .send(startBody)
      .expect(409)
    await driver
      .post(`/jornadas/${id}/iniciar`)
      .send({ ...startBody, fechaEvento: past(-10).toISOString() })
      .expect(400)
    for (const kilometraje of [null, '', '   ', false]) {
      await driver
        .post(`/jornadas/${id}/iniciar`)
        .send({ ...startBody, kilometraje })
        .expect(400)
    }
    await prisma.bus.update({
      where: { id: bus.id },
      data: { estadoOperativo: 'EN_MANTENIMIENTO' },
    })
    await driver.post(`/jornadas/${id}/iniciar`).send(startBody).expect(409)
    expect(await prisma.lecturaKilometraje.count({ where: { busId: bus.id } })).toBe(before)
    await prisma.bus.update({ where: { id: bus.id }, data: { estadoOperativo: 'OPERATIVO' } })
    const startKey = randomUUID()
    for (let i = 0; i < 2; i++) {
      await driver
        .post(`/jornadas/${id}/iniciar`)
        .set('Idempotency-Key', startKey)
        .send(startBody)
        .expect(200)
    }
    const own = (await driver.get('/jornadas/mi-jornada').expect(200)).body.data
    expect(own.jornadaActual.id).toBe(id)
    expect(own.jornadaActual.lecturaReferencia).toMatchObject({
      kilometraje: 100,
      fechaLectura: startBody.fechaEvento,
    })
    await prisma.bus.update({
      where: { id: bus.id },
      data: { estadoOperativo: 'EN_MANTENIMIENTO' },
    })
    const finishKey = randomUUID()
    const finishBody = { fechaEvento: past(40).toISOString(), kilometraje: 130 }
    for (let i = 0; i < 2; i++) {
      const done = await driver
        .post(`/jornadas/${id}/finalizar`)
        .set('Idempotency-Key', finishKey)
        .send(finishBody)
        .expect(200)
      expect(done.body.data.jornada.estado).toBe('FINALIZADA')
      expect(done.body.data.jornada.bus.estadoOperativo).toBe('EN_MANTENIMIENTO')
    }
    expect(await prisma.lecturaKilometraje.count({ where: { jornadaOperativaId: id } })).toBe(2)
    expect((await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).estadoOperativo).toBe(
      'EN_MANTENIMIENTO',
    )
  }, 60000)

  it('consulta dos buses históricos propios sin imponer la asignación legada ni revelar un bus ajeno', async () => {
    const owner = await createDriver('historial-varios-buses')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const driver = await loginAgent(owner.email)
    const buses = [await createBus(), await createBus()]
    const foreign = await createBus()
    const dispatcherUser = await prisma.usuario.findUniqueOrThrow({
      where: { email: fixture.despachadorEmail },
    })
    const ownIds: number[] = []
    for (let index = 0; index < 2; index++) {
      const programmed = await programJourney(dispatcher, {
        busId: buses[index].id,
        conductorId: owner.id,
        inicioProgramado: past(240 - index * 120),
        finProgramado: past(180 - index * 120),
      })
      expect(programmed.status).toBe(201)
      const id = programmed.body.data.jornada.id
      ownIds.push(id)
      await driver
        .post(`/jornadas/${id}/iniciar`)
        .send({ fechaEvento: past(230 - index * 120).toISOString(), kilometraje: 100 })
        .expect(200)
      await driver
        .post(`/jornadas/${id}/finalizar`)
        .send({ fechaEvento: past(190 - index * 120).toISOString(), kilometraje: 150 })
        .expect(200)
    }
    await prisma.asignacionConductor.create({
      data: {
        busId: buses[0].id,
        conductorId: owner.id,
        asignadoPorId: dispatcherUser.id,
        motivo: 'Antecedente legado para comprobar prioridad de jornadas',
      },
    })
    const automatic = (await driver.get('/historial/mi-bus').expect(200)).body.data
    expect(automatic.historial.bus.id).toBe(buses[1].id)
    expect(automatic.buses.map((bus: { id: number }) => bus.id).sort()).toEqual(
      buses.map((bus) => bus.id).sort(),
    )
    for (let index = 0; index < 2; index++) {
      const result = (
        await driver
          .get('/historial/mi-bus')
          .query({ busId: buses[index].id, conductorId: fixture.conductorOtroId })
          .expect(200)
      ).body.data
      expect(result.historial.jornadas.map((journey: { id: number }) => journey.id)).toEqual([
        ownIds[index],
      ])
      expect(JSON.stringify(result)).not.toMatch(/costoTotal|diagnosticos|contrasenaHash/)
    }
    await driver.get('/historial/mi-bus').query({ busId: foreign.id }).expect(404)
    expect((await driver.get('/historial/resumen').expect(200)).body.data.indicadores.buses).toBe(2)
  }, 60000)

  it('aplica permisos por sesion y evita IDOR entre conductores', async () => {
    const bus = await createBus()
    const route = await createRoute()
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const mechanic = await loginAgent(fixture.mecanicoEmail)
    const driver = await loginAgent(fixture.conductorEmail)
    const otherDriver = await loginAgent(fixture.conductorOtroEmail)

    await request(createApp()).get('/jornadas').expect(401)
    await mechanic.get('/jornadas').expect(403)
    await driver.post('/jornadas').send({}).expect(403)

    const programmed = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: fixture.conductorId,
      rutaId: route.id,
    })
    expect(programmed.status).toBe(201)
    const journeyId = programmed.body.data.jornada.id as string

    await driver.get(`/jornadas/${journeyId}`).expect(200)
    await otherDriver.get(`/jornadas/${journeyId}`).expect(404)

    const ownList = await otherDriver
      .get(`/jornadas?conductorId=${fixture.conductorId}`)
      .expect(200)
    expect(ownList.body.data.jornadas).toHaveLength(0)
    await dispatcher
      .post(`/jornadas/${journeyId}/cancelar`)
      .send({ fechaEvento: past(110).toISOString(), motivo: 'Cierre de escenario de permisos' })
      .expect(200)
  }, 60_000)

  it('informa un cierre atrasado con propiedad, idempotencia y escalamiento exacto a las 24h sin inventar lecturas', async () => {
    const bus = await createBus()
    const owner = await createDriver('cierre-atrasado')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const driver = await loginAgent(owner.email)
    const otherDriver = await loginAgent(fixture.conductorOtroEmail)
    const admin = await loginAgent(fixture.adminEmail)
    const mechanic = await loginAgent(fixture.mecanicoEmail)
    const scheduledEnd = past(60)
    const programmed = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: owner.id,
      finProgramado: scheduledEnd,
      inicioProgramado: past(180),
    })
    expect(programmed.status).toBe(201)
    const id = programmed.body.data.jornada.id
    const path = `/jornadas/${id}/informar-cierre-pendiente`
    await driver.post(path).send({ motivo: 'Todavía no he iniciado el recorrido.' }).expect(409)
    await driver
      .post(`/jornadas/${id}/iniciar`)
      .send({ fechaEvento: past(150).toISOString(), kilometraje: 100 })
      .expect(200)
    await otherDriver
      .post(path)
      .send({ motivo: 'Intento sobre jornada de otra persona.' })
      .expect(404)
    for (const agent of [admin, dispatcher, mechanic])
      await agent.post(path).send({ motivo: 'Intento desde un rol no autorizado.' }).expect(403)
    await driver.post(path).send({ motivo: 'corto' }).expect(400)
    await driver
      .post(path)
      .send({ motivo: 'No puedo acceder al odómetro real.', conductorId: owner.id })
      .expect(400)
    const key = randomUUID()
    const reported = await driver
      .post(path)
      .set('Idempotency-Key', key)
      .send({ motivo: 'No puedo acceder al odómetro real.' })
      .expect(200)
    await driver
      .post(path)
      .set('Idempotency-Key', key)
      .send({ motivo: 'No puedo acceder al odómetro real.' })
      .expect(200)
    await driver
      .post(path)
      .send({ motivo: 'Otro intento no debe sobrescribir la explicación.' })
      .expect(200)
    expect(reported.body.data.jornada).toMatchObject({
      estado: 'EN_CURSO',
      finReal: null,
      lecturaFinal: null,
      cierrePendiente: {
        motivo: 'No puedo acceder al odómetro real.',
        reportadoPor: { id: owner.id },
      },
    })
    const reportAlerts = await prisma.alertaInterna.findMany({
      where: { claveDeduplicacion: `jornada-cierre-reportado:${id}` },
      include: { destinatarios: { include: { usuario: { include: { rol: true } } } } },
    })
    expect(reportAlerts).toHaveLength(1)
    expect(reportAlerts[0].destinatarios.length).toBeGreaterThan(0)
    expect(
      reportAlerts[0].destinatarios.every((item) => item.usuario.rol.codigo === 'DESPACHADOR'),
    ).toBe(true)
    await prisma.$transaction((tx) =>
      evaluateJourneyMileageAlerts(tx, new Date(scheduledEnd.getTime() + 24 * 3_600_000 - 1), [id]),
    )
    const escalationKey = `jornada-cierre-escalado:${id}:${scheduledEnd.toISOString()}`
    expect(await prisma.alertaInterna.count({ where: { claveDeduplicacion: escalationKey } })).toBe(
      0,
    )
    await Promise.all(
      [1, 2].map(() =>
        prisma.$transaction((tx) =>
          evaluateJourneyMileageAlerts(tx, new Date(scheduledEnd.getTime() + 24 * 3_600_000), [id]),
        ),
      ),
    )
    const escalation = await prisma.alertaInterna.findUniqueOrThrow({
      where: { claveDeduplicacion: escalationKey },
      include: { destinatarios: { include: { usuario: { include: { rol: true } } } } },
    })
    expect(escalation.prioridad).toBe('ALTA')
    expect(escalation.destinatarios.length).toBeGreaterThan(0)
    expect(
      escalation.destinatarios.every((item) => item.usuario.rol.codigo === 'ADMINISTRADOR'),
    ).toBe(true)
    expect(
      await prisma.lecturaKilometraje.count({
        where: { jornadaOperativaId: id, tipo: 'FIN_JORNADA' },
      }),
    ).toBe(0)
    const pending = await dispatcher
      .get(`/jornadas?cierreAtrasado=true&busId=${bus.id}`)
      .expect(200)
    expect(pending.body.data.jornadas).toHaveLength(1)
    await driver
      .post(`/jornadas/${id}/finalizar`)
      .send({ fechaEvento: past(30).toISOString() })
      .expect(400)
    const finished = await dispatcher
      .post(`/jornadas/${id}/finalizar`)
      .send({ fechaEvento: past(30).toISOString(), kilometraje: 120 })
      .expect(200)
    expect(finished.body.data.jornada).toMatchObject({
      estado: 'FINALIZADA',
      lecturaFinal: { kilometraje: 120 },
      cierrePendiente: { motivo: 'No puedo acceder al odómetro real.' },
    })
    expect(finished.body.data.jornada.finalizadaPor.rol).toBe('DESPACHADOR')
    expect(
      (await dispatcher.get(`/jornadas?cierreAtrasado=true&busId=${bus.id}`).expect(200)).body.data
        .jornadas,
    ).toHaveLength(0)
  }, 60_000)

  it('reconstruye bus, conductor, ruta, horario y odometro sin IDs libres del Conductor', async () => {
    const bus = await createBus()
    const route = await createRoute()
    const journeyDriver = await createDriver('flujo-completo')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const driver = await loginAgent(journeyDriver.email)
    const programmed = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: journeyDriver.id,
      rutaId: route.id,
    })
    const journeyId = programmed.body.data.jornada.id as string
    const startAt = past(90)
    const finishAt = past(45)

    await driver
      .post(`/jornadas/${journeyId}/iniciar`)
      .send({
        busId: bus.id,
        conductorId: journeyDriver.id,
        fechaEvento: startAt.toISOString(),
        kilometraje: 1250,
      })
      .expect(400)

    const started = await driver
      .post(`/jornadas/${journeyId}/iniciar`)
      .send({ fechaEvento: startAt.toISOString(), kilometraje: 1250 })
      .expect(200)
    expect(started.body.data.jornada.estado).toBe('EN_CURSO')
    expect(started.body.data.jornada.lecturaInicial.kilometraje).toBe(1250)
    expect(started.body.data.jornada.iniciadaPor.id).toBe(journeyDriver.id)

    const finished = await driver
      .post(`/jornadas/${journeyId}/finalizar`)
      .send({ fechaEvento: finishAt.toISOString(), kilometraje: 1325 })
      .expect(200)
    expect(finished.body.data.jornada).toMatchObject({
      estado: 'FINALIZADA',
      bus: { id: bus.id },
      conductor: { id: journeyDriver.id },
      ruta: { id: route.id },
      lecturaFinal: { kilometraje: 1325 },
    })

    const detail = await driver.get(`/jornadas/${journeyId}`).expect(200)
    expect(detail.body.data.jornada.inicioReal).toBe(startAt.toISOString())
    expect(detail.body.data.jornada.finReal).toBe(finishAt.toISOString())
    expect(await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).toMatchObject({
      kilometrajeActual: 1325,
    })
  }, 60_000)

  it('inserta lecturas tardias entre vecinas y nunca reduce el maximo materializado del bus', async () => {
    const bus = await createBus()
    const journeyDriver = await createDriver('lectura-tardia')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const firstId = testEntityId()
    const nextId = testEntityId()
    created.lecturas.push(firstId, nextId)
    const firstDate = past(300)
    const nextDate = past(100)

    await prisma.lecturaKilometraje.createMany({
      data: [
        {
          busId: bus.id,
          fechaLectura: firstDate,
          fechaRegistro: past(90),
          id: firstId,
          kilometrajeAnterior: 0,
          kilometrajeNuevo: 100,
          motivo: 'Linea base verificable',
          registradoPorId: fixture.conductorId,
          tipo: 'AJUSTE_ADMINISTRATIVO',
        },
        {
          busId: bus.id,
          fechaLectura: nextDate,
          fechaRegistro: past(80),
          id: nextId,
          kilometrajeAnterior: 100,
          kilometrajeNuevo: 200,
          motivo: 'Lectura posterior verificable',
          registradoPorId: fixture.conductorId,
          tipo: 'AJUSTE_ADMINISTRATIVO',
        },
      ],
    })
    await prisma.bus.update({ where: { id: bus.id }, data: { kilometrajeActual: 200 } })

    const programmed = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: journeyDriver.id,
      finProgramado: past(150),
      inicioProgramado: past(250),
    })
    const journeyId = programmed.body.data.jornada.id as string
    await dispatcher
      .post(`/jornadas/${journeyId}/iniciar`)
      .send({ fechaEvento: past(200).toISOString(), kilometraje: 150 })
      .expect(200)

    const next = await prisma.lecturaKilometraje.findUniqueOrThrow({ where: { id: nextId } })
    const currentBus = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })
    expect(next.kilometrajeAnterior).toBe(150)
    expect(currentBus.kilometrajeActual).toBe(200)

    await dispatcher
      .post(`/jornadas/${journeyId}/finalizar`)
      .send({ fechaEvento: past(180).toISOString(), kilometraje: 210 })
      .expect(409)
  }, 60_000)

  it('bloquea el inicio cuando la disponibilidad operativa es negativa', async () => {
    const bus = await createBus('EN_MANTENIMIENTO')
    const journeyDriver = await createDriver('no-disponible')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const rejected = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: journeyDriver.id,
    })
    expect(rejected.status).toBe(409)
    expect(rejected.body.error.code).toBe('BUS_NOT_AVAILABLE')
    await prisma.bus.update({ where: { id: bus.id }, data: { estadoOperativo: 'OPERATIVO' } })
    const programmed = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: journeyDriver.id,
    })

    await prisma.bus.update({
      where: { id: bus.id },
      data: { estadoOperativo: 'EN_MANTENIMIENTO' },
    })

    const response = await dispatcher
      .post(`/jornadas/${programmed.body.data.jornada.id}/iniciar`)
      .send({ fechaEvento: past(60).toISOString(), kilometraje: 500 })
      .expect(409)
    expect(response.body.error).toMatchObject({
      code: 'BUS_NOT_AVAILABLE',
      details: { causaPrincipal: 'BUS_EN_MANTENIMIENTO' },
    })
  }, 60_000)

  it('cancela y reasigna mediante segmentos terminales y sucesoras inmutables', async () => {
    const firstBus = await createBus()
    const secondBus = await createBus()
    const firstDriver = await createDriver('reasignacion-origen')
    const secondDriver = await createDriver('reasignacion-destino')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const first = await programJourney(dispatcher, {
      busId: firstBus.id,
      conductorId: firstDriver.id,
    })
    const firstId = first.body.data.jornada.id as string

    const reassigned = await dispatcher
      .post(`/jornadas/${firstId}/reasignar`)
      .send({
        busId: secondBus.id,
        conductorId: secondDriver.id,
        fechaEvento: past(180).toISOString(),
        motivo: 'Cambio operativo de bus y conductor',
      })
      .expect(201)
    const successorId = reassigned.body.data.jornadaSucesora.id as string
    created.jornadas.push(successorId)
    expect(reassigned.body.data.jornadaAnterior).toMatchObject({
      estado: 'REASIGNADA',
      jornadaSucesoraId: successorId,
    })
    expect(reassigned.body.data.jornadaSucesora).toMatchObject({
      bus: { id: secondBus.id },
      conductor: { id: secondDriver.id },
      jornadaAnteriorId: firstId,
    })

    await dispatcher
      .post(`/jornadas/${successorId}/cancelar`)
      .send({ fechaEvento: past(170).toISOString(), motivo: 'Servicio cancelado' })
      .expect(200)
    await dispatcher
      .post(`/jornadas/${successorId}/cancelar`)
      .send({ fechaEvento: past(160).toISOString(), motivo: 'Segundo intento' })
      .expect(409)
  }, 60_000)

  it('cierra con kilometraje los tramos activos cancelados o reasignados', async () => {
    const cancelBus = await createBus()
    const reassignBus = await createBus()
    const successorBus = await createBus()
    const cancelDriver = await createDriver('cancelacion-activa')
    const reassignDriver = await createDriver('reasignacion-activa')
    const successorDriver = await createDriver('sucesor-activo')
    const dispatcher = await loginAgent(fixture.despachadorEmail)

    const cancellable = await programJourney(dispatcher, {
      busId: cancelBus.id,
      conductorId: cancelDriver.id,
    })
    const cancellableId = cancellable.body.data.jornada.id as string
    await dispatcher
      .post(`/jornadas/${cancellableId}/iniciar`)
      .send({ fechaEvento: past(90).toISOString(), kilometraje: 1000 })
      .expect(200)
    await dispatcher
      .post(`/jornadas/${cancellableId}/cancelar`)
      .send({ fechaEvento: past(60).toISOString(), motivo: 'Cancelacion operativa activa' })
      .expect(400)
    const cancelled = await dispatcher
      .post(`/jornadas/${cancellableId}/cancelar`)
      .send({
        fechaEvento: past(60).toISOString(),
        kilometrajeFinal: 1040,
        motivo: 'Cancelacion operativa activa',
      })
      .expect(200)
    expect(cancelled.body.data.jornada).toMatchObject({
      estado: 'CANCELADA',
      lecturaFinal: { kilometraje: 1040 },
    })

    const reassignable = await programJourney(dispatcher, {
      busId: reassignBus.id,
      conductorId: reassignDriver.id,
    })
    const reassignableId = reassignable.body.data.jornada.id as string
    await dispatcher
      .post(`/jornadas/${reassignableId}/iniciar`)
      .send({ fechaEvento: past(90).toISOString(), kilometraje: 2000 })
      .expect(200)
    const reassigned = await dispatcher
      .post(`/jornadas/${reassignableId}/reasignar`)
      .send({
        busId: successorBus.id,
        conductorId: successorDriver.id,
        fechaEvento: past(60).toISOString(),
        kilometrajeFinal: 2060,
        motivo: 'Relevo durante la operacion',
      })
      .expect(201)
    const successorId = reassigned.body.data.jornadaSucesora.id as string
    created.jornadas.push(successorId)
    expect(reassigned.body.data.jornadaAnterior).toMatchObject({
      estado: 'REASIGNADA',
      lecturaFinal: { kilometraje: 2060 },
    })
    expect(reassigned.body.data.jornadaSucesora).toMatchObject({
      bus: { id: successorBus.id },
      conductor: { id: successorDriver.id },
      estado: 'PROGRAMADA',
      jornadaAnteriorId: reassignableId,
    })
  }, 60_000)

  it('repite de forma idempotente la programacion sin crear otra jornada', async () => {
    const bus = await createBus()
    const journeyDriver = await createDriver('idempotencia')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const key = randomUUID()
    const body = {
      busId: bus.id,
      conductorId: journeyDriver.id,
      finProgramado: past(30).toISOString(),
      inicioProgramado: past(120).toISOString(),
    }

    const first = await dispatcher
      .post('/jornadas')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201)
    const journeyId = first.body.data.jornada.id as string
    created.jornadas.push(journeyId)
    const replay = await dispatcher
      .post('/jornadas')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201)

    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect(replay.body).toEqual(first.body)
    expect(await prisma.jornadaOperativa.count({ where: { id: journeyId } })).toBe(1)
  }, 60_000)

  it('serializa programaciones concurrentes y evita solapes por bus y conductor', async () => {
    const bus = await createBus()
    const otherBus = await createBus()
    const firstDriver = await createDriver('concurrencia-uno')
    const secondDriver = await createDriver('concurrencia-dos')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const start = past(240)
    const end = past(120)

    const [first, second] = await Promise.all([
      programJourney(dispatcher, {
        busId: bus.id,
        conductorId: firstDriver.id,
        finProgramado: end,
        inicioProgramado: start,
      }),
      programJourney(dispatcher, {
        busId: bus.id,
        conductorId: secondDriver.id,
        finProgramado: end,
        inicioProgramado: start,
      }),
    ])
    expect([first.status, second.status].sort()).toEqual([201, 409])

    const conductorConflict = await programJourney(dispatcher, {
      busId: otherBus.id,
      conductorId: first.status === 201 ? firstDriver.id : secondDriver.id,
      finProgramado: end,
      inicioProgramado: start,
    })
    expect(conductorConflict.status).toBe(409)
  }, 60_000)

  it('serializa inicio y fin concurrentes y conserva una sola lectura por extremo', async () => {
    const bus = await createBus()
    const journeyDriver = await createDriver('extremos-concurrentes')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const programmed = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: journeyDriver.id,
    })
    const journeyId = programmed.body.data.jornada.id as string
    const startPayload = {
      fechaEvento: past(90).toISOString(),
      kilometraje: 700,
      observadoPorId: journeyDriver.id,
      motivoRespaldo: 'Conductor comunicó lectura física al despacho',
    }

    await dispatcher
      .post(`/jornadas/${journeyId}/iniciar`)
      .send({ ...startPayload, motivoRespaldo: undefined })
      .expect(400)
    await dispatcher
      .post(`/jornadas/${journeyId}/iniciar`)
      .send({ ...startPayload, observadoPorId: fixture.conductorOtroId })
      .expect(400)

    const startResults = await Promise.all([
      dispatcher.post(`/jornadas/${journeyId}/iniciar`).send(startPayload),
      dispatcher.post(`/jornadas/${journeyId}/iniciar`).send(startPayload),
    ])
    expect(startResults.map((result) => result.status).sort()).toEqual([200, 409])
    expect(
      await prisma.lecturaKilometraje.count({
        where: { jornadaOperativaId: journeyId, tipo: 'INICIO_JORNADA' },
      }),
    ).toBe(1)

    const finishPayload = {
      fechaEvento: past(45).toISOString(),
      kilometraje: 750,
      observadoPorId: journeyDriver.id,
      motivoRespaldo: 'Conductor comunicó lectura final al despacho',
    }
    const finishResults = await Promise.all([
      dispatcher.post(`/jornadas/${journeyId}/finalizar`).send(finishPayload),
      dispatcher.post(`/jornadas/${journeyId}/finalizar`).send(finishPayload),
    ])
    expect(finishResults.map((result) => result.status).sort()).toEqual([200, 409])
    expect(
      await prisma.lecturaKilometraje.count({
        where: { jornadaOperativaId: journeyId, tipo: 'FIN_JORNADA' },
      }),
    ).toBe(1)
    const readings = await prisma.lecturaKilometraje.findMany({
      where: { jornadaOperativaId: journeyId },
    })
    expect(readings).toHaveLength(2)
    expect(readings.every((reading) => reading.observadoPorId === journeyDriver.id)).toBe(true)
    expect(
      readings.every(
        (reading) => reading.registradoPorId !== journeyDriver.id && !!reading.motivoRespaldo,
      ),
    ).toBe(true)
  }, 60_000)

  it('mantiene AsignacionConductor solo como lectura historica', async () => {
    const bus = await createBus()
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    await dispatcher
      .post(`/flota/buses/${bus.id}/asignaciones`)
      .send({ conductorId: fixture.conductorId })
      .expect(404)
    await dispatcher.get(`/flota/buses/${bus.id}/asignaciones`).expect(200)
  }, 60_000)

  it('interrumpe antes del fin con lectura real y permite una sucesora con otro bus', async () => {
    const original = await createBus()
    const replacement = await createBus()
    const operator = await createDriver('interrupcion-lectura')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const driver = await loginAgent(operator.email)
    const startAt = past(100)
    const interruptAt = past(60)
    const programmedEnd = past(20)
    const scheduled = await programJourney(dispatcher, {
      busId: original.id,
      conductorId: operator.id,
      inicioProgramado: past(110),
      finProgramado: programmedEnd,
    })
    expect(scheduled.status).toBe(201)
    const id = scheduled.body.data.jornada.id as string
    await driver
      .post(`/jornadas/${id}/iniciar`)
      .send({ fechaEvento: startAt.toISOString(), kilometraje: 1000 })
      .expect(200)
    await dispatcher
      .post(`/jornadas/${id}/interrumpir`)
      .send({
        fechaEvento: interruptAt.toISOString(),
        motivo: 'El bus perdió potencia durante el recorrido',
        kilometrajeFinal: 1025,
      })
      .expect(400)
    const interrupted = await dispatcher
      .post(`/jornadas/${id}/interrumpir`)
      .send({
        fechaEvento: interruptAt.toISOString(),
        motivo: 'El bus perdió potencia durante el recorrido',
        kilometrajeFinal: 1025,
        observadoPorId: operator.id,
        motivoRespaldo: 'Lectura comunicada por el Conductor al detenerse',
      })
      .expect(200)
    expect(interrupted.body.data.jornada).toMatchObject({
      estado: 'INTERRUMPIDA',
      finReal: interruptAt.toISOString(),
      lecturaFinal: { kilometraje: 1025, observadoPor: { id: operator.id } },
      interrupcion: { estadoConciliacion: 'LECTURA_FINAL_REGISTRADA' },
    })
    expect(
      (await prisma.bus.findUniqueOrThrow({ where: { id: original.id } })).estadoOperativo,
    ).toBe('FUERA_DE_SERVICIO')
    await dispatcher
      .post(`/jornadas/${id}/reasignar`)
      .send({
        busId: original.id,
        fechaEvento: past(55).toISOString(),
        motivo: 'Continuidad del servicio',
      })
      .expect(400)
    const successor = await dispatcher
      .post(`/jornadas/${id}/reasignar`)
      .send({
        busId: replacement.id,
        conductorId: operator.id,
        fechaEvento: past(55).toISOString(),
        inicioProgramado: past(45).toISOString(),
        finProgramado: past(5).toISOString(),
        motivo: 'Continuidad con bus sustituto',
      })
      .expect(201)
    created.jornadas.push(successor.body.data.jornadaSucesora.id as string)
    expect(successor.body.data.jornadaAnterior.estado).toBe('INTERRUMPIDA')
    expect(successor.body.data.jornadaSucesora.jornadaAnteriorId).toBe(id)
    expect(successor.body.data.jornadaSucesora.bus.id).toBe(replacement.id)
    expect(successor.body.data.jornadaSucesora.motivoSucesion).toBe('Continuidad con bus sustituto')
    await dispatcher
      .post(`/jornadas/${id}/reasignar`)
      .send({
        busId: replacement.id,
        fechaEvento: past(54).toISOString(),
        motivo: 'Duplicado de reemplazo',
      })
      .expect(409)
  }, 60_000)

  it('interrumpe sin lectura, conserva motivo y concilia solo un dato observado al detenerse', async () => {
    const bus = await createBus()
    const operator = await createDriver('interrupcion-sin-lectura')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const driver = await loginAgent(operator.email)
    const mechanic = await loginAgent(fixture.mecanicoEmail)
    const startAt = past(100)
    const interruptAt = past(55)
    const scheduled = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: operator.id,
      inicioProgramado: past(110),
      finProgramado: past(10),
    })
    expect(scheduled.status).toBe(201)
    const id = scheduled.body.data.jornada.id as string
    await driver
      .post(`/jornadas/${id}/iniciar`)
      .send({ fechaEvento: startAt.toISOString(), kilometraje: 2000 })
      .expect(200)
    await driver
      .post(`/jornadas/${id}/interrumpir`)
      .send({
        fechaEvento: interruptAt.toISOString(),
        motivo: 'El bus se detuvo por falla',
        motivoSinLectura: 'Odómetro inaccesible',
      })
      .expect(403)
    const interrupted = await dispatcher
      .post(`/jornadas/${id}/interrumpir`)
      .send({
        fechaEvento: interruptAt.toISOString(),
        motivo: 'El bus se detuvo por falla',
        motivoSinLectura: 'Odómetro inaccesible',
      })
      .expect(200)
    expect(interrupted.body.data.jornada).toMatchObject({
      estado: 'INTERRUMPIDA',
      lecturaFinal: null,
      interrupcion: {
        estadoConciliacion: 'PENDIENTE',
        motivoAusenciaLectura: 'Odómetro inaccesible',
      },
    })
    await mechanic
      .post(`/jornadas/${id}/conciliar-lectura-final`)
      .send({
        kilometraje: 2010,
        observadoPorId: operator.id,
        declaracionObservacion: 'Se observó al detenerse',
      })
      .expect(403)
    await dispatcher
      .post(`/jornadas/${id}/conciliar-lectura-final`)
      .send({
        kilometraje: 2010,
        observadoPorId: operator.id,
        declaracionObservacion: 'El Conductor anotó la lectura al detenerse y la comunicó después',
        motivoRespaldo: 'El Conductor entregó después su anotación física del momento',
      })
      .expect(400)
    await dispatcher
      .post(`/jornadas/${id}/conciliar-lectura-final`)
      .send({
        kilometraje: 2010,
        observadoPorId: operator.id,
        declaracionObservacion: 'El Conductor anotó la lectura al detenerse y la comunicó después',
        motivoRespaldo: 'El Conductor entregó después su anotación física del momento',
        confirmadaEnInterrupcion: true,
      })
      .expect(200)
    const reading = await prisma.lecturaKilometraje.findFirstOrThrow({
      where: { jornadaOperativaId: Number(id), tipo: 'FIN_JORNADA' },
    })
    expect(reading.fechaLectura).toEqual(interruptAt)
    expect(reading.observadoPorId).toBe(operator.id)
    const reconciled = await prisma.jornadaOperativa.findUniqueOrThrow({
      where: { id: Number(id) },
    })
    expect(reconciled.motivoAusenciaLectura).toBe('Odómetro inaccesible')
    await dispatcher
      .post(`/jornadas/${id}/declarar-lectura-no-recuperable`)
      .send({ motivo: 'Otro cierre' })
      .expect(403)
  }, 60_000)

  it('declara la lectura no recuperable sin alterar el odómetro ni rehabilitar el bus', async () => {
    const bus = await createBus()
    const operator = await createDriver('dato-irrecuperable')
    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const admin = await loginAgent(fixture.adminEmail)
    const driver = await loginAgent(operator.email)
    const scheduled = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: operator.id,
      inicioProgramado: past(100),
      finProgramado: past(10),
    })
    expect(scheduled.status).toBe(201)
    const id = scheduled.body.data.jornada.id as string
    await driver
      .post(`/jornadas/${id}/iniciar`)
      .send({ fechaEvento: past(90).toISOString(), kilometraje: 3000 })
      .expect(200)
    await dispatcher
      .post(`/jornadas/${id}/interrumpir`)
      .send({
        fechaEvento: past(50).toISOString(),
        motivo: 'Avería del tablero de instrumentos',
        motivoSinLectura: 'Pantalla del odómetro apagada',
      })
      .expect(200)
    const before = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })
    await dispatcher
      .post(`/jornadas/${id}/declarar-lectura-no-recuperable`)
      .send({
        motivo: 'El tablero averiado no conservó la lectura del tramo',
      })
      .expect(403)
    const closed = await admin
      .post(`/jornadas/${id}/declarar-lectura-no-recuperable`)
      .send({
        motivo: 'El tablero averiado no conservó la lectura del tramo',
      })
      .expect(200)
    expect(closed.body.data.jornada.interrupcion.estadoConciliacion).toBe('NO_RECUPERABLE')
    await admin
      .post(`/jornadas/${id}/declarar-lectura-no-recuperable`)
      .send({
        motivo: 'Repetición administrativa',
      })
      .expect(409)
    await dispatcher
      .post(`/jornadas/${id}/conciliar-lectura-final`)
      .send({
        kilometraje: 3020,
        observadoPorId: operator.id,
        motivoRespaldo: 'Valor comunicado después',
        declaracionObservacion: 'Se encontró una lectura en taller más tarde',
        confirmadaEnInterrupcion: true,
      })
      .expect(409)
    const after = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })
    expect(after.kilometrajeActual).toBe(before.kilometrajeActual)
    expect(after.estadoOperativo).toBe('FUERA_DE_SERVICIO')
    expect(
      await prisma.lecturaKilometraje.count({
        where: { jornadaOperativaId: Number(id), tipo: 'FIN_JORNADA' },
      }),
    ).toBe(0)
    await expect(
      prisma.jornadaOperativa.update({
        where: { id: Number(id) },
        data: { motivoNoRecuperable: 'Cambio encubierto de la decisión' },
      }),
    ).rejects.toThrow()

    const order = await admin
      .post('/ordenes-trabajo')
      .send({
        busId: bus.id,
        descripcion: 'Revisar tablero y odómetro después de la interrupción',
        prioridad: 'ALTA',
      })
      .expect(201)
    const orderId = order.body.data.orden.id as string
    created.ordenes.push(orderId)
    const mechanic = await loginAgent(fixture.mecanicoEmail)
    await admin
      .post(`/ordenes-trabajo/${orderId}/asignar`)
      .send({ tecnicoId: fixture.mecanicoId })
      .expect(200)
    await mechanic.post(`/ordenes-trabajo/${orderId}/iniciar`).send({}).expect(200)
    const workshopAt = new Date()
    await mechanic
      .post(`/ordenes-trabajo/${orderId}/lecturas`)
      .send({
        fechaEvento: workshopAt.toISOString(),
        kilometraje: 3020,
        motivo: 'Lectura física posterior en el taller',
        tipo: 'INGRESO_TALLER',
      })
      .expect(201)
    const workshopReading = await prisma.lecturaKilometraje.findFirstOrThrow({
      where: { ordenTrabajoId: Number(orderId), tipo: 'INGRESO_TALLER' },
    })
    expect(workshopReading.fechaLectura).toEqual(workshopAt)
    expect(workshopReading.jornadaOperativaId).toBeNull()
    await mechanic
      .patch(`/ordenes-trabajo/${orderId}/intervencion`)
      .send({
        diagnostico: 'Se reparó el tablero de instrumentos y se verificó el odómetro',
        observaciones: 'La lectura histórica del tramo no pudo reconstruirse',
      })
      .expect(200)
    await mechanic
      .post(`/ordenes-trabajo/${orderId}/actividades`)
      .send({
        descripcion: 'Reparación y verificación física del odómetro',
      })
      .expect(201)
    await mechanic.post(`/ordenes-trabajo/${orderId}/completar`).send({}).expect(200)
    await admin
      .post(`/ordenes-trabajo/${orderId}/cerrar`)
      .send({
        observacion: 'Reparación validada; no se imputa kilometraje al tramo interrumpido',
      })
      .expect(200)
    await admin
      .post(`/flota/buses/${bus.id}/estado`)
      .send({
        estadoNuevo: 'OPERATIVO',
        motivo: 'Tablero reparado y orden técnica cerrada',
      })
      .expect(200)
    const next = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: operator.id,
      inicioProgramado: new Date(Date.now() + 3_600_000),
      finProgramado: new Date(Date.now() + 3 * 3_600_000),
    })
    expect(next.status).toBe(201)
    expect(
      await prisma.lecturaKilometraje.count({
        where: { jornadaOperativaId: Number(id), tipo: 'FIN_JORNADA' },
      }),
    ).toBe(0)
    expect(
      (await prisma.jornadaOperativa.findUniqueOrThrow({ where: { id: Number(id) } }))
        .estadoConciliacionLectura,
    ).toBe('NO_RECUPERABLE')
  }, 60_000)
})
