import { randomUUID } from 'node:crypto'

import { PrismaClient, type CriterioMantenimiento, type RolCodigo } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import { FleetService } from '../src/fleet/fleet.service.js'
import {
  classifyPreventiveCycle,
  initialPreventiveTargets,
} from '../src/preventive/preventive-cycle.js'
import { PreventivePlanService } from '../src/preventive/preventive-plan.service.js'
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
  const order = await prisma.ordenTrabajo.findUniqueOrThrow({
    where: { id: orderId },
    select: { createdAt: true, fechaCreacion: true },
  })
  const milestoneAt = new Date(Math.max(order.createdAt.getTime(), order.fechaCreacion.getTime()))
  const intervention = await prisma.intervencion.create({
    data: {
      diagnostico: 'Preventivo ejecutado conforme al plan',
      fechaFin: milestoneAt,
      fechaInicio: milestoneAt,
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
      fechaAsignacion: milestoneAt,
      fechaCompletadaTecnico: milestoneAt,
      fechaInicioEjecucion: milestoneAt,
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
    const alerts = await tx.alertaInterna.findMany({
      select: { id: true },
      where: {
        OR: [
          { busId: { in: created.buses } },
          { ordenTrabajoId: { in: orderIds } },
          { programacionMantenimiento: { busId: { in: created.buses } } },
        ],
      },
    })
    const alertIds = alerts.map((alert) => alert.id)
    await tx.alertaDestinatario.deleteMany({
      where: {
        OR: [{ alertaInternaId: { in: alertIds } }, { usuarioId: { in: created.users } }],
      },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
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
    'reconcilia de inmediato la precedencia nueva y el cambio de modelo sin orden activa',
    async () => {
      const firstModel = await createModel()
      const secondModel = await createModel()
      const bus = await createBus(firstModel.id, 20_000)
      const key = `RECONCILIAR.${suffix()}`
      const firstModelPlan = await createPlan(
        admin.actor.id,
        { modeloBusId: firstModel.id },
        { claveTarea: key, intervaloKm: 5_000 },
      )
      const secondModelPlan = await createPlan(
        admin.actor.id,
        { modeloBusId: secondModel.id },
        { claveTarea: key, intervaloKm: 7_000 },
      )
      const oldOnlyKey = `MODELO.ANTERIOR.${suffix()}`
      const oldOnlyPlan = await createPlan(
        admin.actor.id,
        { modeloBusId: firstModel.id },
        { claveTarea: oldOnlyKey, intervaloKm: 4_000 },
      )
      const newOnlyKey = `MODELO.NUEVO.${suffix()}`
      const newOnlyPlan = await createPlan(
        admin.actor.id,
        { modeloBusId: secondModel.id },
        { claveTarea: newOnlyKey, intervaloKm: 8_000 },
      )
      const preventiveService = new PreventiveService()
      const first = await preventiveService.createSchedule(
        { busId: bus.id, planId: firstModelPlan.id },
        admin.actor,
      )
      const oldOnlySchedule = await preventiveService.createSchedule(
        { busId: bus.id, planId: oldOnlyPlan.id },
        admin.actor,
      )

      const busPlanResult = await new PreventivePlanService().createPlan(
        {
          actividad: 'Mantenimiento particular reconciliado para el bus',
          anticipacionKm: 300,
          bloqueaAlVencer: true,
          busId: bus.id,
          claveTarea: key,
          componente: 'Componente particular',
          criterio: 'KILOMETRAJE',
          intervaloKm: 6_000,
          prioridad: 'ALTA',
        },
        admin.actor,
      )
      const afterBusPlan = await prisma.programacionMantenimiento.findMany({
        where: { busId: bus.id, planMantenimientoPreventivo: { claveTarea: key } },
        orderBy: { createdAt: 'asc' },
      })
      expect(afterBusPlan).toHaveLength(2)
      expect(afterBusPlan.find((item) => item.id === first.programacion.id)?.activa).toBe(false)
      expect(afterBusPlan.find((item) => item.activa)).toMatchObject({
        kilometrajeObjetivo: 26_000,
        planMantenimientoPreventivoId: busPlanResult.plan.id,
      })

      await new PreventivePlanService().deactivatePlan(busPlanResult.plan.id, admin.actor)
      const afterDeactivate = await prisma.programacionMantenimiento.findFirstOrThrow({
        where: { activa: true, busId: bus.id, planMantenimientoPreventivo: { claveTarea: key } },
      })
      expect(afterDeactivate).toMatchObject({
        kilometrajeObjetivo: 25_000,
        planMantenimientoPreventivoId: firstModelPlan.id,
      })

      await new FleetService().updateBus(bus.id, { modeloBusId: secondModel.id }, admin.actor)
      const afterModelChange = await prisma.programacionMantenimiento.findMany({
        where: { activa: true, busId: bus.id, planMantenimientoPreventivo: { claveTarea: key } },
      })
      expect(afterModelChange).toHaveLength(1)
      expect(afterModelChange[0]).toMatchObject({
        kilometrajeObjetivo: 27_000,
        planMantenimientoPreventivoId: secondModelPlan.id,
      })
      expect(
        await prisma.programacionMantenimiento.findUniqueOrThrow({
          where: { id: oldOnlySchedule.programacion.id },
        }),
      ).toMatchObject({ activa: false })
      expect(
        await prisma.programacionMantenimiento.findFirstOrThrow({
          where: {
            activa: true,
            busId: bus.id,
            planMantenimientoPreventivo: { claveTarea: newOnlyKey },
          },
        }),
      ).toMatchObject({
        kilometrajeObjetivo: 28_000,
        planMantenimientoPreventivoId: newOnlyPlan.id,
      })
    },
    testTimeout,
  )

  it(
    'difiere la precedencia nueva si hay orden activa y la usa en el siguiente ciclo',
    async () => {
      const model = await createModel()
      const bus = await createBus(model.id, 30_000)
      const key = `DIFERIR.${suffix()}`
      const modelPlan = await createPlan(
        admin.actor.id,
        { modeloBusId: model.id },
        { claveTarea: key, intervaloKm: 5_000 },
      )
      const preventiveService = new PreventiveService()
      const applied = await preventiveService.createSchedule(
        { busId: bus.id, planId: modelPlan.id },
        admin.actor,
      )
      await prisma.bus.update({ where: { id: bus.id }, data: { kilometrajeActual: 35_000 } })
      const generated = await preventiveService.generateOrder(
        applied.programacion.id,
        { prioridad: 'MEDIA' },
        admin.actor,
      )

      const busPlanResult = await new PreventivePlanService().createPlan(
        {
          actividad: 'Mantenimiento particular para el siguiente ciclo',
          anticipacionKm: 300,
          bloqueaAlVencer: true,
          busId: bus.id,
          claveTarea: key,
          componente: 'Componente particular diferido',
          criterio: 'KILOMETRAJE',
          intervaloKm: 6_000,
          prioridad: 'ALTA',
        },
        admin.actor,
      )
      expect(
        await prisma.programacionMantenimiento.findUniqueOrThrow({
          where: { id: applied.programacion.id },
        }),
      ).toMatchObject({ activa: true, planMantenimientoPreventivoId: modelPlan.id })

      await makeOrderClosable(generated.orden.id, mechanic.actor.id)
      expect(
        (
          await new WorkOrderRepository().closeOrder(
            generated.orden.id,
            admin.actor.id,
            'Cierre con precedencia diferida',
          )
        ).status,
      ).toBe('CLOSED')
      const successor = await prisma.programacionMantenimiento.findFirstOrThrow({
        where: { activa: true, busId: bus.id, planMantenimientoPreventivo: { claveTarea: key } },
      })
      expect(successor).toMatchObject({
        kilometrajeObjetivo: 41_000,
        planMantenimientoPreventivoId: busPlanResult.plan.id,
      })
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
