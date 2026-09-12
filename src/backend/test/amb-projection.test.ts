import { randomUUID } from 'node:crypto'
import { PrismaClient, type RolCodigo } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { officialAmbRoutes } from '../src/amb/routes.js'
import { evaluateJourneyProjectionAlerts } from '../src/alerts/journey-projection-alerts.js'
import { evaluatePreventiveAlertsForBus } from '../src/alerts/alert.service.js'
import { createApp } from '../src/app.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const suffix = randomUUID().slice(0, 8).toUpperCase()
const password = 'Prueba-AMB-simulada-2026'
const app = createApp()
const buses: number[] = []
const users: number[] = []
type Agent = Awaited<ReturnType<typeof createCsrfAgent>>
let dispatch: Agent, driver: Agent, outsider: Agent, admin: Agent
let driverId: number, adminId: number
let routeId: number
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

async function user(roleCode: RolCodigo, label: string) {
  const role = await prisma.rol.upsert({
    where: { codigo: roleCode },
    update: {},
    create: { codigo: roleCode, nombre: roleCode },
  })
  const created = await prisma.usuario.create({
    data: {
      nombre: `SIM-AMB-${label}`,
      email: `${suffix.toLowerCase()}-${label}@test.sgmv.local`,
      contrasenaHash: await hash(password, 10),
      rolId: role.id,
    },
  })
  users.push(created.id)
  const agent = await createCsrfAgent(app)
  await agent.post('/auth/login').send({ email: created.email, contrasena: password }).expect(200)
  return { agent, id: created.id }
}

async function setupCycle() {
  const bus = await prisma.bus.create({
    data: {
      codigoInterno: `SIM-${suffix}-${buses.length}`,
      placa: `A${suffix.slice(0, 5)}${buses.length}`,
      anio: 2026,
      marca: 'SGMV-DEMO',
      modelo: 'URBANO-DUAL-A',
      kilometrajeActual: 48930,
    },
  })
  buses.push(bus.id)
  const plan = await prisma.planMantenimientoPreventivo.create({
    data: {
      busId: bus.id,
      claveTarea: `AMB.${bus.id}`,
      componente: 'Motor simulado',
      actividad: 'Servicio simulado',
      criterio: 'KILOMETRAJE',
      intervaloKm: 5000,
      anticipacionKm: 500,
      bloqueaAlVencer: true,
      creadoPorId: adminId,
      version: 1,
      activo: true,
      prioridad: 'MEDIA',
    },
  })
  const schedule = await prisma.programacionMantenimiento.create({
    data: {
      busId: bus.id,
      creadaPorId: adminId,
      tipo: plan.componente,
      actividad: plan.actividad,
      criterio: 'KILOMETRAJE',
      kilometrajeObjetivo: 49500,
      planMantenimientoPreventivoId: plan.id,
    },
  })
  return { bus, schedule }
}

function program(busId: number, extra = {}) {
  return dispatch.post('/jornadas').send({
    busId,
    conductorId: driverId,
    rutaId: routeId,
    inicioProgramado: ago(60),
    finProgramado: new Date(Date.now() + 3600000).toISOString(),
    simulacion: { ciclosCompletosSimulados: 6, kmNoComercialesSimulados: 8 },
    ...extra,
  })
}

describe('AMB: procedencia, proyección y conciliación reales', () => {
  beforeAll(async () => {
    const a = await user('ADMINISTRADOR', 'admin')
    admin = a.agent
    adminId = a.id
    dispatch = (await user('DESPACHADOR', 'dispatch')).agent
    const d = await user('CONDUCTOR', 'driver')
    driver = d.agent
    driverId = d.id
    outsider = (await user('CONDUCTOR', 'outsider')).agent
    routeId = (await prisma.ruta.findUniqueOrThrow({ where: { codigo: '53' } })).id
  }, 60000)

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      const schedules = await tx.programacionMantenimiento.findMany({
        where: { busId: { in: buses } },
        select: { id: true },
      })
      const journeys = await tx.jornadaOperativa.findMany({
        where: { busId: { in: buses } },
        select: { id: true },
      })
      await tx.alertaDestinatario.deleteMany({
        where: {
          alertaInterna: {
            OR: [
              { programacionMantenimientoId: { in: schedules.map((s) => s.id) } },
              { jornadaOperativaId: { in: journeys.map((j) => j.id) } },
            ],
          },
        },
      })
      await tx.alertaInterna.deleteMany({
        where: {
          OR: [
            { programacionMantenimientoId: { in: schedules.map((s) => s.id) } },
            { jornadaOperativaId: { in: journeys.map((j) => j.id) } },
          ],
        },
      })
      await tx.lecturaKilometraje.deleteMany({ where: { busId: { in: buses } } })
      await tx.jornadaOperativa.deleteMany({ where: { busId: { in: buses } } })
      await tx.programacionMantenimiento.deleteMany({ where: { busId: { in: buses } } })
      await tx.planMantenimientoPreventivo.deleteMany({ where: { busId: { in: buses } } })
      await tx.busEstadoHistorial.deleteMany({ where: { busId: { in: buses } } })
      await tx.bus.deleteMany({ where: { id: { in: buses } } })
      await tx.usuario.deleteMany({ where: { id: { in: users } } })
    })
    await prisma.$disconnect()
  }, 60000)

  it('declara simulada toda compatibilidad técnica del dataset académico, incluida la histórica', async () => {
    const rules = await prisma.compatibilidadRepuesto.findMany({
      where: { repuesto: { fabricante: 'SGMV-DEMO REPUESTOS' } },
      include: { repuesto: true, modeloBus: true, bus: true },
    })
    expect(rules.length).toBeGreaterThanOrEqual(5)
    for (const rule of rules) {
      expect(rule.especificacionesValidadas).toMatchObject({ fuente: 'SIMULADO_SGMV' })
      expect((rule.modeloBus ?? rule.bus)?.marca).toBe('SGMV-DEMO')
      expect(rule.repuesto.numeroParte).toMatch(/^DEMO-/)
    }
    const consumption = await prisma.consumoRepuesto.findFirstOrThrow({
      where: { claveIdempotencia: '95000000-0000-4000-8000-000000000001' },
    })
    expect(consumption.evidenciaCompatibilidad).toMatchObject({
      especificacionesValidadas: { fuente: 'SIMULADO_SGMV' },
    })
  })

  it('conserva las once longitudes y la anomalía 0/0 oficial sin atribuir circuito al AMB', async () => {
    const response = await dispatch.get('/flota/rutas').expect(200)
    const routes = response.body.data.rutas.filter(
      (r: { origenDato: string }) => r.origenDato === 'OFICIAL',
    )
    expect(routes).toHaveLength(11)
    expect(
      Object.fromEntries(
        routes.map((r: { codigo: string; longitudKmOficial: number }) => [
          r.codigo,
          r.longitudKmOficial,
        ]),
      ),
    ).toEqual({
      1: 24,
      7: 23,
      14: 49,
      30: 35,
      37: 36,
      39: 38,
      40: 36,
      41: 22,
      44: 43,
      53: 47,
      55: 15,
    })
    for (const route of routes)
      expect(route).toMatchObject({
        semanticaLongitudOficial: 'NO_DETERMINADA',
        semanticaLongitudDemo: 'CIRCUITO_COMPLETO',
        origenSemanticaDemo: 'SIMULADO_SGMV',
      })
    expect(officialAmbRoutes.find((r) => r.codigo === '55')?.procedencia).toMatchObject({
      capacidadMinimaOficial: 0,
      capacidadMaximaOficial: 0,
    })
    await admin.patch(`/flota/rutas/${routeId}`).send({ nombre: 'Cambio no oficial' }).expect(409)
    await expect(
      prisma.ruta.update({ where: { id: routeId }, data: { longitudKmOficial: 99 } }),
    ).rejects.toThrow('OFFICIAL_ROUTE_IMMUTABLE')
  })

  it('proyecta 290 km, deduplica concurrentemente y solo avisa al conductor asignado sin costos', async () => {
    const { bus, schedule } = await setupCycle()
    const response = await program(bus.id).expect(201)
    const journey = response.body.data.jornada
    expect(typeof journey.id).toBe('number')
    expect(journey.proyeccionDemo).toMatchObject({
      longitudKmOficialSnapshot: 47,
      kmJornadaProyectadosDemo: 290,
      kmEstimadoCierre: 49220,
      kmReal: null,
      conciliada: false,
    })
    expect((await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).kilometrajeActual).toBe(
      48930,
    )
    await Promise.all(
      [1, 2].map(() =>
        prisma.$transaction((tx) => evaluateJourneyProjectionAlerts(journey.id, tx)),
      ),
    )
    const alerts = await prisma.alertaInterna.findMany({
      where: { claveDeduplicacion: { startsWith: `proyeccion-jornada:${journey.id}:` } },
      include: { destinatarios: true },
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].contextoEvento).toMatchObject({
      origenProyeccion: 'SIMULADO_SGMV',
      estadoProyeccion: 'PROYECCION_SIMULADA',
      jornadaId: journey.id,
    })
    const own = await driver.get('/alertas?pageSize=100').expect(200)
    expect(JSON.stringify(own.body)).toContain('PROYECCION_SIMULADA')
    expect(JSON.stringify(own.body)).not.toMatch(/costoTotal|costoUnitario|subtotal|diagnostico/)
    const foreign = await outsider.get('/alertas?pageSize=100').expect(200)
    expect(JSON.stringify(foreign.body)).not.toContain(`"jornadaId":${journey.id}`)
    await outsider.get(`/jornadas/${journey.id}`).expect(404)
    await driver
      .post(`/jornadas/${journey.id}/iniciar`)
      .send({ fechaEvento: ago(50), kilometraje: 48930 })
      .expect(200)
    const finish = await driver
      .post(`/jornadas/${journey.id}/finalizar`)
      .send({ fechaEvento: ago(5), kilometraje: 49205 })
      .expect(200)
    expect(finish.body.data.jornada.proyeccionDemo).toMatchObject({
      kmReal: 275,
      diferenciaKm: -15,
      conciliada: true,
    })
    expect((await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).kilometrajeActual).toBe(
      49205,
    )
    expect(
      (await prisma.alertaInterna.findUniqueOrThrow({ where: { id: alerts[0].id } }))
        .contextoEvento,
    ).toMatchObject({ estadoProyeccion: 'CONCILIADA', kmReal: 275, diferenciaKm: -15 })
    expect(
      (await prisma.programacionMantenimiento.findUniqueOrThrow({ where: { id: schedule.id } }))
        .kilometrajeObjetivo,
    ).toBe(49500)
  }, 60000)

  it('anula avisos al cancelar y rechaza simulación sin ruta oficial o operandos válidos', async () => {
    const { bus } = await setupCycle()
    await program(bus.id, { rutaId: null }).expect(400)
    await program(bus.id, {
      simulacion: { ciclosCompletosSimulados: -1, kmNoComercialesSimulados: 8 },
    }).expect(400)
    const response = await program(bus.id).expect(201)
    const id = response.body.data.jornada.id
    await dispatch
      .post(`/jornadas/${id}/cancelar`)
      .send({ fechaEvento: ago(1), motivo: 'Anulación simulada' })
      .expect(200)
    const alert = await prisma.alertaInterna.findFirstOrThrow({
      where: { claveDeduplicacion: { startsWith: `proyeccion-jornada:${id}:` } },
    })
    expect(alert.contextoEvento).toMatchObject({ estadoProyeccion: 'ANULADA' })
    expect((await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).kilometrajeActual).toBe(
      48930,
    )
  }, 60000)

  it('entrega también alertas preventivas reales al conductor con jornada vigente', async () => {
    const { bus } = await setupCycle()
    const response = await program(bus.id).expect(201)
    const id = response.body.data.jornada.id
    await driver
      .post(`/jornadas/${id}/iniciar`)
      .send({ fechaEvento: ago(0.5), kilometraje: 49050 })
      .expect(200)
    await prisma.$transaction((tx) => evaluatePreventiveAlertsForBus(bus.id, tx))
    const own = await driver.get('/alertas?pageSize=100').expect(200)
    expect(JSON.stringify(own.body)).toContain(
      `El bus ${bus.codigoInterno} tiene mantenimiento preventivo proximo.`,
    )
    await dispatch
      .post(`/jornadas/${id}/cancelar`)
      .send({ fechaEvento: ago(0.1), motivo: 'Fin de prueba', kilometrajeFinal: 49050 })
      .expect(200)
  }, 60000)
})
