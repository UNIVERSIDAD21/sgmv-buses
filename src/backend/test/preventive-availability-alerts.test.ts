import { randomUUID } from 'node:crypto'

import { PrismaClient, type RolCodigo } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildAvailability } from '../src/availability/availability.policy.js'
import { getAvailabilityRecords } from '../src/availability/availability.repository.js'
import { createApp } from '../src/app.js'
import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import { evaluatePreventiveAlertsForBus } from '../src/alerts/alert.service.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const testTimeout = 120_000
const created = {
  buses: [] as string[],
  plans: [] as string[],
  schedules: [] as string[],
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
  const user = await prisma.usuario.create({
    data: {
      contrasenaHash: await hash(password, 10),
      email: `p6d-${roleCode.toLowerCase()}-${suffix().toLowerCase()}@test.sgmv.local`,
      estado: 'ACTIVO',
      nombre: `Usuario P6-D ${roleCode}`,
      rolId: role.id,
    },
  })
  created.users.push(user.id)
  const actor: AuthenticatedUser = {
    email: user.email,
    estado: user.estado,
    id: user.id,
    nombre: user.nombre,
    rol: { codigo: role.codigo, nombre: role.nombre },
  }
  return { actor, user }
}

async function createBus(kilometrajeActual = 10_000) {
  const id = randomUUID()
  const code = suffix()
  created.buses.push(id)
  return prisma.bus.create({
    data: {
      id,
      anio: 2025,
      codigoInterno: `P6D-${code}`,
      kilometrajeActual,
      marca: 'Marca P6-D',
      modelo: 'Modelo P6-D',
      placa: `D${code.slice(0, 6)}`,
    },
  })
}

async function createCycle(
  adminId: string,
  overrides: Partial<{
    bloqueaAlVencer: boolean
    fechaProgramada: Date | null
    kilometrajeActual: number
    kilometrajeObjetivo: number | null
  }> = {},
) {
  const bus = await createBus(overrides.kilometrajeActual ?? 10_000)
  const plan = await prisma.planMantenimientoPreventivo.create({
    data: {
      activo: true,
      actividad: 'Detalle tecnico que no debe proyectarse al despacho',
      anticipacionDias: null,
      anticipacionKm: 500,
      bloqueaAlVencer: overrides.bloqueaAlVencer ?? true,
      busId: bus.id,
      claveTarea: `P6D.${suffix()}`,
      componente: 'Sistema tecnico reservado',
      creadoPorId: adminId,
      criterio: overrides.fechaProgramada ? 'FECHA' : 'KILOMETRAJE',
      intervaloDias: overrides.fechaProgramada ? 30 : null,
      intervaloKm: overrides.fechaProgramada ? null : 10_000,
      prioridad: 'ALTA',
      version: 1,
    },
  })
  created.plans.push(plan.id)
  const schedule = await prisma.programacionMantenimiento.create({
    data: {
      actividad: plan.actividad,
      busId: bus.id,
      creadaPorId: adminId,
      criterio: plan.criterio,
      fechaProgramada: overrides.fechaProgramada ?? null,
      kilometrajeObjetivo: overrides.kilometrajeObjetivo ?? 10_000,
      planMantenimientoPreventivoId: plan.id,
      prioridad: plan.prioridad,
      tipo: plan.componente,
    },
  })
  created.schedules.push(schedule.id)
  return { bus, plan, schedule }
}

async function login(email: string) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)
  return agent
}

async function availabilityFor(busId: string, when = new Date('2026-09-06T15:00:00.000Z')) {
  return prisma.$transaction(async (tx) =>
    buildAvailability(await getAvailabilityRecords({ busId, eventDate: when }, tx), when),
  )
}

async function cleanup() {
  const alerts = await prisma.alertaInterna.findMany({
    where: { programacionMantenimientoId: { in: created.schedules } },
    select: { id: true },
  })
  await prisma.$transaction(async (tx) => {
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: alerts.map((item) => item.id) } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((item) => item.id) } } })
    await tx.ordenTrabajo.deleteMany({
      where: { programacionMantenimientoId: { in: created.schedules } },
    })
    await tx.ordenTrabajo.deleteMany({ where: { busId: { in: created.buses } } })
    await tx.novedad.deleteMany({ where: { busId: { in: created.buses } } })
    await tx.programacionMantenimiento.deleteMany({ where: { id: { in: created.schedules } } })
    await tx.planMantenimientoPreventivo.deleteMany({ where: { id: { in: created.plans } } })
    await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
    await tx.usuario.deleteMany({ where: { id: { in: created.users } } })
  })
}

describe('P6-D disponibilidad preventiva y alertas por ciclo', () => {
  let admin: Awaited<ReturnType<typeof createUser>>
  let dispatcher: Awaited<ReturnType<typeof createUser>>
  let mechanic: Awaited<ReturnType<typeof createUser>>
  let driver: Awaited<ReturnType<typeof createUser>>

  beforeAll(async () => {
    ;[admin, dispatcher, mechanic, driver] = await Promise.all([
      createUser('ADMINISTRADOR'),
      createUser('DESPACHADOR'),
      createUser('MECANICO'),
      createUser('CONDUCTOR'),
    ])
  }, testTimeout)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, testTimeout)

  it(
    'bloquea solo el vencido contractual y conserva causas acumuladas de novedad y orden',
    async () => {
      const { bus, schedule } = await createCycle(admin.actor.id)
      const overdue = await availabilityFor(bus.id)
      expect(overdue.disponible).toBe(false)
      expect(overdue.causaPrincipal).toBe('PREVENTIVO_VENCIDO_BLOQUEANTE')

      const novelty = await prisma.novedad.create({
        data: {
          bloqueaDisponibilidad: true,
          busId: bus.id,
          conductorId: driver.actor.id,
          criticidad: 'ALTA',
          descripcion: 'Novedad de prueba bloqueante',
          estado: 'PENDIENTE_REVISION',
          fechaOcurrencia: new Date(),
          fechaReporte: new Date(),
          afectaOperacion: true,
          tipo: 'Novedad de disponibilidad P6-D',
        },
      })
      const orderDate = new Date()
      const order = await prisma.ordenTrabajo.create({
        data: {
          busId: bus.id,
          codigo: `OT-P6D-${suffix()}`,
          creadaPorId: admin.actor.id,
          descripcion: 'Orden activa de prueba',
          estado: 'EN_EJECUCION',
          fechaAsignacion: orderDate,
          fechaCreacion: orderDate,
          fechaInicioEjecucion: orderDate,
          novedadId: novelty.id,
          origen: 'NOVEDAD',
          prioridad: 'ALTA',
          tecnicoAsignadoId: mechanic.actor.id,
          tipo: 'CORRECTIVA',
        },
      })
      const accumulated = await availabilityFor(bus.id)
      expect(accumulated.causas.map((cause) => cause.codigo)).toEqual([
        'ORDEN_TECNICA_ACTIVA',
        'NOVEDAD_BLOQUEANTE',
        'PREVENTIVO_VENCIDO_BLOQUEANTE',
      ])

      await prisma.programacionMantenimiento.update({
        where: { id: schedule.id },
        data: { activa: false },
      })
      const afterPreventiveClose = await availabilityFor(bus.id)
      expect(afterPreventiveClose.disponible).toBe(false)
      expect(afterPreventiveClose.causas.map((cause) => cause.codigo)).toEqual([
        'ORDEN_TECNICA_ACTIVA',
        'NOVEDAD_BLOQUEANTE',
      ])
      await prisma.ordenTrabajo.delete({ where: { id: order.id } })
      await prisma.novedad.update({
        where: { id: novelty.id },
        data: { estado: 'RESUELTA_SIN_ORDEN' },
      })
      expect((await availabilityFor(bus.id)).disponible).toBe(true)
    },
    testTimeout,
  )

  it(
    'no bloquea un preventivo proximo ni un plan vencido sin bloqueo contractual',
    async () => {
      const near = await createCycle(admin.actor.id, {
        kilometrajeActual: 9_600,
        kilometrajeObjetivo: 10_000,
      })
      const nonBlocking = await createCycle(admin.actor.id, { bloqueaAlVencer: false })
      expect((await availabilityFor(near.bus.id)).disponible).toBe(true)
      expect((await availabilityFor(nonBlocking.bus.id)).disponible).toBe(true)
    },
    testTimeout,
  )

  it(
    'emite alertas por ciclo con destinatarios autorizados, contexto sanitizado y deduplicacion concurrente',
    async () => {
      const near = await createCycle(admin.actor.id, {
        kilometrajeActual: 9_600,
        kilometrajeObjetivo: 10_000,
      })
      const overdue = await createCycle(admin.actor.id)

      await Promise.all([
        prisma.$transaction((tx) => evaluatePreventiveAlertsForBus(near.bus.id, tx)),
        prisma.$transaction((tx) => evaluatePreventiveAlertsForBus(near.bus.id, tx)),
        prisma.$transaction((tx) => evaluatePreventiveAlertsForBus(overdue.bus.id, tx)),
        prisma.$transaction((tx) => evaluatePreventiveAlertsForBus(overdue.bus.id, tx)),
      ])

      const alerts = await prisma.alertaInterna.findMany({
        where: { programacionMantenimientoId: { in: [near.schedule.id, overdue.schedule.id] } },
        include: { destinatarios: { include: { usuario: { include: { rol: true } } } } },
        orderBy: { tipo: 'asc' },
      })
      expect(alerts).toHaveLength(2)
      const next = alerts.find((item) => item.tipo === 'MANTENIMIENTO_PROXIMO')!
      const expired = alerts.find((item) => item.tipo === 'MANTENIMIENTO_VENCIDO')!
      expect(next.destinatarios.every((item) => item.usuario.rol.codigo === 'ADMINISTRADOR')).toBe(
        true,
      )
      expect(new Set(expired.destinatarios.map((item) => item.usuario.rol.codigo))).toEqual(
        new Set(['ADMINISTRADOR', 'DESPACHADOR']),
      )
      expect(next.claveDeduplicacion).toContain(`programacion:${near.schedule.id}:v1`)
      expect(JSON.stringify(alerts.map((item) => item.contextoEvento))).not.toContain(
        'Detalle tecnico que no debe proyectarse',
      )
      expect(JSON.stringify(alerts.map((item) => item.contextoEvento))).not.toContain(
        'Sistema tecnico reservado',
      )
    },
    testTimeout,
  )

  it(
    'proyecta restricciones seguras para Administrador y Despachador, y niega otros roles',
    async () => {
      const cycle = await createCycle(admin.actor.id)
      const [administratorAgent, dispatcherAgent, mechanicAgent, driverAgent] = await Promise.all([
        login(admin.user.email),
        login(dispatcher.user.email),
        login(mechanic.user.email),
        login(driver.user.email),
      ])
      const administrator = await administratorAgent
        .get('/mantenimiento-preventivo/restricciones')
        .expect(200)
      const dispatch = await dispatcherAgent
        .get('/mantenimiento-preventivo/restricciones')
        .expect(200)
      expect(administrator.body.data.restricciones).toEqual(
        expect.arrayContaining([expect.objectContaining({ programacionId: cycle.schedule.id })]),
      )
      const operational = dispatch.body.data.restricciones.find(
        (item: { programacionId: string }) => item.programacionId === cycle.schedule.id,
      )
      expect(operational).toMatchObject({ bloqueaDespacho: true, estado: 'VENCIDO' })
      expect(JSON.stringify(operational)).not.toContain('Detalle tecnico')
      expect(JSON.stringify(operational)).not.toContain('Sistema tecnico reservado')
      expect(
        await prisma.alertaInterna.count({
          where: { programacionMantenimientoId: cycle.schedule.id },
        }),
      ).toBe(0)
      await mechanicAgent.get('/mantenimiento-preventivo/restricciones').expect(403)
      await driverAgent.get('/mantenimiento-preventivo/restricciones').expect(403)
    },
    testTimeout,
  )
})
