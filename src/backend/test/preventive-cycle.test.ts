import { randomUUID } from 'node:crypto'

import { PrismaClient, type CriterioMantenimiento, type RolCodigo } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import {
  classifyPreventiveCycle,
  initialPreventiveTargets,
} from '../src/preventive/preventive-cycle.js'
import { PreventiveService } from '../src/preventive/preventive.service.js'
import { WorkOrderRepository } from '../src/work-orders/work-order.repository.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const testTimeout = 120000
const created = {
  buses: [] as string[],
  models: [] as string[],
  users: [] as string[],
}

function suffix() {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
}

async function createUser(roleCode: RolCodigo) {
  const role = await prisma.rol.upsert({
    where: { codigo: roleCode },
    update: { nombre: roleCode },
    create: { codigo: roleCode, nombre: roleCode },
  })
  const id = randomUUID()
  const email = `p6c-${roleCode.toLowerCase()}-${suffix().toLowerCase()}@test.sgmv.local`
  created.users.push(id)
  const user = await prisma.usuario.create({
    data: {
      id,
      contrasenaHash: await hash(password, 10),
      email,
      estado: 'ACTIVO',
      nombre: `Usuario ${roleCode}`,
      rolId: role.id,
    },
  })
  const actor: AuthenticatedUser = {
    email: user.email,
    estado: user.estado,
    id: user.id,
    nombre: user.nombre,
    rol: { codigo: role.codigo, nombre: role.nombre },
  }
  return { actor, user }
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

async function createBus(modeloBusId?: string, kilometrajeActual = 40000) {
  const id = randomUUID()
  const code = suffix()
  created.buses.push(id)
  return prisma.bus.create({
    data: {
      id,
      anio: 2025,
      codigoInterno: `P6C-${code}`,
      kilometrajeActual,
      marca: 'Marca P6-C',
      modelo: 'Modelo P6-C',
      modeloBusId,
      placa: `C${code.slice(0, 6)}`,
    },
  })
}

async function createPlan(
  actorId: string,
  destination: { busId?: string; modeloBusId?: string },
  overrides: Partial<{
    anticipacionDias: number | null
    anticipacionKm: number | null
    claveTarea: string
    criterio: CriterioMantenimiento
    intervaloDias: number | null
    intervaloKm: number | null
    version: number
  }> = {},
) {
  return prisma.planMantenimientoPreventivo.create({
    data: {
      activo: true,
      actividad: 'Ejecutar mantenimiento preventivo recurrente P6-C',
      anticipacionDias: overrides.anticipacionDias ?? null,
      anticipacionKm: overrides.anticipacionKm ?? null,
      bloqueaAlVencer: true,
      busId: destination.busId ?? null,
      claveTarea: overrides.claveTarea ?? `TAREA.${suffix()}`,
      componente: 'Componente P6-C',
      creadoPorId: actorId,
      criterio: overrides.criterio ?? 'KILOMETRAJE',
      intervaloDias: overrides.intervaloDias ?? null,
      intervaloKm: overrides.intervaloKm ?? 10000,
      modeloBusId: destination.modeloBusId ?? null,
      prioridad: 'ALTA',
      version: overrides.version ?? 1,
    },
  })
}

async function makeOrderClosable(orderId: string, mechanicId: string) {
  const now = new Date()
  const intervention = await prisma.intervencion.create({
    data: {
      diagnostico: 'Preventivo ejecutado conforme al plan',
      fechaFin: now,
      fechaInicio: now,
      ordenTrabajoId: orderId,
      tecnicoId: mechanicId,
    },
  })
  await prisma.actividadOrden.create({
    data: {
      descripcion: 'Actividad preventiva completada y verificada',
      intervencionId: intervention.id,
      registradaPorId: mechanicId,
    },
  })
  await prisma.ordenTrabajo.update({
    where: { id: orderId },
    data: {
      estado: 'COMPLETADA_TECNICO',
      fechaAsignacion: now,
      fechaCompletadaTecnico: now,
      fechaInicioEjecucion: now,
      tecnicoAsignadoId: mechanicId,
    },
  })
}

async function login(email: string) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)
  return agent
}

async function cleanup() {
  const orders = await prisma.ordenTrabajo.findMany({
    where: { busId: { in: created.buses } },
    select: { id: true },
  })
  const orderIds = orders.map((order) => order.id)
  const interventions = await prisma.intervencion.findMany({
    where: { ordenTrabajoId: { in: orderIds } },
    select: { id: true },
  })
  const interventionIds = interventions.map((item) => item.id)
  await prisma.$transaction(async (tx) => {
    await tx.actividadOrden.deleteMany({ where: { intervencionId: { in: interventionIds } } })
    await tx.intervencion.deleteMany({ where: { id: { in: interventionIds } } })
    await tx.ordenEstadoHistorial.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenTrabajo.deleteMany({ where: { id: { in: orderIds } } })
    await tx.programacionMantenimiento.deleteMany({ where: { busId: { in: created.buses } } })
    await tx.lecturaKilometraje.deleteMany({ where: { busId: { in: created.buses } } })
    await tx.planMantenimientoPreventivo.deleteMany({
      where: {
        OR: [{ busId: { in: created.buses } }, { modeloBusId: { in: created.models } }],
      },
    })
    await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
    await tx.modeloBus.deleteMany({ where: { id: { in: created.models } } })
    await tx.usuario.deleteMany({ where: { id: { in: created.users } } })
  })
}

describe('P6-C ciclo preventivo recurrente', () => {
  let admin: Awaited<ReturnType<typeof createUser>>
  let conductor: Awaited<ReturnType<typeof createUser>>
  let mechanic: Awaited<ReturnType<typeof createUser>>

  beforeAll(async () => {
    ;[admin, conductor, mechanic] = await Promise.all([
      createUser('ADMINISTRADOR'),
      createUser('CONDUCTOR'),
      createUser('MECANICO'),
    ])
  }, testTimeout)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, testTimeout)

  it('evalua fecha, kilometraje y ambos con anticipacion particular y fallback', () => {
    const now = new Date('2026-09-05T15:00:00.000Z')
    const initial = initialPreventiveTargets(
      {
        actividad: 'Ciclo combinado',
        anticipacionDias: 2,
        anticipacionKm: 100,
        bloqueaAlVencer: true,
        busId: randomUUID(),
        claveTarea: 'CICLO.COMBINADO',
        componente: 'Motor',
        criterio: 'FECHA_KILOMETRAJE',
        id: randomUUID(),
        intervaloDias: 10,
        intervaloKm: 1000,
        modeloBusId: null,
        prioridad: 'ALTA',
        version: 1,
      },
      10000,
      now,
    )
    expect(initial.fechaProgramada?.toISOString().slice(0, 10)).toBe('2026-09-15')
    expect(initial.kilometrajeObjetivo).toBe(11000)
    const datePlan = {
      anticipacionDias: 2,
      anticipacionKm: null,
    }
    expect(
      classifyPreventiveCycle(
        {
          fechaProgramada: new Date('2026-09-08T00:00:00.000Z'),
          kilometrajeActual: 10000,
          kilometrajeObjetivo: null,
          planMantenimientoPreventivo: datePlan,
        },
        now,
      ).estado,
    ).toBe('VIGENTE')
    expect(
      classifyPreventiveCycle(
        {
          fechaProgramada: new Date('2026-09-07T00:00:00.000Z'),
          kilometrajeActual: 10000,
          kilometrajeObjetivo: null,
          planMantenimientoPreventivo: datePlan,
        },
        now,
      ).estado,
    ).toBe('PROXIMO')
    expect(
      classifyPreventiveCycle({
        fechaProgramada: null,
        kilometrajeActual: 10000,
        kilometrajeObjetivo: 10500,
      }).estado,
    ).toBe('PROXIMO')
    expect(
      classifyPreventiveCycle({
        fechaProgramada: new Date('2026-09-20T00:00:00.000Z'),
        kilometrajeActual: 10000,
        kilometrajeObjetivo: 10000,
        planMantenimientoPreventivo: { anticipacionDias: 1, anticipacionKm: 100 },
      }).estado,
    ).toBe('VENCIDO')
  })

  it(
    'materializa una sola obligacion y aplica precedencia bus sobre modelo',
    async () => {
      const model = await createModel()
      const bus = await createBus(model.id, 40000)
      const key = `FRENOS.${suffix()}`
      const modelPlan = await createPlan(
        admin.actor.id,
        { modeloBusId: model.id },
        {
          claveTarea: key,
          intervaloKm: 5000,
        },
      )
      const busPlan = await createPlan(
        admin.actor.id,
        { busId: bus.id },
        {
          anticipacionKm: 250,
          claveTarea: key,
          intervaloKm: 6000,
        },
      )
      const service = new PreventiveService()

      await expect(
        service.createSchedule({ busId: bus.id, planId: modelPlan.id }, conductor.actor),
      ).rejects.toMatchObject({ statusCode: 403 })

      const [first, second] = await Promise.all([
        service.createSchedule({ busId: bus.id, planId: modelPlan.id }, admin.actor),
        service.createSchedule({ busId: bus.id, planId: modelPlan.id }, admin.actor),
      ])
      expect(first.programacion.id).toBe(second.programacion.id)
      expect(first.programacion.plan?.id).toBe(busPlan.id)
      expect(first.programacion.plan?.origen).toBe('BUS')
      expect(first.programacion.plan?.anticipacionKmEfectiva).toBe(250)
      expect(first.programacion.kilometrajeObjetivo).toBe(46000)
      expect([first.yaExistia, second.yaExistia].sort()).toEqual([false, true])

      const count = await prisma.programacionMantenimiento.count({
        where: {
          activa: true,
          busId: bus.id,
          planMantenimientoPreventivo: { claveTarea: key },
        },
      })
      expect(count).toBe(1)

      await prisma.lecturaKilometraje.create({
        data: {
          busId: bus.id,
          fechaLectura: new Date('2026-01-01T12:00:00.000Z'),
          kilometrajeAnterior: 38000,
          kilometrajeNuevo: 39000,
          motivo: 'Lectura tardia que no debe reducir el maximo materializado',
          registradoPorId: admin.actor.id,
          tipo: 'AJUSTE_ADMINISTRATIVO',
        },
      })
      const afterLateReading = await service.getSchedule(first.programacion.id, admin.actor)
      expect(afterLateReading.programacion.bus.kilometrajeActual).toBe(40000)
      expect(afterLateReading.programacion.kilometrajeObjetivo).toBe(46000)
    },
    testTimeout,
  )

  it(
    'genera una sola orden concurrente con snapshot inmutable del objetivo y version',
    async () => {
      const bus = await createBus(undefined, 50000)
      const plan = await createPlan(
        admin.actor.id,
        { busId: bus.id },
        {
          anticipacionKm: 500,
          claveTarea: `MOTOR.${suffix()}`,
          intervaloKm: 10000,
        },
      )
      const schedule = await prisma.programacionMantenimiento.create({
        data: {
          actividad: plan.actividad,
          busId: bus.id,
          creadaPorId: admin.actor.id,
          criterio: 'KILOMETRAJE',
          kilometrajeObjetivo: 50000,
          planMantenimientoPreventivoId: plan.id,
          prioridad: plan.prioridad,
          tipo: plan.componente,
        },
      })
      const service = new PreventiveService()
      const [first, second] = await Promise.all([
        service.generateOrder(schedule.id, { prioridad: 'BAJA' }, admin.actor),
        service.generateOrder(schedule.id, { prioridad: 'MEDIA' }, admin.actor),
      ])
      expect(first.orden.id).toBe(second.orden.id)
      expect([first.yaExistia, second.yaExistia].sort()).toEqual([false, true])

      const order = await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: first.orden.id } })
      expect(order.prioridad).toBe('ALTA')
      expect(order.fechaObjetivoPreventivo).toBeNull()
      expect(order.kilometrajeObjetivoPreventivo).toBe(50000)
      expect(order.planAplicado).toMatchObject({
        claveTarea: plan.claveTarea,
        kilometrajeObjetivo: 50000,
        planId: plan.id,
        planVersion: 1,
        programacionId: schedule.id,
        schemaVersion: 1,
      })
      expect(
        await prisma.ordenTrabajo.count({ where: { programacionMantenimientoId: schedule.id } }),
      ).toBe(1)
    },
    testTimeout,
  )

  it(
    'avanza 50000 a 60000 exactamente una vez ante retry y cierre concurrente',
    async () => {
      const createClosableCycle = async () => {
        const bus = await createBus(undefined, 50000)
        const plan = await createPlan(
          admin.actor.id,
          { busId: bus.id },
          {
            claveTarea: `ACEITE.${suffix()}`,
            intervaloKm: 10000,
          },
        )
        const schedule = await prisma.programacionMantenimiento.create({
          data: {
            actividad: plan.actividad,
            busId: bus.id,
            creadaPorId: admin.actor.id,
            criterio: 'KILOMETRAJE',
            kilometrajeObjetivo: 50000,
            planMantenimientoPreventivoId: plan.id,
            prioridad: plan.prioridad,
            tipo: plan.componente,
          },
        })
        const generated = await new PreventiveService().generateOrder(
          schedule.id,
          { prioridad: 'MEDIA' },
          admin.actor,
        )
        await makeOrderClosable(generated.orden.id, mechanic.actor.id)
        return { bus, orderId: generated.orden.id, plan, schedule }
      }

      const retryCycle = await createClosableCycle()
      const agent = await login(admin.user.email)
      const idempotencyKey = randomUUID()
      const first = await agent
        .post(`/ordenes-trabajo/${retryCycle.orderId}/cerrar`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ observacion: 'Cierre preventivo P6-C' })
        .expect(200)
      const replay = await agent
        .post(`/ordenes-trabajo/${retryCycle.orderId}/cerrar`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ observacion: 'Cierre preventivo P6-C' })
        .expect(200)
      expect(replay.body).toEqual(first.body)

      const retrySuccessors = await prisma.programacionMantenimiento.findMany({
        where: {
          activa: true,
          busId: retryCycle.bus.id,
          planMantenimientoPreventivo: { claveTarea: retryCycle.plan.claveTarea },
        },
      })
      expect(retrySuccessors).toHaveLength(1)
      expect(retrySuccessors[0].kilometrajeObjetivo).toBe(60000)

      const concurrentCycle = await createClosableCycle()
      const repository = new WorkOrderRepository()
      const [left, right] = await Promise.all([
        repository.closeOrder(concurrentCycle.orderId, admin.actor.id, 'Cierre concurrente A'),
        repository.closeOrder(concurrentCycle.orderId, admin.actor.id, 'Cierre concurrente B'),
      ])
      expect([left.status, right.status].sort()).toEqual(['CLOSED', 'INVALID_STATE'])
      const concurrentSuccessors = await prisma.programacionMantenimiento.findMany({
        where: {
          activa: true,
          busId: concurrentCycle.bus.id,
          planMantenimientoPreventivo: { claveTarea: concurrentCycle.plan.claveTarea },
        },
      })
      expect(concurrentSuccessors).toHaveLength(1)
      expect(concurrentSuccessors[0].kilometrajeObjetivo).toBe(60000)
      expect(
        await prisma.programacionMantenimiento.count({
          where: {
            busId: concurrentCycle.bus.id,
            kilometrajeObjetivo: 70000,
          },
        }),
      ).toBe(0)
    },
    testTimeout,
  )

  it(
    'rechaza el cierre si falta el snapshot historico del plan',
    async () => {
      const bus = await createBus(undefined, 50000)
      const plan = await createPlan(admin.actor.id, { busId: bus.id })
      const schedule = await prisma.programacionMantenimiento.create({
        data: {
          actividad: plan.actividad,
          busId: bus.id,
          creadaPorId: admin.actor.id,
          criterio: plan.criterio,
          kilometrajeObjetivo: 50000,
          planMantenimientoPreventivoId: plan.id,
          prioridad: plan.prioridad,
          tipo: plan.componente,
        },
      })
      const order = await prisma.ordenTrabajo.create({
        data: {
          busId: bus.id,
          codigo: `OT-P6C-${suffix()}`,
          creadaPorId: admin.actor.id,
          descripcion: 'Orden preventiva sin snapshot valido',
          estado: 'PENDIENTE_ASIGNACION',
          kilometrajeObjetivoPreventivo: 50000,
          origen: 'PREVENTIVO',
          prioridad: 'ALTA',
          programacionMantenimientoId: schedule.id,
          tipo: 'PREVENTIVA',
        },
      })
      await makeOrderClosable(order.id, mechanic.actor.id)
      const result = await new WorkOrderRepository().closeOrder(
        order.id,
        admin.actor.id,
        'No debe cerrar',
      )
      expect(result.status).toBe('INVALID_PREVENTIVE_SNAPSHOT')
      expect(
        (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: order.id } })).estado,
      ).toBe('COMPLETADA_TECNICO')
      expect(
        (await prisma.programacionMantenimiento.findUniqueOrThrow({ where: { id: schedule.id } }))
          .activa,
      ).toBe(true)
    },
    testTimeout,
  )
})
