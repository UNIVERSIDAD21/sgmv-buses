import { randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import { createApp } from '../src/app.js'
import { NoveltyService } from '../src/novelties/novelty.service.js'

const prisma = new PrismaClient()
const describeDb = process.env.DATABASE_URL ? describe : describe.skip
const password = 'Clave-demo-segura-123'

const created = {
  buses: [] as string[],
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
  const [admin, mecanico, conductor] = await Promise.all([
    prisma.rol.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      update: {},
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
      update: {},
      create: {
        codigo: 'CONDUCTOR',
        nombre: 'Conductor',
      },
    }),
  ])

  return { admin, conductor, mecanico }
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
    mecanicoEmail: mecanico.email,
  }
}

async function loginAgent(email: string) {
  const agent = request.agent(createApp())

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
      await tx.novedad.deleteMany({
        where: {
          id: {
            in: created.novedades,
          },
        },
      })
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

describeDb('RF-02 Novelty API', () => {
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

  it('creates a novelty for the active assigned bus and derives author from session', async () => {
    const bus = await createBus()
    await createAssignment(fixture.conductorId, bus.id, fixture.adminId)
    const conductor = await loginAgent(fixture.conductorEmail)

    const spoofedBus = await createBus()
    const response = await conductor
      .post('/novedades')
      .send({
        descripcion: 'Ruido fuerte en el sistema de frenos durante operacion',
        tipo: 'Falla de frenos',
      })
      .expect(201)
    const noveltyId = response.body.data.novedad.id as string
    created.novedades.push(noveltyId)

    expect(response.body.data.novedad.bus.id).toBe(bus.id)
    expect(response.body.data.novedad.conductor.id).toBe(fixture.conductorId)
    expect(response.body.data.novedad.estado).toBe('PENDIENTE_REVISION')

    await conductor
      .post('/novedades')
      .send({
        busId: spoofedBus.id,
        conductorId: fixture.conductorAltId,
        descripcion: 'Intento de suplantacion de bus y conductor',
        tipo: 'Falla electrica',
      })
      .expect(400)
  }, 60000)

  it('blocks novelty registration when the driver has no active assignment', async () => {
    const conductor = await loginAgent(fixture.conductorSinBusEmail)

    const response = await conductor
      .post('/novedades')
      .send({
        descripcion: 'No deberia poder registrar sin bus asignado',
        tipo: 'Falla general',
      })
      .expect(400)

    expect(response.body.error.code).toBe('DRIVER_WITHOUT_ACTIVE_BUS')
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
    await conductor.get(`/novedades/mis-novedades/${foreignNovelty.id}`).expect(403)
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
        clasificacion: 'Requiere revision tecnica',
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
