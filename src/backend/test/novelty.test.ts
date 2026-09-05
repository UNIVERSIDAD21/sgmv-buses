import { randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import { createApp } from '../src/app.js'
import { NoveltyService } from '../src/novelties/novelty.service.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'

const created = {
  buses: [] as string[],
  jornadas: [] as string[],
  lecturas: [] as string[],
  novedades: [] as string[],
  ordenes: [] as string[],
  usuarios: [] as string[],
}

interface NoveltyFixture {
  adminEmail: string
  adminId: string
  conductorAltEmail: string
  conductorAltId: string
  conductorEmail: string
  conductorId: string
  conductorSinBusEmail: string
  conductorSinBusId: string
  despachadorEmail: string
  despachadorId: string
  mecanicoEmail: string
}

function shortCode() {
  return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}

function uniquePlate(prefix = 'N') {
  return `${prefix}${shortCode().slice(0, 6)}`
}

function uniqueBusCode(prefix = 'NOV-BUS') {
  return `${prefix}-${shortCode()}`
}

async function ensureRoles() {
  const [admin, despachador, mecanico, conductor] = await Promise.all([
    prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
      create: {
        codigo: 'ADMINISTRADOR',
        nombre: 'Administrador',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'DESPACHADOR' },
      update: {},
      create: {
        codigo: 'DESPACHADOR',
        nombre: 'Despachador',
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
      update: {},
      create: {
        codigo: 'CONDUCTOR',
        nombre: 'Conductor',
      },
    }),
  ])

  return { admin, conductor, despachador, mecanico }
}

async function createUser(email: string, role: Rol) {
  const id = randomUUID()
  created.usuarios.push(id)

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

async function createBus() {
  const id = randomUUID()
  created.buses.push(id)

  return prisma.bus.create({
    data: {
      id,
      anio: 2022,
      codigoInterno: uniqueBusCode(),
      kilometrajeActual: 25000,
      marca: 'Marca Novedad',
      modelo: 'Modelo Novedad',
      placa: uniquePlate(),
    },
  })
}

async function createAssignment(conductorId: string, busId: string, adminId: string) {
  return prisma.asignacionConductor.create({
    data: {
      asignadoPorId: adminId,
      busId,
      conductorId,
      motivo: 'Asignacion para RF-02',
    },
  })
}

async function createActiveJourney(conductorId: string, busId: string, adminId: string) {
  const journeyId = randomUUID()
  const readingId = randomUUID()
  const startedAt = new Date(Date.now() - 30 * 60_000)
  created.jornadas.push(journeyId)
  created.lecturas.push(readingId)

  await prisma.$transaction(async (tx) => {
    await tx.jornadaOperativa.create({
      data: {
        busId,
        conductorId,
        estado: 'EN_CURSO',
        finProgramado: new Date(Date.now() + 90 * 60_000),
        id: journeyId,
        iniciadaPorId: conductorId,
        inicioProgramado: new Date(startedAt.getTime() - 30 * 60_000),
        inicioReal: startedAt,
        programadaPorId: adminId,
      },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId,
        fechaLectura: startedAt,
        id: readingId,
        jornadaOperativaId: journeyId,
        kilometrajeAnterior: 25000,
        kilometrajeNuevo: 25010,
        motivo: 'Inicio de jornada de prueba RF-02',
        registradoPorId: conductorId,
        tipo: 'INICIO_JORNADA',
      },
    })
    await tx.bus.update({ data: { kilometrajeActual: 25010 }, where: { id: busId } })
  })

  return { journeyId, startedAt }
}

async function finishJourney(
  journeyId: string,
  busId: string,
  conductorId: string,
  finishedAt = new Date(Date.now() - 2 * 60_000),
) {
  const readingId = randomUUID()
  created.lecturas.push(readingId)

  await prisma.$transaction(async (tx) => {
    const previous = await tx.lecturaKilometraje.findFirstOrThrow({
      orderBy: { fechaLectura: 'desc' },
      where: { busId },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId,
        fechaLectura: finishedAt,
        id: readingId,
        jornadaOperativaId: journeyId,
        kilometrajeAnterior: previous.kilometrajeNuevo,
        kilometrajeNuevo: 25030,
        motivo: 'Fin de jornada de prueba RF-02',
        registradoPorId: conductorId,
        tipo: 'FIN_JORNADA',
      },
    })
    await tx.jornadaOperativa.update({
      data: {
        estado: 'FINALIZADA',
        finalizadaPorId: conductorId,
        finReal: finishedAt,
      },
      where: { id: journeyId },
    })
    await tx.bus.update({ data: { kilometrajeActual: 25030 }, where: { id: busId } })
  })

  return finishedAt
}

async function createProgrammedJourney(conductorId: string, busId: string, adminId: string) {
  const journeyId = randomUUID()
  created.jornadas.push(journeyId)
  await prisma.jornadaOperativa.create({
    data: {
      busId,
      conductorId,
      estado: 'PROGRAMADA',
      finProgramado: new Date(Date.now() + 60 * 60_000),
      id: journeyId,
      inicioProgramado: new Date(Date.now() - 60_000),
      programadaPorId: adminId,
    },
  })
  return journeyId
}

async function createNovelty(conductorId: string, busId: string, overrides = {}) {
  const novelty = await prisma.novedad.create({
    data: {
      busId,
      conductorId,
      descripcion: 'Descripcion de novedad creada para pruebas automatizadas RF-02',
      tipo: 'Falla mecanica',
      ...overrides,
    },
  })
  created.novedades.push(novelty.id)

  return novelty
}

async function createFixture(): Promise<NoveltyFixture> {
  const roles = await ensureRoles()
  const suffix = shortCode().toLowerCase()
  const admin = await createUser(`nov-admin-${suffix}@test.sgmv.local`, roles.admin)
  const despachador = await createUser(
    `nov-despachador-${suffix}@test.sgmv.local`,
    roles.despachador,
  )
  const mecanico = await createUser(`nov-mecanico-${suffix}@test.sgmv.local`, roles.mecanico)
  const conductor = await createUser(`nov-conductor-${suffix}@test.sgmv.local`, roles.conductor)
  const conductorAlt = await createUser(
    `nov-conductor-alt-${suffix}@test.sgmv.local`,
    roles.conductor,
  )
  const conductorSinBus = await createUser(
    `nov-conductor-sin-bus-${suffix}@test.sgmv.local`,
    roles.conductor,
  )

  return {
    adminEmail: admin.email,
    adminId: admin.id,
    conductorAltEmail: conductorAlt.email,
    conductorAltId: conductorAlt.id,
    conductorEmail: conductor.email,
    conductorId: conductor.id,
    conductorSinBusEmail: conductorSinBus.email,
    conductorSinBusId: conductorSinBus.id,
    despachadorEmail: despachador.email,
    despachadorId: despachador.id,
    mecanicoEmail: mecanico.email,
  }
}

async function loginAgent(email: string) {
  const agent = await createCsrfAgent(createApp())

  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)

  return agent
}

async function cleanup() {
  const orderIds = [
    ...created.ordenes,
    ...(
      await prisma.ordenTrabajo.findMany({
        select: { id: true },
        where: {
          novedadId: {
            in: created.novedades,
          },
        },
      })
    ).map((order) => order.id),
  ]
  const uniqueOrderIds = [...new Set(orderIds)]
  const alertIds = (
    await prisma.alertaInterna.findMany({
      select: { id: true },
      where: {
        OR: [
          { jornadaOperativaId: { in: created.jornadas } },
          { novedadId: { in: created.novedades } },
        ],
      },
    })
  ).map((alert) => alert.id)

  await prisma.$transaction(
    async (tx) => {
      await tx.alertaDestinatario.deleteMany({ where: { alertaInternaId: { in: alertIds } } })
      await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
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
      await tx.novedad.deleteMany({
        where: {
          id: {
            in: created.novedades,
          },
        },
      })
      await tx.lecturaKilometraje.deleteMany({
        where: {
          OR: [{ id: { in: created.lecturas } }, { jornadaOperativaId: { in: created.jornadas } }],
        },
      })
      await tx.jornadaOperativa.deleteMany({ where: { id: { in: created.jornadas } } })
      await tx.asignacionConductor.deleteMany({
        where: {
          OR: [
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
            {
              busId: {
                in: created.buses,
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

describe('RF-02 Novelty API', () => {
  let fixture: NoveltyFixture

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

  it('requires authentication and denies mechanics access to RF-02', async () => {
    await request(createApp()).get('/novedades').expect(401)

    const mecanico = await loginAgent(fixture.mecanicoEmail)
    await mecanico.get('/novedades').expect(403)
    await mecanico
      .post('/novedades')
      .send({ descripcion: 'Falla detectada', tipo: 'Falla' })
      .expect(403)
  })

  it('creates a novelty from the journey context and derives bus and author from session', async () => {
    const bus = await createBus()
    const { journeyId } = await createActiveJourney(fixture.conductorId, bus.id, fixture.adminId)
    const conductor = await loginAgent(fixture.conductorEmail)

    const spoofedBus = await createBus()
    const response = await conductor
      .post('/novedades')
      .send({
        descripcion: 'Ruido fuerte en el sistema de frenos durante operacion',
        fechaOcurrencia: new Date(Date.now() - 5 * 60_000).toISOString(),
        kilometraje: 25020,
        tipo: 'Falla de frenos',
      })
      .expect(201)
    const noveltyId = response.body.data.novedad.id as string
    created.novedades.push(noveltyId)

    expect(response.body.data.novedad.bus.id).toBe(bus.id)
    expect(response.body.data.novedad.conductor.id).toBe(fixture.conductorId)
    expect(response.body.data.novedad.jornada.id).toBe(journeyId)
    expect(response.body.data.novedad.lecturaKilometraje.kilometraje).toBe(25020)
    expect(response.body.data.novedad.estado).toBe('PENDIENTE_REVISION')

    await conductor
      .post('/novedades')
      .send({
        busId: spoofedBus.id,
        conductorId: fixture.conductorAltId,
        descripcion: 'Intento de suplantacion de bus y conductor',
        fechaOcurrencia: new Date(Date.now() - 4 * 60_000).toISOString(),
        kilometraje: 25021,
        tipo: 'Falla electrica',
      })
      .expect(400)
  }, 60000)

  it('blocks novelty registration when no own journey contains the event', async () => {
    const conductor = await loginAgent(fixture.conductorSinBusEmail)

    const response = await conductor
      .post('/novedades')
      .send({
        descripcion: 'No deberia poder registrar sin bus asignado',
        fechaOcurrencia: new Date(Date.now() - 5 * 60_000).toISOString(),
        kilometraje: 25020,
        tipo: 'Falla general',
      })
      .expect(409)

    expect(response.body.error.code).toBe('JOURNEY_NOT_FOUND_FOR_EVENT')
  }, 60000)

  it('allows the driver to list and detail only their own novelties', async () => {
    const bus = await createBus()
    const otherBus = await createBus()
    await createAssignment(fixture.conductorAltId, otherBus.id, fixture.adminId)
    const ownNovelty = await createNovelty(fixture.conductorId, bus.id)
    const foreignNovelty = await createNovelty(fixture.conductorAltId, otherBus.id)
    const conductor = await loginAgent(fixture.conductorEmail)

    const list = await conductor.get('/novedades/mis-novedades').expect(200)
    const ids = list.body.data.novedades.map((novelty: { id: string }) => novelty.id)

    expect(ids).toContain(ownNovelty.id)
    expect(ids).not.toContain(foreignNovelty.id)

    await conductor.get(`/novedades/mis-novedades/${ownNovelty.id}`).expect(200)
    await conductor.get(`/novedades/mis-novedades/${foreignNovelty.id}`).expect(404)
  }, 60000)

  it('lets admins list, search, filter and summarize all novelties', async () => {
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id, {
      clasificacion: 'Urgente',
      tipo: 'Falla electrica',
    })
    const admin = await loginAgent(fixture.adminEmail)

    const list = await admin
      .get('/novedades')
      .query({
        busqueda: novelty.tipo,
        clasificacion: 'Urgente',
        estado: 'PENDIENTE_REVISION',
        limite: 5,
        pagina: 1,
      })
      .expect(200)

    expect(list.body.data.novedades.some((item: { id: string }) => item.id === novelty.id)).toBe(
      true,
    )
    expect(list.body.data.paginacion.total).toBeGreaterThanOrEqual(1)

    const summary = await admin.get('/novedades/resumen').expect(200)
    expect(summary.body.data.total).toBeGreaterThanOrEqual(1)
    expect(summary.body.data.estados.PENDIENTE_REVISION).toBeGreaterThanOrEqual(1)
  }, 60000)

  it('validates input fields for novelty creation and review actions', async () => {
    const conductor = await loginAgent(fixture.conductorEmail)
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id)

    await conductor
      .post('/novedades')
      .send({
        descripcion: 'corta',
        tipo: 'ok',
      })
      .expect(400)

    await admin
      .post(`/novedades/${novelty.id}/revision`)
      .send({
        accion: 'CLASIFICAR',
      })
      .expect(400)
  }, 60000)

  it('applies valid review transitions and blocks terminal state modifications', async () => {
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id)
    const admin = await loginAgent(fixture.adminEmail)

    const classified = await admin
      .post(`/novedades/${novelty.id}/revision`)
      .send({
        accion: 'CLASIFICAR',
        afectaOperacion: true,
        bloqueaDisponibilidad: false,
        clasificacion: 'Requiere revision tecnica',
        criticidad: 'ALTA',
        observacion: 'Se clasifica antes de decidir',
      })
      .expect(200)
    expect(classified.body.data.novedad.estado).toBe('PENDIENTE_REVISION')
    expect(classified.body.data.novedad.clasificacion).toBe('Requiere revision tecnica')

    const resolved = await admin
      .post(`/novedades/${novelty.id}/revision`)
      .send({
        accion: 'RESOLVER_SIN_ORDEN',
        clasificacion: 'Sin falla activa',
        observacion: 'Se resolvio en inspeccion de patio',
      })
      .expect(200)
    expect(resolved.body.data.novedad.estado).toBe('RESUELTA_SIN_ORDEN')

    await admin
      .post(`/novedades/${novelty.id}/revision`)
      .send({
        accion: 'DESCARTAR',
        observacion: 'Intento posterior no permitido',
      })
      .expect(400)
  }, 60000)

  it('rejects invalid direct state values by using controlled actions only', async () => {
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id)
    const admin = await loginAgent(fixture.adminEmail)

    await admin
      .post(`/novedades/${novelty.id}/revision`)
      .send({
        accion: 'CONVERTIDA_A_ORDEN',
        observacion: 'No se acepta estado arbitrario',
      })
      .expect(400)
  }, 60000)

  it('accepts an idempotent late report and inserts its reading inside the finished journey', async () => {
    const roles = await ensureRoles()
    const driver = await createUser(
      `nov-tardio-${shortCode().toLowerCase()}@test.sgmv.local`,
      roles.conductor,
    )
    const bus = await createBus()
    const { journeyId } = await createActiveJourney(driver.id, bus.id, fixture.adminId)
    await finishJourney(journeyId, bus.id, driver.id)
    const conductor = await loginAgent(driver.email)
    const idempotencyKey = randomUUID()
    const occurrence = new Date(Date.now() - 5 * 60_000)
    const payload = {
      descripcion: 'Vibracion observada antes de finalizar la jornada operativa',
      fechaOcurrencia: occurrence.toISOString(),
      kilometraje: 25020,
      tipo: 'Vibracion tardia',
    }

    const first = await conductor
      .post('/novedades')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201)
    const second = await conductor
      .post('/novedades')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201)
    const noveltyId = first.body.data.novedad.id as string
    created.novedades.push(noveltyId)

    const [noveltyCount, reading, finalReading] = await Promise.all([
      prisma.novedad.count({ where: { id: noveltyId } }),
      prisma.lecturaKilometraje.findUniqueOrThrow({
        where: { id: first.body.data.novedad.lecturaKilometraje.id },
      }),
      prisma.lecturaKilometraje.findFirstOrThrow({
        where: { jornadaOperativaId: journeyId, tipo: 'FIN_JORNADA' },
      }),
    ])

    expect(second.body.data.novedad.id).toBe(noveltyId)
    expect(first.body.data.novedad).toMatchObject({
      bus: { id: bus.id },
      conductor: { id: driver.id },
      jornada: { id: journeyId },
      lecturaKilometraje: { kilometraje: 25020, kilometrajeAnterior: 25010 },
    })
    expect(noveltyCount).toBe(1)
    expect(reading.tipo).toBe('NOVEDAD')
    expect(finalReading.kilometrajeAnterior).toBe(25020)
  }, 60000)

  it('classifies critical impact transactionally, routes alerts and protects dispatcher projection', async () => {
    const roles = await ensureRoles()
    const driver = await createUser(
      `nov-critico-${shortCode().toLowerCase()}@test.sgmv.local`,
      roles.conductor,
    )
    const bus = await createBus()
    const { journeyId } = await createActiveJourney(driver.id, bus.id, fixture.adminId)
    const conductor = await loginAgent(driver.email)
    const occurrence = new Date(Date.now() - 5 * 60_000)
    const report = await conductor
      .post('/novedades')
      .send({
        descripcion: 'Perdida total de presion con impacto inmediato en la operacion',
        fechaOcurrencia: occurrence.toISOString(),
        kilometraje: 25020,
        tipo: 'Falla critica de frenos',
      })
      .expect(201)
    const noveltyId = report.body.data.novedad.id as string
    created.novedades.push(noveltyId)
    const admin = await loginAgent(fixture.adminEmail)

    await admin
      .post(`/novedades/${noveltyId}/revision`)
      .send({
        accion: 'CLASIFICAR',
        afectaOperacion: true,
        bloqueaDisponibilidad: true,
        clasificacion: 'Falla critica de seguridad',
        criticidad: 'CRITICA',
        observacion: 'Retirar el bus y coordinar reemplazo inmediato',
      })
      .expect(200)

    const alerts = await prisma.alertaInterna.findMany({
      include: { destinatarios: { include: { usuario: { include: { rol: true } } } } },
      orderBy: { tipo: 'asc' },
      where: { novedadId: noveltyId },
    })
    expect(alerts.map((alert) => alert.tipo).sort()).toEqual(['BUS_BLOQUEADO', 'NOVEDAD_CRITICA'])

    const critical = alerts.find((alert) => alert.tipo === 'NOVEDAD_CRITICA')!
    const blocked = alerts.find((alert) => alert.tipo === 'BUS_BLOQUEADO')!
    expect(new Set(critical.destinatarios.map((item) => item.usuario.rol.codigo))).toEqual(
      new Set(['ADMINISTRADOR', 'DESPACHADOR']),
    )
    expect(blocked.destinatarios.some((item) => item.usuarioId === driver.id)).toBe(true)
    expect(
      blocked.destinatarios.every(
        (item) => item.usuarioId === driver.id || item.usuario.rol.codigo === 'DESPACHADOR',
      ),
    ).toBe(true)
    expect(JSON.stringify(alerts.map((alert) => alert.contextoEvento))).not.toContain(
      'Retirar el bus',
    )
    expect(JSON.stringify(alerts.map((alert) => alert.contextoEvento))).not.toContain(
      'Falla critica de seguridad',
    )

    const dispatcher = await loginAgent(fixture.despachadorEmail)
    const detail = await dispatcher.get(`/novedades/${noveltyId}`).expect(200)
    expect(detail.body.data.novedad).toMatchObject({
      acciones: { puedeCoordinarJornada: true, puedeRevisar: false },
      jornada: { id: journeyId },
      observacionRevision: null,
    })
    expect(detail.body.data.novedad.conductor.email).toBeUndefined()
    expect(detail.body.data.novedad.revisadaPor.email).toBeUndefined()
    await dispatcher
      .post(`/novedades/${noveltyId}/revision`)
      .send({ accion: 'RESOLVER_SIN_ORDEN', observacion: 'No autorizado' })
      .expect(403)
  }, 60000)

  it('keeps the bus blocked across novelty conversion and preserves the journey trace', async () => {
    const roles = await ensureRoles()
    const driver = await createUser(
      `nov-conversion-${shortCode().toLowerCase()}@test.sgmv.local`,
      roles.conductor,
    )
    const nextDriver = await createUser(
      `nov-conversion-next-${shortCode().toLowerCase()}@test.sgmv.local`,
      roles.conductor,
    )
    const bus = await createBus()
    const { journeyId } = await createActiveJourney(driver.id, bus.id, fixture.adminId)
    const conductor = await loginAgent(driver.email)
    const report = await conductor
      .post('/novedades')
      .send({
        descripcion: 'Perdida de potencia que impide continuar con seguridad',
        fechaOcurrencia: new Date(Date.now() - 5 * 60_000).toISOString(),
        kilometraje: 25020,
        tipo: 'Falla de motor bloqueante',
      })
      .expect(201)
    const noveltyId = report.body.data.novedad.id as string
    created.novedades.push(noveltyId)
    const admin = await loginAgent(fixture.adminEmail)

    await admin
      .post(`/novedades/${noveltyId}/revision`)
      .send({
        accion: 'CLASIFICAR',
        afectaOperacion: true,
        bloqueaDisponibilidad: true,
        clasificacion: 'Falla motriz bloqueante',
        criticidad: 'ALTA',
      })
      .expect(200)
    await finishJourney(journeyId, bus.id, driver.id)
    const nextJourneyId = await createProgrammedJourney(nextDriver.id, bus.id, fixture.adminId)

    const beforeConversion = await admin
      .post(`/jornadas/${nextJourneyId}/iniciar`)
      .send({ fechaEvento: new Date().toISOString(), kilometraje: 25030 })
      .expect(409)
    expect(beforeConversion.body.error.details.causaPrincipal).toBe('NOVEDAD_BLOQUEANTE')

    const converted = await admin
      .post(`/novedades/${noveltyId}/convertir-orden`)
      .send({ prioridad: 'ALTA' })
      .expect(200)
    created.ordenes.push(converted.body.data.orden.id as string)
    const storedOrder = await prisma.ordenTrabajo.findUniqueOrThrow({
      where: { id: converted.body.data.orden.id },
    })
    expect(storedOrder.jornadaOperativaId).toBe(journeyId)

    const afterConversion = await admin
      .post(`/jornadas/${nextJourneyId}/iniciar`)
      .send({ fechaEvento: new Date().toISOString(), kilometraje: 25030 })
      .expect(409)
    expect(afterConversion.body.error.details.causaPrincipal).toBe('ORDEN_TECNICA_ACTIVA')
  }, 60000)

  it('converts an eligible novelty into one corrective order with same bus and initial history', async () => {
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id, {
      clasificacion: 'Correctiva alta',
      descripcion: 'Perdida de potencia reportada durante el recorrido',
      tipo: 'Falla motor',
    })
    const admin = await loginAgent(fixture.adminEmail)

    const response = await admin
      .post(`/novedades/${novelty.id}/convertir-orden`)
      .send({
        observacion: 'Generar orden correctiva',
        prioridad: 'ALTA',
      })
      .expect(200)
    const orderId = response.body.data.orden.id as string
    created.ordenes.push(orderId)

    expect(response.body.data.novedad.estado).toBe('CONVERTIDA_A_ORDEN')
    expect(response.body.data.orden.estado).toBe('PENDIENTE_ASIGNACION')
    expect(response.body.data.orden.prioridad).toBe('ALTA')

    const order = await prisma.ordenTrabajo.findUniqueOrThrow({
      include: {
        estadosHistorial: true,
      },
      where: { id: orderId },
    })

    expect(order.busId).toBe(bus.id)
    expect(order.novedadId).toBe(novelty.id)
    expect(order.tipo).toBe('CORRECTIVA')
    expect(order.origen).toBe('NOVEDAD')
    expect(order.tecnicoAsignadoId).toBeNull()
    expect(order.estadosHistorial[0].estadoNuevo).toBe('PENDIENTE_ASIGNACION')
  }, 60000)

  it('keeps conversion idempotent and prevents duplicate orders', async () => {
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id)
    const admin = await loginAgent(fixture.adminEmail)

    const first = await admin
      .post(`/novedades/${novelty.id}/convertir-orden`)
      .send({ prioridad: 'MEDIA' })
      .expect(200)
    created.ordenes.push(first.body.data.orden.id)

    const second = await admin
      .post(`/novedades/${novelty.id}/convertir-orden`)
      .send({ prioridad: 'ALTA' })
      .expect(200)

    const count = await prisma.ordenTrabajo.count({ where: { novedadId: novelty.id } })

    expect(second.body.data.yaExistia).toBe(true)
    expect(second.body.data.orden.id).toBe(first.body.data.orden.id)
    expect(count).toBe(1)
  }, 60000)

  it('does not create duplicate orders under concurrent conversion requests', async () => {
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id)
    const [adminA, adminB] = await Promise.all([
      loginAgent(fixture.adminEmail),
      loginAgent(fixture.adminEmail),
    ])

    const [first, second] = await Promise.all([
      adminA.post(`/novedades/${novelty.id}/convertir-orden`).send({ prioridad: 'MEDIA' }),
      adminB.post(`/novedades/${novelty.id}/convertir-orden`).send({ prioridad: 'MEDIA' }),
    ])
    const count = await prisma.ordenTrabajo.count({ where: { novedadId: novelty.id } })
    const order = await prisma.ordenTrabajo.findFirstOrThrow({ where: { novedadId: novelty.id } })
    created.ordenes.push(order.id)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect([first.body.data.orden.id, second.body.data.orden.id]).toEqual([order.id, order.id])
    const responses = [first.body.data.yaExistia, second.body.data.yaExistia]
    expect(responses.filter((value) => value === false)).toHaveLength(1)
    expect(responses.filter((value) => value === true)).toHaveLength(1)
    expect(count).toBe(1)
  }, 60000)

  it('rolls back conversion when one transactional step fails', async () => {
    const bus = await createBus()
    const novelty = await createNovelty(fixture.conductorId, bus.id)
    const fakeAdmin: AuthenticatedUser = {
      email: 'fake-admin@test.sgmv.local',
      id: randomUUID(),
      nombre: 'Fake Admin',
      rol: {
        codigo: 'ADMINISTRADOR',
        id: randomUUID(),
        nombre: 'Administrador',
      },
    }
    const service = new NoveltyService()

    await expect(
      service.convertToCorrectiveOrder(
        novelty.id,
        {
          prioridad: 'MEDIA',
        },
        fakeAdmin,
      ),
    ).rejects.toThrow()

    const [orderCount, reloaded] = await Promise.all([
      prisma.ordenTrabajo.count({ where: { novedadId: novelty.id } }),
      prisma.novedad.findUniqueOrThrow({ where: { id: novelty.id } }),
    ])

    expect(orderCount).toBe(0)
    expect(reloaded.estado).toBe('PENDIENTE_REVISION')
  }, 60000)
})
