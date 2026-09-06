import { randomUUID } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { PreventivePlanService } from '../src/preventive/preventive-plan.service.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const created = {
  buses: [] as string[],
  models: [] as string[],
  plans: [] as string[],
  schedules: [] as string[],
  users: [] as string[],
}

function suffix() {
  return randomUUID().replaceAll('-', '').slice(0, 8)
}

async function createAdmin() {
  const role = await prisma.rol.upsert({
    where: { codigo: 'ADMINISTRADOR' },
    update: { nombre: 'Administrador' },
    create: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
  })
  const id = randomUUID()
  const email = `p6-plan-admin-${suffix()}@test.sgmv.local`
  created.users.push(id)
  return prisma.usuario.create({
    data: {
      id,
      contrasenaHash: await hash(password, 10),
      email,
      estado: 'ACTIVO',
      nombre: 'Admin P6',
      rolId: role.id,
    },
  })
}

async function createConductor() {
  const role = await prisma.rol.upsert({
    where: { codigo: 'CONDUCTOR' },
    update: { nombre: 'Conductor' },
    create: { codigo: 'CONDUCTOR', nombre: 'Conductor' },
  })
  const id = randomUUID()
  const email = `p6-plan-conductor-${suffix()}@test.sgmv.local`
  created.users.push(id)
  return prisma.usuario.create({
    data: {
      id,
      contrasenaHash: await hash(password, 10),
      email,
      estado: 'ACTIVO',
      nombre: 'Conductor P6',
      rolId: role.id,
    },
  })
}

async function createModel() {
  const id = randomUUID()
  created.models.push(id)
  return prisma.modeloBus.create({
    data: {
      id,
      activo: true,
      especificaciones: {},
      marca: `Marca ${suffix()}`,
      nombreModelo: `Modelo ${suffix()}`,
    },
  })
}

async function createBus(modeloBusId?: string) {
  const id = randomUUID()
  const code = suffix().toUpperCase()
  created.buses.push(id)
  return prisma.bus.create({
    data: {
      id,
      anio: 2024,
      codigoInterno: `P6-${code}`,
      kilometrajeActual: 10000,
      marca: 'Marca P6',
      modelo: 'Modelo P6',
      modeloBusId,
      placa: `P${code.slice(0, 6)}`,
    },
  })
}

function planPayload(destination: { busId?: string; modeloBusId?: string } = {}) {
  return {
    actividad: 'Inspección periódica preventiva de sistema de frenos',
    anticipacionKm: 300,
    bloqueaAlVencer: true,
    claveTarea: 'FRENOS.SEGURIDAD',
    componente: 'Sistema de frenos',
    criterio: 'KILOMETRAJE',
    intervaloKm: 5000,
    prioridad: 'ALTA',
    ...destination,
  }
}

async function login(email: string) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)
  return agent
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.programacionMantenimiento.deleteMany({ where: { id: { in: created.schedules } } })
    await tx.planMantenimientoPreventivo.deleteMany({ where: { id: { in: created.plans } } })
    await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
    await tx.modeloBus.deleteMany({ where: { id: { in: created.models } } })
    await tx.usuario.deleteMany({ where: { id: { in: created.users } } })
  })
}

describe('P6-B planes preventivos versionados', () => {
  let admin: Awaited<ReturnType<typeof createAdmin>>

  beforeAll(async () => {
    admin = await createAdmin()
  }, 60000)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, 60000)

  it('requires an administrator and exactly one destination', async () => {
    await request(createApp()).get('/mantenimiento-preventivo/planes').expect(401)
    const agent = await login(admin.email)
    const conductor = await createConductor()
    const conductorAgent = await login(conductor.email)
    const model = await createModel()
    const bus = await createBus(model.id)

    await conductorAgent.get('/mantenimiento-preventivo/planes').expect(403)
    await conductorAgent
      .post('/mantenimiento-preventivo/planes')
      .send(planPayload({ busId: bus.id }))
      .expect(403)
    await agent.post('/mantenimiento-preventivo/planes').send(planPayload()).expect(400)
    await agent
      .post('/mantenimiento-preventivo/planes')
      .send(planPayload({ busId: bus.id, modeloBusId: model.id }))
      .expect(400)
    await agent
      .post('/mantenimiento-preventivo/planes')
      .send({ ...planPayload({ busId: bus.id }), creadoPorId: randomUUID() })
      .expect(400)
  }, 60000)

  it('creates an immutable first version, rejects duplicate active identity and preserves historical references', async () => {
    const agent = await login(admin.email)
    const bus = await createBus()
    const first = await agent
      .post('/mantenimiento-preventivo/planes')
      .send(planPayload({ busId: bus.id }))
      .expect(201)
    const planId = first.body.data.plan.id as string
    created.plans.push(planId)
    expect(first.body.data.plan.claveTarea).toBe('FRENOS.SEGURIDAD')
    expect(first.body.data.plan.version).toBe(1)

    await agent
      .post('/mantenimiento-preventivo/planes')
      .send({ ...planPayload({ busId: bus.id }), claveTarea: ' frenos.seguridad ' })
      .expect(409)
    await expect(
      prisma.planMantenimientoPreventivo.update({
        where: { id: planId },
        data: { actividad: 'No se puede reescribir evidencia' },
      }),
    ).rejects.toThrow()

    const schedule = await prisma.programacionMantenimiento.create({
      data: {
        activa: false,
        actividad: 'Referencia histórica de plan P6-B',
        busId: bus.id,
        creadaPorId: admin.id,
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 15000,
        planMantenimientoPreventivoId: planId,
        prioridad: 'ALTA',
        tipo: 'Preventivo recurrente',
      },
    })
    created.schedules.push(schedule.id)

    const successor = await agent
      .post(`/mantenimiento-preventivo/planes/${planId}/versiones`)
      .send({
        actividad: 'Inspección periódica mejorada de sistema de frenos',
        anticipacionKm: 250,
        bloqueaAlVencer: true,
        componente: 'Sistema de frenos',
        criterio: 'KILOMETRAJE',
        intervaloKm: 6000,
        prioridad: 'ALTA',
      })
      .expect(201)
    const successorId = successor.body.data.plan.id as string
    created.plans.push(successorId)
    expect(successor.body.data.plan.version).toBe(2)
    expect(successor.body.data.plan.activa).toBe(true)

    const historic = await prisma.planMantenimientoPreventivo.findUniqueOrThrow({
      where: { id: planId },
    })
    const reference = await prisma.programacionMantenimiento.findUniqueOrThrow({
      where: { id: schedule.id },
    })
    expect(historic.activo).toBe(false)
    expect(historic.intervaloKm).toBe(5000)
    expect(reference.planMantenimientoPreventivoId).toBe(planId)
  }, 60000)

  it('deactivates without deleting and resolves bus plans before model plans only for the same task', async () => {
    const agent = await login(admin.email)
    const model = await createModel()
    const bus = await createBus(model.id)
    const modelPlan = await agent
      .post('/mantenimiento-preventivo/planes')
      .send(planPayload({ modeloBusId: model.id }))
      .expect(201)
    const modelPlanId = modelPlan.body.data.plan.id as string
    created.plans.push(modelPlanId)
    const busPlan = await agent
      .post('/mantenimiento-preventivo/planes')
      .send(planPayload({ busId: bus.id }))
      .expect(201)
    const busPlanId = busPlan.body.data.plan.id as string
    created.plans.push(busPlanId)

    const service = new PreventivePlanService()
    const selectedBus = await service.resolveEffectivePlanForBus(bus.id, 'frenos.seguridad')
    expect(selectedBus?.origenPlan).toBe('BUS')
    expect(selectedBus?.plan.id).toBe(busPlanId)

    await agent
      .post(`/mantenimiento-preventivo/planes/${busPlanId}/desactivar`)
      .send({})
      .expect(200)
    const selectedModel = await service.resolveEffectivePlanForBus(bus.id, 'FRENOS.SEGURIDAD')
    expect(selectedModel?.origenPlan).toBe('MODELO')
    expect(selectedModel?.plan.id).toBe(modelPlanId)

    const detail = await agent.get(`/mantenimiento-preventivo/planes/${busPlanId}`).expect(200)
    expect(detail.body.data.plan.activa).toBe(false)
    expect(detail.body.data.plan.programacionesAsociadas).toBe(0)
  }, 60000)

  it('serializes concurrent first versions into one active identity', async () => {
    const bus = await createBus()
    const [first, second] = await Promise.all([login(admin.email), login(admin.email)])
    const [a, b] = await Promise.all([
      first.post('/mantenimiento-preventivo/planes').send(planPayload({ busId: bus.id })),
      second.post('/mantenimiento-preventivo/planes').send(planPayload({ busId: bus.id })),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    const plans = await prisma.planMantenimientoPreventivo.findMany({
      where: { busId: bus.id, claveTarea: 'FRENOS.SEGURIDAD' },
    })
    created.plans.push(...plans.map((plan) => plan.id))
    expect(plans.filter((plan) => plan.activo)).toHaveLength(1)
  }, 60000)
})
