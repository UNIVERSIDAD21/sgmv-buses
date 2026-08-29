import { randomUUID } from 'node:crypto'

import { PrismaClient, type Prisma, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import { createApp } from '../src/app.js'
import { FleetService } from '../src/fleet/fleet.service.js'

const prisma = new PrismaClient()
const describeDb = process.env.DATABASE_URL ? describe : describe.skip
const password = 'Clave-demo-segura-123'

const created = {
  buses: [] as string[],
  usuarios: [] as string[],
}

interface FleetFixture {
  adminEmail: string
  adminId: string
  conductorAltEmail: string
  conductorAltId: string
  conductorEmail: string
  conductorId: string
  mecanicoEmail: string
  mecanicoId: string
}

function shortCode() {
  return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}

function uniquePlate(prefix = 'T') {
  return `${prefix}${shortCode().slice(0, 6)}`
}

function uniqueBusCode(prefix = 'BUS-TEST') {
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

async function createBus(overrides: Partial<Prisma.BusCreateInput> = {}) {
  const id = randomUUID()
  created.buses.push(id)

  return prisma.bus.create({
    data: {
      id,
      anio: 2020,
      codigoInterno: uniqueBusCode(),
      kilometrajeActual: 10000,
      marca: 'Marca Test',
      modelo: 'Modelo Test',
      placa: uniquePlate(),
      ...overrides,
    },
  })
}

async function createDriver(label: string) {
  const roles = await ensureRoles()
  const suffix = shortCode().toLowerCase()

  return createUser(`fleet-${label}-${suffix}@test.sgmv.local`, roles.conductor)
}

async function createFixture(): Promise<FleetFixture> {
  const roles = await ensureRoles()
  const suffix = shortCode().toLowerCase()
  const admin = await createUser(`fleet-admin-${suffix}@test.sgmv.local`, roles.admin)
  const mecanico = await createUser(`fleet-mecanico-${suffix}@test.sgmv.local`, roles.mecanico)
  const conductor = await createUser(`fleet-conductor-${suffix}@test.sgmv.local`, roles.conductor)
  const conductorAlt = await createUser(
    `fleet-conductor-alt-${suffix}@test.sgmv.local`,
    roles.conductor,
  )

  return {
    adminEmail: admin.email,
    adminId: admin.id,
    conductorAltEmail: conductorAlt.email,
    conductorAltId: conductorAlt.id,
    conductorEmail: conductor.email,
    conductorId: conductor.id,
    mecanicoEmail: mecanico.email,
    mecanicoId: mecanico.id,
  }
}

async function loginAgent(email: string) {
  const agent = request.agent(createApp())

  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)

  return agent
}

async function cleanup() {
  await prisma.$transaction(
    async (tx) => {
      await tx.busEstadoHistorial.deleteMany({
        where: {
          busId: {
            in: created.buses,
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

describeDb('RF-01 Fleet API', () => {
  let fixture: FleetFixture

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

  it('requires authentication for fleet endpoints', async () => {
    await request(createApp()).get('/flota/buses').expect(401)
  })

  it('enforces admin, driver and mechanic permissions', async () => {
    const bus = await createBus()
    const admin = await loginAgent(fixture.adminEmail)
    const conductor = await loginAgent(fixture.conductorEmail)
    const mecanico = await loginAgent(fixture.mecanicoEmail)

    await admin.get('/flota/buses').expect(200)
    await conductor.get('/flota/buses').expect(403)
    await mecanico.get(`/flota/buses/${bus.id}`).expect(403)
    await mecanico.get('/flota/mi-bus').expect(403)
  }, 60000)

  it('registers a valid bus with normalized identifiers and initial state history', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const placa = uniquePlate('A')
    const codigoInterno = uniqueBusCode('rf01')
    const response = await admin
      .post('/flota/buses')
      .send({
        anio: 2023,
        codigoInterno: codigoInterno.toLowerCase(),
        kilometrajeActual: 1500,
        marca: '  Mercedes  Benz ',
        modelo: '  Padron  ',
        placa: placa.toLowerCase(),
      })
      .expect(201)

    const busId = response.body.data.bus.id as string
    created.buses.push(busId)

    expect(response.body.data.bus.codigoInterno).toBe(codigoInterno.toUpperCase())
    expect(response.body.data.bus.placa).toBe(placa.toUpperCase())
    expect(response.body.data.bus.estadosHistorial[0].estadoNuevo).toBe('OPERATIVO')
  }, 60000)

  it('rejects duplicate plate and internal code, including case-only differences', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const existing = await createBus({
      codigoInterno: uniqueBusCode('DUP'),
      placa: uniquePlate('D'),
    })

    await admin
      .post('/flota/buses')
      .send({
        anio: 2021,
        codigoInterno: uniqueBusCode('NEW'),
        marca: 'Marca Test',
        modelo: 'Modelo Test',
        placa: existing.placa.toLowerCase(),
      })
      .expect(409)

    await admin
      .post('/flota/buses')
      .send({
        anio: 2021,
        codigoInterno: existing.codigoInterno.toLowerCase(),
        marca: 'Marca Test',
        modelo: 'Modelo Test',
        placa: uniquePlate('E'),
      })
      .expect(409)
  }, 60000)

  it('lists buses with search, status filter and pagination', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({
      codigoInterno: uniqueBusCode('SEARCH'),
      estadoOperativo: 'EN_MANTENIMIENTO',
      placa: uniquePlate('S'),
    })

    const response = await admin
      .get('/flota/buses')
      .query({
        busqueda: bus.placa.toLowerCase(),
        estado: 'EN_MANTENIMIENTO',
        limite: 1,
        pagina: 1,
      })
      .expect(200)

    expect(response.body.data.buses).toHaveLength(1)
    expect(response.body.data.buses[0].id).toBe(bus.id)
    expect(response.body.data.paginacion.total).toBe(1)
  }, 60000)

  it('updates only editable bus data and rejects invalid state values', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus()

    const update = await admin
      .patch(`/flota/buses/${bus.id}`)
      .send({
        marca: 'Volvo',
        modelo: 'B340M',
        placa: bus.placa.toLowerCase(),
      })
      .expect(200)

    expect(update.body.data.bus.marca).toBe('Volvo')
    expect(update.body.data.bus.modelo).toBe('B340M')

    await admin
      .post(`/flota/buses/${bus.id}/estado`)
      .send({
        estadoNuevo: 'EN_TALLER',
        motivo: 'Estado inexistente',
      })
      .expect(400)
  }, 60000)

  it('records mileage atomically and rejects readings below the current value', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus({ kilometrajeActual: 20000 })

    const response = await admin
      .post(`/flota/buses/${bus.id}/kilometraje`)
      .send({
        kilometrajeNuevo: 20500,
        motivo: 'Lectura de cierre de turno',
      })
      .expect(200)

    expect(response.body.data.bus.kilometrajeActual).toBe(20500)
    expect(response.body.data.lectura.kilometrajeAnterior).toBe(20000)
    expect(response.body.data.lectura.kilometrajeNuevo).toBe(20500)

    await admin
      .post(`/flota/buses/${bus.id}/kilometraje`)
      .send({
        kilometrajeNuevo: 20499,
      })
      .expect(400)

    const persisted = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })
    const readings = await prisma.lecturaKilometraje.count({ where: { busId: bus.id } })

    expect(persisted.kilometrajeActual).toBe(20500)
    expect(readings).toBe(1)
  }, 60000)

  it('changes state and keeps immutable state history', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus()

    const response = await admin
      .post(`/flota/buses/${bus.id}/estado`)
      .send({
        estadoNuevo: 'FUERA_DE_SERVICIO',
        motivo: 'Falla mayor reportada por supervision',
      })
      .expect(200)

    expect(response.body.data.bus.estadoOperativo).toBe('FUERA_DE_SERVICIO')
    expect(response.body.data.historial.estadoAnterior).toBe('OPERATIVO')
    expect(response.body.data.historial.estadoNuevo).toBe('FUERA_DE_SERVICIO')

    const history = await admin.get(`/flota/buses/${bus.id}/estados`).expect(200)

    expect(history.body.data.historial[0].estadoNuevo).toBe('FUERA_DE_SERVICIO')
  }, 60000)

  it('assigns and reassigns drivers while closing previous active assignments', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus()
    const secondBus = await createBus()
    const firstDriver = await createDriver('reassign-one')
    const secondDriver = await createDriver('reassign-two')

    await admin
      .post(`/flota/buses/${bus.id}/asignaciones`)
      .send({
        conductorId: firstDriver.id,
        motivo: 'Asignacion inicial de ruta',
      })
      .expect(200)

    await admin
      .post(`/flota/buses/${bus.id}/asignaciones`)
      .send({
        conductorId: secondDriver.id,
        motivo: 'Reasignacion por disponibilidad',
      })
      .expect(200)

    await admin
      .post(`/flota/buses/${secondBus.id}/asignaciones`)
      .send({
        conductorId: secondDriver.id,
        motivo: 'Cambio de bus operativo',
      })
      .expect(200)

    const activeForFirstBus = await prisma.asignacionConductor.count({
      where: {
        activa: true,
        busId: bus.id,
      },
    })
    const activeForDriver = await prisma.asignacionConductor.findMany({
      where: {
        activa: true,
        conductorId: secondDriver.id,
      },
    })
    const historicalAssignments = await prisma.asignacionConductor.count({
      where: {
        OR: [{ busId: bus.id }, { busId: secondBus.id }],
      },
    })

    expect(activeForFirstBus).toBe(0)
    expect(activeForDriver).toHaveLength(1)
    expect(activeForDriver[0].busId).toBe(secondBus.id)
    expect(historicalAssignments).toBe(3)
  }, 60000)

  it('rejects non-driver assignments and returns available drivers', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const bus = await createBus()

    await admin
      .post(`/flota/buses/${bus.id}/asignaciones`)
      .send({
        conductorId: fixture.mecanicoId,
      })
      .expect(400)

    const available = await admin
      .get('/flota/conductores-disponibles')
      .query({ busId: bus.id })
      .expect(200)

    expect(JSON.stringify(available.body.data.conductores)).not.toContain(fixture.mecanicoId)
  }, 60000)

  it('returns assigned bus for the driver and blocks access to another bus', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const conductor = await createDriver('own-bus')
    const driver = await loginAgent(conductor.email)
    const bus = await createBus()
    const otherBus = await createBus()

    await admin
      .post(`/flota/buses/${bus.id}/asignaciones`)
      .send({
        conductorId: conductor.id,
      })
      .expect(200)

    const ownBus = await driver.get('/flota/mi-bus').expect(200)

    expect(ownBus.body.data.bus.id).toBe(bus.id)

    await driver.get(`/flota/buses/${otherBus.id}`).expect(403)
  }, 60000)

  it('returns a clear empty state when a driver has no active assignment', async () => {
    const conductor = await createDriver('empty-driver')
    const driver = await loginAgent(conductor.email)
    const response = await driver.get('/flota/mi-bus').expect(200)

    expect(response.body.data.bus).toBeNull()
    expect(response.body.data.asignacion).toBeNull()
  }, 60000)

  it('rolls back a transactional mileage update when history creation fails', async () => {
    const bus = await createBus({ kilometrajeActual: 31000 })
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
    const service = new FleetService()

    await expect(
      service.registerMileage(
        bus.id,
        {
          kilometrajeNuevo: 32000,
        },
        fakeAdmin,
      ),
    ).rejects.toBeTruthy()

    const persisted = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })
    const readings = await prisma.lecturaKilometraje.count({ where: { busId: bus.id } })

    expect(persisted.kilometrajeActual).toBe(31000)
    expect(readings).toBe(0)
  }, 60000)
})
