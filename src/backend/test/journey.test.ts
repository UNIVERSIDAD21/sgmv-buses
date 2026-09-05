import { randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const created = {
  buses: [] as string[],
  jornadas: [] as string[],
  lecturas: [] as string[],
  rutas: [] as string[],
  usuarios: [] as string[],
}

interface JourneyFixture {
  adminEmail: string
  conductorEmail: string
  conductorId: string
  conductorOtroEmail: string
  conductorOtroId: string
  despachadorEmail: string
  mecanicoEmail: string
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
  const id = randomUUID()
  created.usuarios.push(id)
  return prisma.usuario.create({
    data: {
      contrasenaHash: await hash(password, 10),
      email: `jornada-${label}-${id.slice(0, 8)}@test.sgmv.local`,
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
  }
}

async function createDriver(label: string) {
  const roles = await ensureRoles()
  return createUser(label, roles.CONDUCTOR)
}

async function createBus(estadoOperativo: 'OPERATIVO' | 'EN_MANTENIMIENTO' = 'OPERATIVO') {
  const id = randomUUID()
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
  const id = randomUUID()
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
    busId: string
    conductorId: string
    finProgramado?: Date
    inicioProgramado?: Date
    rutaId?: string
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
    await tx.alertaDestinatario.deleteMany({ where: { usuarioId: { in: created.usuarios } } })
    await tx.alertaInterna.deleteMany({ where: { jornadaOperativaId: { in: created.jornadas } } })
    await tx.novedad.deleteMany({ where: { jornadaOperativaId: { in: created.jornadas } } })
    await tx.ordenTrabajo.deleteMany({ where: { jornadaOperativaId: { in: created.jornadas } } })
    await tx.lecturaKilometraje.deleteMany({
      where: {
        OR: [{ id: { in: created.lecturas } }, { jornadaOperativaId: { in: created.jornadas } }],
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
    const firstId = randomUUID()
    const nextId = randomUUID()
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
    const programmed = await programJourney(dispatcher, {
      busId: bus.id,
      conductorId: journeyDriver.id,
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
    const startPayload = { fechaEvento: past(90).toISOString(), kilometraje: 700 }

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

    const finishPayload = { fechaEvento: past(45).toISOString(), kilometraje: 750 }
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
})
