import { randomUUID } from 'node:crypto'

import { hash } from 'bcryptjs'
import { expect, test, type Page } from '@playwright/test'

import { prisma } from '../../backend/src/prisma/client.js'

const demoPassword = process.env.SEED_USER_PASSWORD
const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
const marker = `P10-E2E-${suffix}`

const ids = {
  activity: randomUUID(),
  alertAdmin: randomUUID(),
  alertDriver: randomUUID(),
  alertDispatcherRecipient: randomUUID(),
  alertDriverRecipient: randomUUID(),
  alertAdminRecipient: randomUUID(),
  assignment: randomUUID(),
  bus: randomUUID(),
  compatibility: randomUUID(),
  consumption: randomUUID(),
  driverReading: randomUUID(),
  foreignBus: randomUUID(),
  intervention: randomUUID(),
  journeyFinalReading: randomUUID(),
  journey: randomUUID(),
  model: randomUUID(),
  movement: randomUUID(),
  novelty: randomUUID(),
  noveltyReading: randomUUID(),
  order: randomUUID(),
  orderState: randomUUID(),
  part: randomUUID(),
  route: randomUUID(),
  schedule: randomUUID(),
  technicalReading: randomUUID(),
} as const

const users = {
  admin: '20000000-0000-4000-8000-000000000001',
  dispatcher: '20000000-0000-4000-8000-000000000005',
  mechanic: '20000000-0000-4000-8000-000000000002',
  otherMechanic: '20000000-0000-4000-8000-000000000004',
  driver: randomUUID(),
} as const

const busCode = `000-${marker}`
const foreignBusCode = `000-AJENO-${suffix}`
const orderCode = `OT-${marker}`
const partCode = `REP-${marker}`
const driverEmail = `p10-driver-${suffix.toLowerCase()}@test.sgmv.local`
const fixedStart = new Date('2026-09-02T08:00:00.000Z')
const fixedNovelty = new Date('2026-09-02T10:00:00.000Z')
const fixedClose = new Date('2026-09-02T18:00:00.000Z')

interface ApiHistoryOrder {
  costoTotal?: string
  diagnosticos?: Array<{ diagnostico: string }>
  disponibilidadAlCierre?: boolean
  id: string
  jornada?: { id: string }
  repuestos?: Array<{
    codigo: string
    compatibilidad: { reglaId: string; reglaVersion: number; resultado: string }
    movimiento: { id: string; tipo: string }
    subtotal?: string
  }>
}

interface ApiHistoryData {
  alertas: Array<{ estado?: string; id: string }>
  bus: { id: string }
  costoTotal: string
  historial: ApiHistoryData
  jornadas: Array<{ id: string }>
  novedades: Array<{ id: string }>
  ordenes: ApiHistoryOrder[]
  registros: Array<{ busId: string; costoTotal: string }>
}

type ApiResult = { status: number; body: { data?: ApiHistoryData } }

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase/).fill(demoPassword!)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible({ timeout: 30_000 })
}

async function getApi(page: Page, path: string): Promise<ApiResult> {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(`http://localhost:4000${requestPath}`, {
      credentials: 'include',
    })
    return {
      body: (await response.json()) as { data?: ApiHistoryData },
      status: response.status,
    }
  }, path)
}

async function createFixture() {
  await prisma.$transaction(async (tx) => {
    const driverRole = await tx.rol.findUniqueOrThrow({ where: { codigo: 'CONDUCTOR' } })
    await tx.usuario.create({
      data: {
        contrasenaHash: await hash(demoPassword!, 10),
        email: driverEmail,
        id: users.driver,
        nombre: `Conductor ${marker}`,
        rolId: driverRole.id,
      },
    })
    await tx.modeloBus.create({
      data: {
        id: ids.model,
        marca: 'Marca P10',
        nombreModelo: `Modelo ${marker}`,
        especificaciones: { origen: 'E2E P10', marker },
        versionTecnica: 'P10-1',
      },
    })
    await tx.ruta.create({
      data: {
        codigo: `R-${marker}`,
        destino: 'Terminal norte',
        id: ids.route,
        nombre: `Ruta ${marker}`,
        origen: 'Terminal sur',
      },
    })
    await tx.bus.create({
      data: {
        anio: 2026,
        codigoInterno: busCode,
        id: ids.bus,
        kilometrajeActual: 45_210,
        marca: 'Marca P10',
        modelo: `Modelo ${marker}`,
        modeloBusId: ids.model,
        placa: `P10${suffix.slice(0, 6)}`,
      },
    })
    await tx.bus.create({
      data: {
        anio: 2026,
        codigoInterno: foreignBusCode,
        id: ids.foreignBus,
        kilometrajeActual: 12_000,
        marca: 'Marca P10 ajena',
        modelo: 'Modelo ajeno',
        placa: `X10${suffix.slice(0, 6)}`,
      },
    })
    await tx.asignacionConductor.create({
      data: {
        asignadoPorId: users.admin,
        busId: ids.bus,
        conductorId: users.driver,
        fechaInicio: fixedStart,
        id: ids.assignment,
        motivo: `Asignación ${marker}`,
      },
    })
    await tx.jornadaOperativa.create({
      data: {
        busId: ids.bus,
        conductorId: users.driver,
        estado: 'FINALIZADA',
        finProgramado: new Date('2026-09-02T16:00:00.000Z'),
        finReal: fixedClose,
        id: ids.journey,
        inicioProgramado: fixedStart,
        inicioReal: fixedStart,
        finalizadaPorId: users.admin,
        iniciadaPorId: users.driver,
        programadaPorId: users.dispatcher,
        rutaId: ids.route,
      },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId: ids.bus,
        fechaLectura: fixedStart,
        fechaRegistro: fixedStart,
        id: ids.driverReading,
        jornadaOperativaId: ids.journey,
        kilometrajeAnterior: 45_000,
        kilometrajeNuevo: 45_000,
        registradoPorId: users.driver,
        tipo: 'INICIO_JORNADA',
      },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId: ids.bus,
        fechaLectura: fixedNovelty,
        fechaRegistro: fixedNovelty,
        id: ids.noveltyReading,
        jornadaOperativaId: ids.journey,
        kilometrajeAnterior: 45_100,
        kilometrajeNuevo: 45_100,
        motivo: `Lectura de novedad ${marker}`,
        registradoPorId: users.driver,
        tipo: 'NOVEDAD',
      },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId: ids.bus,
        fechaLectura: fixedClose,
        fechaRegistro: fixedClose,
        id: ids.journeyFinalReading,
        jornadaOperativaId: ids.journey,
        kilometrajeAnterior: 45_100,
        kilometrajeNuevo: 45_200,
        registradoPorId: users.driver,
        tipo: 'FIN_JORNADA',
      },
    })
    await tx.novedad.create({
      data: {
        afectaOperacion: true,
        bloqueaDisponibilidad: false,
        busId: ids.bus,
        clasificacion: 'Frenos',
        conductorId: users.driver,
        criticidad: 'ALTA',
        descripcion: `Novedad propia ${marker}`,
        estado: 'CONVERTIDA_A_ORDEN',
        fechaOcurrencia: fixedNovelty,
        fechaReporte: fixedNovelty,
        jornadaOperativaId: ids.journey,
        lecturaKilometrajeId: ids.noveltyReading,
        id: ids.novelty,
        revisadaPorId: users.admin,
        tipo: `Falla P10 ${marker}`,
      },
    })
    await tx.programacionMantenimiento.create({
      data: {
        actividad: `Mantenimiento ${marker}`,
        busId: ids.bus,
        creadaPorId: users.admin,
        criterio: 'FECHA_KILOMETRAJE',
        fechaProgramada: new Date('2026-09-15T00:00:00.000Z'),
        id: ids.schedule,
        kilometrajeObjetivo: 46_000,
        tipo: 'Preventivo P10',
      },
    })
    await tx.ordenTrabajo.create({
      data: {
        busId: ids.bus,
        codigo: orderCode,
        costoTotal: '185000.00',
        creadaPorId: users.admin,
        descripcion: `Orden integral ${marker}`,
        estado: 'EN_EJECUCION',
        fechaAsignacion: new Date('2026-09-02T11:00:00.000Z'),
        fechaCreacion: new Date('2026-09-02T10:30:00.000Z'),
        fechaInicioEjecucion: new Date('2026-09-02T12:00:00.000Z'),
        id: ids.order,
        jornadaOperativaId: ids.journey,
        novedadId: ids.novelty,
        origen: 'NOVEDAD',
        prioridad: 'ALTA',
        tecnicoAsignadoId: users.mechanic,
        tipo: 'CORRECTIVA',
      },
    })
    await tx.ordenEstadoHistorial.create({
      data: {
        cambiadoPorId: users.admin,
        estadoAnterior: 'COMPLETADA_TECNICO',
        estadoNuevo: 'CERRADA',
        fechaCambio: fixedClose,
        id: ids.orderState,
        observacion: `Cierre ${marker}`,
        ordenTrabajoId: ids.order,
      },
    })
    await tx.intervencion.create({
      data: {
        diagnostico: `Diagnóstico técnico ${marker}`,
        fechaFin: null,
        fechaInicio: new Date('2026-09-02T12:00:00.000Z'),
        id: ids.intervention,
        observaciones: `Observación técnica ${marker}`,
        ordenTrabajoId: ids.order,
        tecnicoId: users.mechanic,
      },
    })
    await tx.actividadOrden.create({
      data: {
        descripcion: `Actividad técnica ${marker}`,
        id: ids.activity,
        intervencionId: ids.intervention,
        registradaPorId: users.mechanic,
      },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId: ids.bus,
        fechaLectura: new Date('2026-09-02T12:05:00.000Z'),
        fechaRegistro: new Date('2026-09-02T12:05:00.000Z'),
        id: ids.technicalReading,
        intervencionId: ids.intervention,
        kilometrajeAnterior: 45_100,
        kilometrajeNuevo: 45_110,
        ordenTrabajoId: ids.order,
        registradoPorId: users.mechanic,
        tipo: 'REVISION_TECNICA',
      },
    })
    await tx.repuesto.create({
      data: {
        categoria: 'Frenos',
        codigo: partCode,
        costoUnitario: '92500.00',
        id: ids.part,
        nombre: `Repuesto ${marker}`,
        stockActual: '8.00',
        stockMinimo: '2.00',
        unidadMedida: 'unidad',
      },
    })
    await tx.compatibilidadRepuesto.create({
      data: {
        busId: ids.bus,
        condicionUso: `Uso validado ${marker}`,
        definidaPorId: users.admin,
        especificacionesValidadas: { fuente: 'E2E P10', marker },
        fechaDefinicion: new Date('2026-09-02T11:30:00.000Z'),
        id: ids.compatibility,
        permitido: true,
        repuestoId: ids.part,
        version: 1,
        vigente: true,
      },
    })
    await tx.consumoRepuesto.create({
      data: {
        cantidad: '2.00',
        consumidoPorId: users.mechanic,
        costoUnitario: '92500.00',
        evidenciaCompatibilidad: { fuente: 'E2E P10', marker },
        fechaConsumo: new Date('2026-09-02T13:00:00.000Z'),
        id: ids.consumption,
        intervencionId: ids.intervention,
        ordenTrabajoId: ids.order,
        reglaCompatibilidadId: ids.compatibility,
        reglaVersion: 1,
        repuestoId: ids.part,
        resultadoCompatibilidad: 'COMPATIBLE',
        subtotal: '185000.00',
      },
    })
    await tx.movimientoInventario.create({
      data: {
        cantidad: '2.00',
        consumoRepuestoId: ids.consumption,
        costoUnitario: '92500.00',
        fechaMovimiento: new Date('2026-09-02T13:00:00.000Z'),
        id: ids.movement,
        motivo: `Consumo ${marker}`,
        repuestoId: ids.part,
        responsableId: users.mechanic,
        tipo: 'CONSUMO',
      },
    })
    await tx.intervencion.update({
      data: { fechaFin: new Date('2026-09-02T17:00:00.000Z') },
      where: { id: ids.intervention },
    })
    await tx.ordenTrabajo.update({
      data: {
        cerradaPorId: users.admin,
        disponibilidadAlCierre: true,
        estado: 'CERRADA',
        fechaCierre: fixedClose,
        fechaCompletadaTecnico: new Date('2026-09-02T17:00:00.000Z'),
      },
      where: { id: ids.order },
    })
    await tx.busEstadoHistorial.create({
      data: {
        busId: ids.bus,
        cambiadoPorId: users.admin,
        estadoAnterior: 'EN_MANTENIMIENTO',
        estadoNuevo: 'OPERATIVO',
        fechaCambio: fixedClose,
        motivo: `Disponible ${marker}`,
      },
    })
    await tx.alertaInterna.create({
      data: {
        busId: ids.bus,
        claveDeduplicacion: `e2e-p10-admin:${suffix}`,
        contextoEvento: {
          busId: ids.bus,
          marker,
          origen: { busId: ids.bus },
          schemaVersion: 1,
        },
        fechaGeneracion: fixedNovelty,
        id: ids.alertAdmin,
        mensaje: `Alerta administrativa ${marker}`,
        prioridad: 'ALTA',
        tipo: 'NOVEDAD_CRITICA',
        titulo: `Alerta admin ${marker}`,
      },
    })
    await tx.alertaInterna.create({
      data: {
        busId: ids.bus,
        claveDeduplicacion: `e2e-p10-driver:${suffix}`,
        contextoEvento: {
          busId: ids.bus,
          marker,
          origen: { busId: ids.bus },
          schemaVersion: 1,
        },
        fechaGeneracion: fixedNovelty,
        id: ids.alertDriver,
        mensaje: `Alerta propia ${marker}`,
        prioridad: 'MEDIA',
        tipo: 'CAMBIO_ESTADO_NOVEDAD',
        titulo: `Alerta conductor ${marker}`,
      },
    })
    await tx.alertaDestinatario.createMany({
      data: [
        {
          alertaInternaId: ids.alertAdmin,
          estado: 'NO_LEIDA',
          id: ids.alertAdminRecipient,
          usuarioId: users.admin,
        },
        {
          alertaInternaId: ids.alertAdmin,
          estado: 'NO_LEIDA',
          id: ids.alertDispatcherRecipient,
          usuarioId: users.dispatcher,
        },
        {
          alertaInternaId: ids.alertDriver,
          estado: 'NO_LEIDA',
          id: ids.alertDriverRecipient,
          usuarioId: users.driver,
        },
      ],
    })
  })
}

async function cleanupFixture() {
  await prisma.$transaction(async (tx) => {
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: [ids.alertAdmin, ids.alertDriver] } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: [ids.alertAdmin, ids.alertDriver] } } })
    await tx.movimientoInventario.deleteMany({ where: { id: ids.movement } })
    await tx.consumoRepuesto.deleteMany({ where: { id: ids.consumption } })
    await tx.compatibilidadRepuesto.deleteMany({ where: { id: ids.compatibility } })
    await tx.actividadOrden.deleteMany({ where: { id: ids.activity } })
    await tx.lecturaKilometraje.deleteMany({ where: { id: ids.technicalReading } })
    await tx.intervencion.deleteMany({ where: { id: ids.intervention } })
    await tx.ordenEstadoHistorial.deleteMany({ where: { id: ids.orderState } })
    await tx.ordenTrabajo.deleteMany({ where: { id: ids.order } })
    await tx.novedad.deleteMany({ where: { id: ids.novelty } })
    await tx.lecturaKilometraje.deleteMany({
      where: { id: { in: [ids.driverReading, ids.noveltyReading, ids.journeyFinalReading] } },
    })
    await tx.programacionMantenimiento.deleteMany({ where: { id: ids.schedule } })
    await tx.asignacionConductor.deleteMany({ where: { id: ids.assignment } })
    await tx.jornadaOperativa.deleteMany({ where: { id: ids.journey } })
    await tx.busEstadoHistorial.deleteMany({ where: { busId: ids.bus } })
    await tx.repuesto.deleteMany({ where: { id: ids.part } })
    await tx.bus.deleteMany({ where: { id: { in: [ids.bus, ids.foreignBus] } } })
    await tx.ruta.deleteMany({ where: { id: ids.route } })
    await tx.modeloBus.deleteMany({ where: { id: ids.model } })
    await tx.usuario.deleteMany({ where: { id: users.driver } })
    await tx.eventoAuditoria.deleteMany({ where: { recursoId: { in: Object.values(ids) } } })
    await tx.solicitudIdempotente.deleteMany({ where: { recursoId: { in: Object.values(ids) } } })
  })
}

async function snapshot() {
  const [order, part, movement, recipients] = await Promise.all([
    prisma.ordenTrabajo.findUniqueOrThrow({
      select: { costoTotal: true, disponibilidadAlCierre: true, estado: true, id: true },
      where: { id: ids.order },
    }),
    prisma.repuesto.findUniqueOrThrow({ select: { stockActual: true }, where: { id: ids.part } }),
    prisma.movimientoInventario.findUniqueOrThrow({
      select: { id: true, cantidad: true, tipo: true },
      where: { id: ids.movement },
    }),
    prisma.alertaDestinatario.findMany({
      orderBy: { id: 'asc' },
      select: { estado: true, fechaAtencion: true, fechaLectura: true, id: true },
      where: {
        id: {
          in: [ids.alertAdminRecipient, ids.alertDispatcherRecipient, ids.alertDriverRecipient],
        },
      },
    }),
  ])
  return {
    movement: { ...movement, cantidad: movement.cantidad.toString() },
    order: { ...order, costoTotal: order.costoTotal.toString() },
    part: { stockActual: part.stockActual.toString() },
    recipients,
  }
}

test.beforeAll(async () => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E local')
  }
  await createFixture()
})

test.afterAll(async () => {
  try {
    await cleanupFixture()
  } finally {
    await prisma.$disconnect()
  }
})

test('P10 reconstruye historial, respeta privacidad por rol y mantiene GET sin efectos', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const beforeReads = await snapshot()

  await login(page, 'administrador.demo@sgmv.local')
  await page.goto('/historial')
  await expect(page.getByRole('heading', { name: /Historial e informes/i })).toBeVisible()
  await page.getByLabel('Buscar bus').fill(marker)
  await page.getByRole('button', { name: /Aplicar filtros/i }).click()
  await expect(page.getByText(busCode, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Ver detalle/i }).click()
  await expect(
    page.getByTestId('history-detail').getByText(orderCode, { exact: true }),
  ).toBeVisible()

  const adminDetail = await getApi(
    page,
    `/historial/buses/${ids.bus}?fechaDesde=2026-09-02&fechaHasta=2026-09-02`,
  )
  expect(adminDetail.status).toBe(200)
  const adminHistory = adminDetail.body.data!
  expect(adminHistory.bus.id).toBe(ids.bus)
  expect(adminHistory.novedades.some((item: { id: string }) => item.id === ids.novelty)).toBe(true)
  expect(adminHistory.jornadas.some((item: { id: string }) => item.id === ids.journey)).toBe(true)
  expect(adminHistory.alertas.map((item: { id: string }) => item.id)).toEqual(
    expect.arrayContaining([ids.alertAdmin, ids.alertDriver]),
  )
  const adminOrder = adminHistory.ordenes.find((item: { id: string }) => item.id === ids.order)
  expect(adminOrder).toBeDefined()
  expect(adminOrder).toMatchObject({
    costoTotal: '185000.00',
    disponibilidadAlCierre: true,
    jornada: { id: ids.journey },
  })
  expect(adminOrder!.diagnosticos?.[0]?.diagnostico).toContain(marker)
  expect(adminOrder!.repuestos?.[0]).toMatchObject({
    codigo: partCode,
    subtotal: '185000.00',
    compatibilidad: { reglaId: ids.compatibility, resultado: 'COMPATIBLE', reglaVersion: 1 },
    movimiento: { id: ids.movement, tipo: 'CONSUMO' },
  })

  const [adminSummary, costs] = await Promise.all([
    getApi(page, `/historial/resumen?busId=${ids.bus}`),
    getApi(page, `/historial/informes/costos?busId=${ids.bus}`),
  ])
  expect(adminSummary.status).toBe(200)
  expect(adminSummary.body.data!.costoTotal).toBe('185000.00')
  expect(costs.status).toBe(200)
  expect(costs.body.data!.costoTotal).toBe('185000.00')
  expect(costs.body.data!.registros[0]).toMatchObject({ busId: ids.bus, costoTotal: '185000.00' })

  await page.getByLabel('Fecha desde').fill('2026-09-02')
  await page.getByLabel('Fecha hasta').fill('2026-09-02')
  await page.getByRole('button', { name: /Aplicar filtros/i }).click()
  await expect(page.getByText(busCode, { exact: true })).toBeVisible()

  const afterAdminReads = await snapshot()
  expect(afterAdminReads).toEqual(beforeReads)

  await login(page, 'despachador.demo@sgmv.local')
  await page.goto('/historial')
  await expect(page.getByRole('heading', { name: /Historial e informes/i })).toBeVisible()
  await page.getByLabel('Buscar bus').fill(marker)
  await page.getByRole('button', { name: /Aplicar filtros/i }).click()
  await expect(page.getByText(busCode, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Ver detalle/i }).click()
  const dispatcherDetail = await getApi(page, `/historial/buses/${ids.bus}`)
  expect(dispatcherDetail.status).toBe(200)
  const dispatcherSerialized = JSON.stringify(dispatcherDetail.body)
  expect(dispatcherSerialized).not.toContain('costoTotal')
  expect(dispatcherSerialized).not.toContain('costoUnitario')
  expect(dispatcherSerialized).not.toContain('subtotal')
  expect(dispatcherSerialized).not.toContain(`Diagnóstico técnico ${marker}`)
  expect(dispatcherSerialized).not.toContain(`Actividad técnica ${marker}`)
  expect(dispatcherDetail.body.data!.jornadas[0].id).toBe(ids.journey)
  expect(dispatcherDetail.body.data!.ordenes[0].disponibilidadAlCierre).toBe(true)
  expect((await getApi(page, `/historial/informes/costos?busId=${ids.bus}`)).status).toBe(403)

  await login(page, 'mecanico.demo@sgmv.local')
  await page.goto('/historial')
  await expect(page.getByRole('heading', { name: /Historial e informes/i })).toBeVisible()
  await page.getByLabel('Buscar bus').fill(marker)
  await page.getByRole('button', { name: /Aplicar filtros/i }).click()
  await expect(page.getByText(busCode, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Ver detalle/i }).click()
  const mechanicDetail = await getApi(page, `/historial/buses/${ids.bus}`)
  expect(mechanicDetail.status).toBe(200)
  const mechanicSerialized = JSON.stringify(mechanicDetail.body)
  expect(mechanicSerialized).toContain(`Diagnóstico técnico ${marker}`)
  expect(mechanicSerialized).toContain(partCode)
  expect(mechanicSerialized).not.toContain('185000.00')
  expect(mechanicSerialized).not.toContain('costoTotal')
  expect((await getApi(page, `/historial/buses/${ids.foreignBus}`)).status).toBe(403)
  expect((await getApi(page, `/historial/informes/costos`)).status).toBe(403)

  await login(page, driverEmail)
  await page.goto('/historial')
  await expect(page.getByText(/Historial de mi bus asignado/i)).toBeVisible()
  const driverResult = await getApi(page, `/historial/mi-bus?busId=${ids.foreignBus}`)
  expect(driverResult.status).toBe(200)
  expect(driverResult.body.data!.historial.bus.id).toBe(ids.bus)
  expect(driverResult.body.data!.historial.novedades).toHaveLength(1)
  expect(driverResult.body.data!.historial.novedades[0].id).toBe(ids.novelty)
  expect(driverResult.body.data!.historial.alertas).toEqual([
    expect.objectContaining({ id: ids.alertDriver, estado: 'NO_LEIDA' }),
  ])
  const driverSerialized = JSON.stringify(driverResult.body)
  expect(driverSerialized).not.toContain('185000.00')
  expect(driverSerialized).not.toContain('costoTotal')
  expect(driverSerialized).not.toContain(`Diagnóstico técnico ${marker}`)
  expect((await getApi(page, `/historial/buses/${ids.bus}`)).status).toBe(403)
  expect((await getApi(page, `/historial/buses/${ids.foreignBus}`)).status).toBe(403)
  expect((await getApi(page, `/historial/informes/costos`)).status).toBe(403)

  expect(await snapshot()).toEqual(beforeReads)
  expect(
    consoleErrors.filter(
      (message) => !message.includes('401 (Unauthorized)') && !message.includes('403 (Forbidden)'),
    ),
  ).toEqual([])
  await testInfo.attach('p10-historial-roles', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
})
