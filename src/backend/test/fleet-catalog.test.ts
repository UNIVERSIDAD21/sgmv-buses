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
  modelos: [] as string[],
  rutas: [] as string[],
  usuarios: [] as string[],
}

interface CatalogFixture {
  adminEmail: string
  adminId: string
  conductorId: string
  despachadorEmail: string
  mecanicoEmail: string
}

function uniqueCode(prefix: string) {
  return `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
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
      email: `catalog-${label}-${id.slice(0, 8)}@test.sgmv.local`,
      id,
      nombre: `Usuario ${label}`,
      rolId: role.id,
    },
  })
}

async function createFixture(): Promise<CatalogFixture> {
  const roles = await ensureRoles()
  const [admin, despachador, mecanico, conductor] = await Promise.all([
    createUser('admin', roles.ADMINISTRADOR),
    createUser('despachador', roles.DESPACHADOR),
    createUser('mecanico', roles.MECANICO),
    createUser('conductor', roles.CONDUCTOR),
  ])

  return {
    adminEmail: admin.email,
    adminId: admin.id,
    conductorId: conductor.id,
    despachadorEmail: despachador.email,
    mecanicoEmail: mecanico.email,
  }
}

async function loginAgent(email: string) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)
  return agent
}

async function createModelDirect(activo = true) {
  const id = randomUUID()
  created.modelos.push(id)

  return prisma.modeloBus.create({
    data: {
      activo,
      especificaciones: { combustible: 'Diesel' },
      id,
      marca: `Marca ${id.slice(0, 8)}`,
      nombreModelo: 'Modelo prueba',
      versionTecnica: 'V1',
    },
  })
}

async function createRouteDirect(activa = true) {
  const id = randomUUID()
  created.rutas.push(id)

  return prisma.ruta.create({
    data: {
      activa,
      codigo: uniqueCode('RUTA'),
      destino: 'Terminal norte',
      id,
      nombre: 'Ruta de prueba',
      origen: 'Patio central',
    },
  })
}

async function createBusDirect(modeloBusId?: string) {
  const id = randomUUID()
  created.buses.push(id)

  return prisma.bus.create({
    data: {
      anio: 2022,
      codigoInterno: uniqueCode('BUS'),
      id,
      marca: 'Marca legado',
      modelo: 'Modelo legado',
      modeloBusId,
      placa: uniqueCode('P').replaceAll('-', '').slice(0, 10),
    },
  })
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.jornadaOperativa.deleteMany({ where: { id: { in: created.jornadas } } })
    await tx.busEstadoHistorial.deleteMany({ where: { busId: { in: created.buses } } })
    await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
    await tx.modeloBus.deleteMany({ where: { id: { in: created.modelos } } })
    await tx.ruta.deleteMany({ where: { id: { in: created.rutas } } })
    await tx.usuario.deleteMany({ where: { id: { in: created.usuarios } } })
  })
}

describe('P3 - catalogos operativos de flota', () => {
  let fixture: CatalogFixture

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

  it('exige autenticacion y aplica permisos por rol en backend', async () => {
    await request(createApp()).get('/flota/modelos-bus').expect(401)

    const admin = await loginAgent(fixture.adminEmail)
    const despachador = await loginAgent(fixture.despachadorEmail)
    const mecanico = await loginAgent(fixture.mecanicoEmail)

    await admin.get('/flota/modelos-bus').expect(200)
    await despachador.get('/flota/rutas').expect(200)
    await despachador.post('/flota/rutas').send({}).expect(403)
    await mecanico.get('/flota/modelos-bus').expect(403)
  }, 60000)

  it('crea modelos normalizados y bloquea duplicados de negocio concurrentemente seguros', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const suffix = uniqueCode('M')
    const response = await admin
      .post('/flota/modelos-bus')
      .send({
        especificaciones: { combustible: 'Diesel', ejes: 2 },
        marca: `  Mercedes   ${suffix} `,
        nombreModelo: '  OF  1721 ',
        versionTecnica: '  Euro VI ',
      })
      .expect(201)

    const modeloId = response.body.data.modeloBus.id as string
    created.modelos.push(modeloId)
    expect(response.body.data.modeloBus.marca).toBe(`Mercedes ${suffix}`)
    expect(response.body.data.modeloBus.nombreModelo).toBe('OF 1721')
    expect(response.body.data.modeloBus.especificaciones).toEqual({
      combustible: 'Diesel',
      ejes: 2,
    })

    await admin
      .post('/flota/modelos-bus')
      .send({
        marca: `mercedes ${suffix.toLowerCase()}`,
        nombreModelo: 'of 1721',
        versionTecnica: 'euro vi',
      })
      .expect(409)
  }, 60000)

  it('reproduce una creacion de catalogo con la misma Idempotency-Key sin duplicarla', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const idempotencyKey = randomUUID()
    const brand = `Idempotente ${uniqueCode('M')}`
    const payload = {
      especificaciones: { prueba: true },
      marca: brand,
      nombreModelo: 'Modelo unico',
      versionTecnica: 'V1',
    }

    const first = await admin
      .post('/flota/modelos-bus')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201)
    const second = await admin
      .post('/flota/modelos-bus')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201)

    const modeloId = first.body.data.modeloBus.id as string
    created.modelos.push(modeloId)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body).toEqual(first.body)
    expect(
      await prisma.modeloBus.count({ where: { marca: brand, nombreModelo: 'Modelo unico' } }),
    ).toBe(1)
  }, 60000)

  it('limita al despachador a modelos y rutas operativos sin especificaciones tecnicas', async () => {
    const activeModel = await createModelDirect(true)
    const inactiveModel = await createModelDirect(false)
    const activeRoute = await createRouteDirect(true)
    const inactiveRoute = await createRouteDirect(false)
    const despachador = await loginAgent(fixture.despachadorEmail)

    const models = await despachador
      .get('/flota/modelos-bus')
      .query({ incluirInactivos: true })
      .expect(200)
    const routes = await despachador
      .get('/flota/rutas')
      .query({ incluirInactivos: true })
      .expect(200)
    const detail = await despachador.get(`/flota/modelos-bus/${activeModel.id}`).expect(200)

    expect(models.body.data.modelosBus.map((item: { id: string }) => item.id)).toContain(
      activeModel.id,
    )
    expect(models.body.data.modelosBus.map((item: { id: string }) => item.id)).not.toContain(
      inactiveModel.id,
    )
    expect(routes.body.data.rutas.map((item: { id: string }) => item.id)).toContain(activeRoute.id)
    expect(routes.body.data.rutas.map((item: { id: string }) => item.id)).not.toContain(
      inactiveRoute.id,
    )
    expect(detail.body.data.modeloBus).not.toHaveProperty('especificaciones')
    await despachador.get(`/flota/modelos-bus/${inactiveModel.id}`).expect(404)
    await despachador.get(`/flota/rutas/${inactiveRoute.id}`).expect(404)
  }, 60000)

  it('gestiona rutas basicas con codigo normalizado y ciclo activar/inactivar', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const code = uniqueCode('OP')
    const createResponse = await admin
      .post('/flota/rutas')
      .send({
        codigo: code.toLowerCase(),
        destino: '  Terminal   Norte ',
        nombre: '  Circular  Norte ',
        origen: '  Patio  Central ',
      })
      .expect(201)

    const routeId = createResponse.body.data.ruta.id as string
    created.rutas.push(routeId)
    expect(createResponse.body.data.ruta.codigo).toBe(code)
    expect(createResponse.body.data.ruta.origen).toBe('Patio Central')

    await admin
      .post('/flota/rutas')
      .send({ codigo: code.toLowerCase(), destino: 'B', nombre: 'Duplicada', origen: 'A' })
      .expect(409)

    await admin.patch(`/flota/rutas/${routeId}`).send({ destino: 'Terminal Sur' }).expect(200)
    await admin.post(`/flota/rutas/${routeId}/desactivar`).send({}).expect(200)
    await admin.post(`/flota/rutas/${routeId}/desactivar`).send({}).expect(200)
    await admin.post(`/flota/rutas/${routeId}/activar`).send({}).expect(200)

    const persisted = await prisma.ruta.findUniqueOrThrow({ where: { id: routeId } })
    expect(persisted.activa).toBe(true)
    expect(persisted.destino).toBe('Terminal Sur')
  }, 60000)

  it('asocia buses solo a modelos activos y conserva marca/modelo legado', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const activeModel = await createModelDirect(true)
    const inactiveModel = await createModelDirect(false)
    const code = uniqueCode('BUS-API')
    const plate = uniqueCode('PL').replaceAll('-', '').slice(0, 10)

    const response = await admin
      .post('/flota/buses')
      .send({
        anio: 2024,
        codigoInterno: code,
        marca: 'Marca historica',
        modelo: 'Modelo historico',
        modeloBusId: activeModel.id,
        placa: plate,
      })
      .expect(201)

    const busId = response.body.data.bus.id as string
    created.buses.push(busId)
    expect(response.body.data.bus.marca).toBe('Marca historica')
    expect(response.body.data.bus.modelo).toBe('Modelo historico')
    expect(response.body.data.bus.modeloBus.id).toBe(activeModel.id)

    await admin.patch(`/flota/buses/${busId}`).send({ modeloBusId: inactiveModel.id }).expect(400)

    const detail = await admin.get(`/flota/buses/${busId}`).expect(200)
    expect(detail.body.data.bus.modeloBus.id).toBe(activeModel.id)
  }, 60000)

  it('preserva referencias al inactivar y bloquea el borrado fisico de catalogos usados', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const model = await createModelDirect(true)
    const route = await createRouteDirect(true)
    const bus = await createBusDirect(model.id)
    const journeyId = randomUUID()
    created.jornadas.push(journeyId)

    await prisma.jornadaOperativa.create({
      data: {
        busId: bus.id,
        conductorId: fixture.conductorId,
        estado: 'PROGRAMADA',
        finProgramado: new Date('2026-09-05T14:00:00.000Z'),
        id: journeyId,
        inicioProgramado: new Date('2026-09-05T12:00:00.000Z'),
        programadaPorId: fixture.adminId,
        rutaId: route.id,
      },
    })

    await admin.post(`/flota/modelos-bus/${model.id}/desactivar`).send({}).expect(200)
    await admin.post(`/flota/rutas/${route.id}/desactivar`).send({}).expect(200)

    const persistedBus = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })
    const persistedJourney = await prisma.jornadaOperativa.findUniqueOrThrow({
      where: { id: journeyId },
    })
    expect(persistedBus.modeloBusId).toBe(model.id)
    expect(persistedJourney.rutaId).toBe(route.id)

    await expect(prisma.modeloBus.delete({ where: { id: model.id } })).rejects.toThrow(
      /violates RESTRICT setting|foreign key constraint/,
    )
    await expect(prisma.ruta.delete({ where: { id: route.id } })).rejects.toThrow(
      /violates RESTRICT setting|foreign key constraint/,
    )
  }, 60000)

  it('rechaza payloads invalidos y no expone endpoints DELETE de catalogos', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const model = await createModelDirect(true)
    const route = await createRouteDirect(true)

    await admin.post('/flota/modelos-bus').send({ marca: '', nombreModelo: '' }).expect(400)
    await admin.post('/flota/rutas').send({ codigo: 'R-1' }).expect(400)
    await admin.patch(`/flota/modelos-bus/${model.id}`).send({}).expect(400)
    await admin.patch(`/flota/rutas/${route.id}`).send({}).expect(400)
    await admin.delete(`/flota/modelos-bus/${model.id}`).expect(404)
    await admin.delete(`/flota/rutas/${route.id}`).expect(404)
  }, 60000)
})
