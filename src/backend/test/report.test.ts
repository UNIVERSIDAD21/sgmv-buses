import { randomUUID } from 'node:crypto'

import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const password = 'Clave-demo-segura-123'
const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()

const created = {
  buses: [] as string[],
  consumos: [] as string[],
  intervenciones: [] as string[],
  novedades: [] as string[],
  ordenes: [] as string[],
  programaciones: [] as string[],
  repuestos: [] as string[],
  usuarios: [] as string[],
}

interface ReportFixture {
  adminEmail: string
  busId: string
  conductorEmail: string
  mecanicoEmail: string
  otherBusId: string
}

async function ensureRoles() {
  const [admin, mecanico, conductor] = await Promise.all([
    prisma.rol.upsert({
      create: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
      update: {},
      where: { codigo: 'ADMINISTRADOR' },
    }),
    prisma.rol.upsert({
      create: { codigo: 'MECANICO', nombre: 'Mecánico' },
      update: { nombre: 'Mecánico' },
      where: { codigo: 'MECANICO' },
    }),
    prisma.rol.upsert({
      create: { codigo: 'CONDUCTOR', nombre: 'Conductor' },
      update: {},
      where: { codigo: 'CONDUCTOR' },
    }),
  ])

  return { admin, conductor, mecanico }
}

async function createUser(label: string, role: Rol) {
  const id = randomUUID()
  created.usuarios.push(id)

  return prisma.usuario.create({
    data: {
      contrasenaHash: await hash(password, 10),
      email: `rf06-${label}-${suffix.toLowerCase()}@test.sgmv.local`,
      id,
      nombre: `RF06 ${label}`,
      rolId: role.id,
    },
  })
}

async function createFixture(): Promise<ReportFixture> {
  const roles = await ensureRoles()
  const [admin, mechanic, otherMechanic, driver, otherDriver] = await Promise.all([
    createUser('admin', roles.admin),
    createUser('mecanico', roles.mecanico),
    createUser('otro-mecanico', roles.mecanico),
    createUser('conductor', roles.conductor),
    createUser('otro-conductor', roles.conductor),
  ])
  const bus = await prisma.bus.create({
    data: {
      anio: 2024,
      codigoInterno: `RF06-BUS-${suffix}`,
      id: randomUUID(),
      kilometrajeActual: 48000,
      marca: 'Mercedes-Benz',
      modelo: 'O500',
      placa: `R${suffix.slice(0, 6)}`,
    },
  })
  const otherBus = await prisma.bus.create({
    data: {
      anio: 2022,
      codigoInterno: `RF06-OTRO-${suffix}`,
      id: randomUUID(),
      kilometrajeActual: 62000,
      marca: 'Volvo',
      modelo: 'B340M',
      placa: `S${suffix.slice(0, 6)}`,
    },
  })
  created.buses.push(bus.id, otherBus.id)

  await prisma.asignacionConductor.create({
    data: {
      asignadoPorId: admin.id,
      busId: bus.id,
      conductorId: driver.id,
      motivo: 'Asignación RF-06',
    },
  })
  const schedule = await prisma.programacionMantenimiento.create({
    data: {
      actividad: 'Cambio de aceite y revisión de filtros',
      busId: bus.id,
      creadaPorId: admin.id,
      criterio: 'FECHA_KILOMETRAJE',
      fechaProgramada: new Date('2026-08-15T00:00:00.000Z'),
      kilometrajeObjetivo: 50000,
      tipo: 'Revisión 50.000 km',
    },
  })
  created.programaciones.push(schedule.id)
  const ownNovelty = await prisma.novedad.create({
    data: {
      busId: bus.id,
      conductorId: driver.id,
      descripcion: 'Vibración leve al frenar',
      estado: 'CONVERTIDA_A_ORDEN',
      tipo: 'Frenos',
    },
  })
  const otherNovelty = await prisma.novedad.create({
    data: {
      busId: bus.id,
      conductorId: otherDriver.id,
      descripcion: 'Novedad de otro conductor',
      tipo: 'Otro',
    },
  })
  created.novedades.push(ownNovelty.id, otherNovelty.id)

  const order = await prisma.ordenTrabajo.create({
    data: {
      busId: bus.id,
      codigo: `OT-RF06-${suffix}`,
      costoTotal: '185000.00',
      creadaPorId: admin.id,
      descripcion: 'Revisión correctiva del sistema de frenos',
      estado: 'ASIGNADA',
      fechaAsignacion: new Date('2026-08-10T12:00:00.000Z'),
      fechaCreacion: new Date('2026-08-10T10:00:00.000Z'),
      novedadId: ownNovelty.id,
      origen: 'NOVEDAD',
      prioridad: 'ALTA',
      tecnicoAsignadoId: mechanic.id,
      tipo: 'CORRECTIVA',
    },
  })
  created.ordenes.push(order.id)
  const inaccessibleOrder = await prisma.ordenTrabajo.create({
    data: {
      busId: otherBus.id,
      codigo: `OT-RF06-OTHER-${suffix}`,
      costoTotal: '90000.00',
      creadaPorId: admin.id,
      descripcion: 'Orden reservada para otro mecánico',
      estado: 'ASIGNADA',
      fechaAsignacion: new Date('2026-08-20T11:00:00.000Z'),
      fechaCreacion: new Date('2026-08-20T10:00:00.000Z'),
      origen: 'CORRECTIVO_DIRECTO',
      tecnicoAsignadoId: otherMechanic.id,
      tipo: 'CORRECTIVA',
    },
  })
  created.ordenes.push(inaccessibleOrder.id)
  const intervention = await prisma.intervencion.create({
    data: {
      diagnostico: 'Desgaste de pastillas delanteras',
      fechaFin: new Date('2026-08-12T17:00:00.000Z'),
      fechaInicio: new Date('2026-08-11T08:00:00.000Z'),
      observaciones: 'Prueba de frenado satisfactoria',
      ordenTrabajoId: order.id,
      tecnicoId: mechanic.id,
    },
  })
  created.intervenciones.push(intervention.id)
  await prisma.actividadOrden.create({
    data: {
      descripcion: 'Cambio de pastillas y limpieza',
      intervencionId: intervention.id,
      registradaPorId: mechanic.id,
    },
  })
  const part = await prisma.repuesto.create({
    data: {
      categoria: 'Frenos',
      codigo: `REP-RF06-${suffix}`,
      costoUnitario: '92500.00',
      id: randomUUID(),
      nombre: 'Pastilla de freno RF-06',
      stockActual: '8.00',
      stockMinimo: '2.00',
      unidadMedida: 'unidad',
    },
  })
  created.repuestos.push(part.id)
  const consumptionId = randomUUID()
  created.consumos.push(consumptionId)
  await prisma.$transaction(async (tx) => {
    await tx.repuesto.update({
      data: { stockActual: { decrement: '2.00' } },
      where: { id: part.id },
    })
    await tx.consumoRepuesto.create({
      data: {
        cantidad: '2.00',
        consumidoPorId: mechanic.id,
        costoUnitario: '92500.00',
        id: consumptionId,
        ordenTrabajoId: order.id,
        repuestoId: part.id,
        subtotal: '185000.00',
      },
    })
    await tx.movimientoInventario.create({
      data: {
        cantidad: '2.00',
        consumoRepuestoId: consumptionId,
        costoUnitario: '92500.00',
        motivo: `Consumo asociado a orden ${order.codigo}`,
        repuestoId: part.id,
        responsableId: mechanic.id,
        tipo: 'CONSUMO',
      },
    })
    await tx.ordenTrabajo.update({
      data: { costoTotal: { increment: '185000.00' } },
      where: { id: order.id },
    })
  })
  await prisma.ordenTrabajo.update({
    data: {
      cerradaPorId: admin.id,
      estado: 'CERRADA',
      fechaCierre: new Date('2026-08-12T18:00:00.000Z'),
      fechaCompletadaTecnico: new Date('2026-08-12T17:30:00.000Z'),
      fechaInicioEjecucion: new Date('2026-08-11T08:00:00.000Z'),
    },
    where: { id: order.id },
  })

  return {
    adminEmail: admin.email,
    busId: bus.id,
    conductorEmail: driver.email,
    mecanicoEmail: mechanic.email,
    otherBusId: otherBus.id,
  }
}

async function loginAgent(email: string) {
  const agent = await createCsrfAgent(createApp())
  await agent.post('/auth/login').send({ contrasena: password, email }).expect(200)
  return agent
}

async function cleanup() {
  await prisma.$transaction(
    async (tx) => {
      await tx.movimientoInventario.deleteMany({
        where: { consumoRepuestoId: { in: created.consumos } },
      })
      await tx.consumoRepuesto.deleteMany({ where: { id: { in: created.consumos } } })
      await tx.actividadOrden.deleteMany({
        where: { intervencionId: { in: created.intervenciones } },
      })
      await tx.intervencion.deleteMany({ where: { id: { in: created.intervenciones } } })
      await tx.ordenEstadoHistorial.deleteMany({
        where: { ordenTrabajoId: { in: created.ordenes } },
      })
      await tx.ordenReasignacion.deleteMany({
        where: { ordenTrabajoId: { in: created.ordenes } },
      })
      await tx.ordenTrabajo.deleteMany({ where: { id: { in: created.ordenes } } })
      await tx.novedad.deleteMany({ where: { id: { in: created.novedades } } })
      await tx.programacionMantenimiento.deleteMany({
        where: { id: { in: created.programaciones } },
      })
      await tx.asignacionConductor.deleteMany({ where: { busId: { in: created.buses } } })
      await tx.repuesto.deleteMany({ where: { id: { in: created.repuestos } } })
      await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
      await tx.usuario.deleteMany({ where: { id: { in: created.usuarios } } })
    },
    { maxWait: 15000, timeout: 60000 },
  )
}

describe('RF-06 History and reports API', () => {
  let fixture: ReportFixture

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

  it('requires authentication for the history module', async () => {
    await request(createApp()).get('/historial/resumen').expect(401)
  })

  it('gives administrators the full history, costs and three derived reports', async () => {
    const admin = await loginAgent(fixture.adminEmail)
    const summary = await admin
      .get('/historial/resumen')
      .query({ busId: fixture.busId })
      .expect(200)

    expect(summary.body.data.rol).toBe('ADMINISTRADOR')
    expect(summary.body.data.costoTotal).toBe('185000.00')
    expect(summary.body.data.indicadores.buses).toBe(1)
    expect(summary.body.data.indicadores.mantenimientosProgramados).toBe(1)
    expect(summary.body.data.indicadores.novedades).toBe(2)

    const filteredSummary = await admin
      .get('/historial/resumen')
      .query({ busqueda: `RF06-BUS-${suffix}`, fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' })
      .expect(200)
    expect(filteredSummary.body.data.indicadores.buses).toBe(1)
    expect(filteredSummary.body.data.indicadores.ordenes).toBe(1)
    expect(filteredSummary.body.data.indicadores.mantenimientosProgramados).toBe(1)
    expect(filteredSummary.body.data.indicadores.novedades).toBe(0)
    expect(filteredSummary.body.data.costoTotal).toBe('185000.00')

    const emptySummary = await admin
      .get('/historial/resumen')
      .query({ busId: fixture.busId, tipo: 'PREVENTIVA' })
      .expect(200)
    expect(emptySummary.body.data.indicadores.buses).toBe(0)
    expect(emptySummary.body.data.indicadores.ordenes).toBe(0)
    expect(emptySummary.body.data.indicadores.mantenimientosProgramados).toBe(0)
    expect(emptySummary.body.data.indicadores.novedades).toBe(0)
    expect(emptySummary.body.data.costoTotal).toBe('0.00')

    const buses = await admin
      .get('/historial/buses')
      .query({ busqueda: `RF06-BUS-${suffix}`, page: 1, pageSize: 1 })
      .expect(200)
    expect(buses.body.data.buses).toHaveLength(1)
    expect(buses.body.data.buses[0].costoAcumulado).toBe('185000.00')

    const detail = await admin.get(`/historial/buses/${fixture.busId}`).expect(200)
    expect(detail.body.data.ordenes[0].costoTotal).toBe('185000.00')
    expect(detail.body.data.ordenes[0].repuestos[0].subtotal).toBe('185000.00')
    expect(detail.body.data.asignaciones).toHaveLength(1)
    expect(detail.body.data.novedades).toHaveLength(2)

    const maintenance = await admin
      .get('/historial/informes/mantenimiento')
      .query({
        busqueda: `RF06-BUS-${suffix}`,
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-31',
      })
      .expect(200)
    const parts = await admin
      .get('/historial/informes/repuestos')
      .query({ busqueda: `RF06-BUS-${suffix}` })
      .expect(200)
    const costs = await admin
      .get('/historial/informes/costos')
      .query({ busqueda: `RF06-BUS-${suffix}` })
      .expect(200)

    expect(maintenance.body.data.registros[0].codigo).toBe(`OT-RF06-${suffix}`)
    expect(parts.body.data.registros[0].codigo).toBe(`REP-RF06-${suffix}`)
    expect(costs.body.data.registros[0].costoTotal).toBe('185000.00')
  }, 60000)

  it('limits mechanics to buses with their assigned or historical interventions and hides costs', async () => {
    const mechanic = await loginAgent(fixture.mecanicoEmail)
    const buses = await mechanic.get('/historial/buses').expect(200)

    expect(buses.body.data.buses.map((bus: { id: string }) => bus.id)).toContain(fixture.busId)
    expect(buses.body.data.buses.map((bus: { id: string }) => bus.id)).not.toContain(
      fixture.otherBusId,
    )
    expect(JSON.stringify(buses.body)).not.toContain('costoAcumulado')

    const inaccessibleList = await mechanic
      .get('/historial/buses')
      .query({ busId: fixture.otherBusId })
      .expect(200)
    expect(inaccessibleList.body.data.buses).toHaveLength(0)
    expect(inaccessibleList.body.data.paginacion.total).toBe(0)

    const detail = await mechanic.get(`/historial/buses/${fixture.busId}`).expect(200)
    const serialized = JSON.stringify(detail.body)
    expect(detail.body.data.ordenes[0].diagnosticos[0].diagnostico).toContain('Desgaste')
    expect(detail.body.data.ordenes[0].repuestos[0].codigo).toBe(`REP-RF06-${suffix}`)
    expect(serialized).not.toContain('costoTotal')
    expect(serialized).not.toContain('costoUnitario')
    expect(serialized).not.toContain('subtotal')

    await mechanic.get(`/historial/buses/${fixture.otherBusId}`).expect(403)
    await mechanic.get('/historial/informes/costos').expect(403)
  }, 60000)

  it('derives the driver bus server-side and exposes only own novelties without technical costs', async () => {
    const driver = await loginAgent(fixture.conductorEmail)
    const summary = await driver.get('/historial/resumen').expect(200)
    const ownBus = await driver.get('/historial/mi-bus').expect(200)
    const serialized = JSON.stringify(ownBus.body)

    expect(summary.body.data.indicadores.buses).toBe(1)
    expect(ownBus.body.data.historial.bus.id).toBe(fixture.busId)
    expect(ownBus.body.data.historial.novedades).toHaveLength(1)
    expect(ownBus.body.data.historial.novedades[0].descripcion).toContain('Vibración')
    expect(serialized).not.toContain('Novedad de otro conductor')
    expect(serialized).not.toContain('costoTotal')
    expect(serialized).not.toContain('repuestos')
    expect(serialized).not.toContain('diagnosticos')

    await driver.get('/historial/buses').expect(403)
    await driver.get(`/historial/buses/${fixture.busId}`).expect(403)
    await driver.get('/historial/informes/repuestos').expect(403)
  }, 60000)

  it('validates chronological filters and supports filtered pagination aliases', async () => {
    const admin = await loginAgent(fixture.adminEmail)

    await admin
      .get('/historial/informes/mantenimiento')
      .query({ fechaDesde: '2026-09-01', fechaHasta: '2026-08-01' })
      .expect(400)

    const response = await admin
      .get('/historial/informes/mantenimiento')
      .query({ page: 1, pageSize: 1, tipo: 'CORRECTIVA' })
      .expect(200)

    expect(response.body.data.paginacion.limite).toBe(1)
    expect(response.body.data.registros).toHaveLength(1)
  }, 60000)
})
