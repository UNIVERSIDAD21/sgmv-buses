/// <reference lib="dom" />
import { randomUUID } from 'node:crypto'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { prisma } from '../../backend/src/prisma/client.js'
import { evaluateJourneyMileageAlerts } from '../../backend/src/alerts/alert.service.js'

test.use({ trace: 'off', video: 'off' })
const marker = `UX-${randomUUID().slice(0, 8).toUpperCase()}`
const busIds: number[] = []
let modelId: number
let driverId: number
let journeyId: number
let planId: number
const driverEmail = `${marker.toLowerCase()}@test.sgmv.local`

async function login(page: Page, account: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page
    .getByLabel('Correo electrónico')
    .fill(account.includes('@') ? account : `${account}.demo@sgmv.local`)
  await page.getByLabel('Contraseña').fill('123456')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/inicio$/)
}

async function capture(page: Page, info: TestInfo, label: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await info.attach(`${label}-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

test.beforeAll(async () => {
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'administrador.demo@sgmv.local' },
  })
  const driver = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'conductor.demo@sgmv.local' },
  })
  const model = await prisma.modeloBus.create({
    data: { marca: marker, nombreModelo: marker, especificaciones: {} },
  })
  modelId = model.id
  driverId = (
    await prisma.usuario.create({
      data: {
        email: driverEmail,
        nombre: `Conductor ${marker}`,
        rolId: driver.rolId,
        estado: 'ACTIVO',
        contrasenaHash: driver.contrasenaHash,
      },
    })
  ).id
  for (let i = 0; i < 3; i++) {
    const bus = await prisma.bus.create({
      data: {
        codigoInterno: `${marker}-${i}`,
        placa: `${marker.slice(3)}${i}`,
        marca: marker,
        modelo: marker,
        modeloBusId: i < 2 ? modelId : null,
        anio: 2026,
        kilometrajeActual: 1000 + 1000 * i,
      },
    })
    busIds.push(bus.id)
  }
  planId = (
    await prisma.planMantenimientoPreventivo.create({
      data: {
        activo: true,
        version: 1,
        creadoPorId: admin.id,
        modeloBusId: modelId,
        claveTarea: marker,
        componente: 'Motor',
        actividad: `Cambiar aceite ${marker}`,
        criterio: 'KILOMETRAJE',
        intervaloKm: 5000,
        prioridad: 'MEDIA',
        bloqueaAlVencer: false,
      },
    })
  ).id
  const start = new Date(Date.now() - 28 * 3_600_000)
  journeyId = await prisma.$transaction(async (tx) => {
    const journey = await tx.jornadaOperativa.create({
      data: {
        busId: busIds[2]!,
        conductorId: driverId,
        programadaPorId: admin.id,
        iniciadaPorId: driverId,
        estado: 'EN_CURSO',
        inicioProgramado: start,
        inicioReal: start,
        finProgramado: new Date(Date.now() - 25 * 3_600_000),
      },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId: busIds[2]!,
        jornadaOperativaId: journey.id,
        registradoPorId: driverId,
        fechaLectura: start,
        kilometrajeAnterior: 3000,
        kilometrajeNuevo: 3000,
        tipo: 'INICIO_JORNADA',
      },
    })
    return journey.id
  })
  await prisma.$transaction((tx) => evaluateJourneyMileageAlerts(tx, new Date(), [journeyId]))
})

test.afterAll(async () => {
  // Only resources owned by this unique fixture are removed.
  const fixtureBuses = await prisma.bus.findMany({
    where: { OR: [{ id: { in: busIds } }, { placa: `${marker.slice(3)}NEW` }] },
    select: { id: true },
  })
  const ids = fixtureBuses.map((bus) => bus.id)
  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      where: {
        OR: [
          { busId: { in: ids } },
          { jornadaOperativa: { busId: { in: ids } } },
          { programacionMantenimiento: { busId: { in: ids } } },
        ],
      },
      select: { id: true },
    })
    await tx.alertaDestinatario.deleteMany({
      where: {
        OR: [
          { alertaInternaId: { in: alerts.map((alert) => alert.id) } },
          { usuario: { email: driverEmail } },
        ],
      },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((alert) => alert.id) } } })
    await tx.lecturaKilometraje.deleteMany({ where: { busId: { in: ids } } })
    await tx.jornadaOperativa.deleteMany({ where: { busId: { in: ids } } })
    await tx.programacionMantenimiento.deleteMany({ where: { busId: { in: ids } } })
    await tx.planMantenimientoPreventivo.deleteMany({ where: { claveTarea: marker } })
    await tx.busEstadoHistorial.deleteMany({ where: { busId: { in: ids } } })
    await tx.bus.deleteMany({ where: { id: { in: ids } } })
    await tx.modeloBus.deleteMany({ where: { nombreModelo: marker } })
    await tx.usuario.deleteMany({ where: { email: driverEmail } })
  })
  await prisma.$disconnect()
})

test('rutina por modelo: selecciona varios buses, revisa objetivos, evita duplicados y cubre un alta nueva', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  await login(page, 'administrador')
  await page.goto('/mantenimiento-preventivo')
  await page.getByRole('button', { name: 'Rutinas de mantenimiento' }).click()
  const row = page.getByRole('row').filter({ hasText: `Cambiar aceite ${marker}` })
  await row.getByRole('button', { name: 'Asignar a buses de este modelo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Asignar a buses de este modelo' })
  await dialog.getByRole('checkbox', { name: new RegExp(`${marker}-0`) }).check()
  await dialog.getByRole('checkbox', { name: new RegExp(`${marker}-1`) }).check()
  await dialog.getByRole('button', { name: 'Revisar programación' }).click()
  await expect(
    dialog.getByText('Se crearán 2 programaciones para 2 buses seleccionados'),
  ).toBeVisible()
  await expect(dialog.getByText(/Objetivo: 6.000 km/)).toBeVisible()
  await expect(dialog.getByText(/Objetivo: 7.000 km/)).toBeVisible()
  expect(
    await prisma.programacionMantenimiento.count({
      where: { planMantenimientoPreventivoId: planId },
    }),
  ).toBe(0)
  await capture(page, info, 'rutina-previsualizacion')
  await dialog.getByRole('button', { name: 'Confirmar programaciones' }).click()
  await expect(
    page.getByText('2 programaciones creadas. 0 existentes conservadas sin duplicar.'),
  ).toBeVisible()
  await row.getByRole('button', { name: 'Asignar a buses de este modelo' }).click()
  await dialog.getByRole('button', { name: 'Seleccionar todos' }).click()
  await dialog.getByRole('button', { name: 'Revisar programación' }).click()
  await expect(
    dialog.getByText('Se crearán 0 programaciones para 2 buses seleccionados'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar programaciones' }).click()
  expect(
    await prisma.programacionMantenimiento.count({
      where: { planMantenimientoPreventivoId: planId },
    }),
  ).toBe(2)

  await page.goto('/flota/nuevo')
  await page.getByLabel(/^Placa/i).fill(`${marker.slice(3)}NEW`)
  await page.getByLabel(/^Marca$/i).fill(marker)
  await page.getByLabel(/^Modelo$/i).fill(marker)
  await page.getByLabel('Configuración técnica del vehículo').selectOption(String(modelId))
  await page.getByLabel(/Kilometraje actual/i).fill('800')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText(/Bus registrado/i).first()).toBeVisible()
  const added = await prisma.bus.findUniqueOrThrow({ where: { placa: `${marker.slice(3)}NEW` } })
  busIds.push(added.id)
  expect(
    await prisma.programacionMantenimiento.findFirstOrThrow({
      where: { busId: added.id, activa: true },
    }),
  ).toMatchObject({ planMantenimientoPreventivoId: planId, kilometrajeObjetivo: 5800 })
})

test('cierre atrasado: Conductor informa, Despacho coordina lectura real y Administrador ve escalamiento interno', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  await login(page, driverEmail)
  await page.goto('/jornadas')
  await expect(page.getByText('Cierre atrasado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar cierre ahora' })).toBeVisible()
  await capture(page, info, 'conductor-cierre-atrasado')
  await page.getByRole('button', { name: 'Informar que no puedo registrar el cierre' }).click()
  const report = page.getByRole('dialog', { name: 'Informar cierre pendiente' })
  await expect(report.getByLabel(/odómetro/i)).toHaveCount(0)
  await report.getByLabel(/Motivo/i).fill(`Necesito ayuda para leer el odómetro ${marker}.`)
  await report.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/Informe enviado a la bandeja interna de Despacho/)).toBeVisible()
  expect(
    await prisma.jornadaOperativa.findUniqueOrThrow({ where: { id: journeyId } }),
  ).toMatchObject({ estado: 'EN_CURSO', finReal: null })
  expect(
    await prisma.lecturaKilometraje.count({
      where: { jornadaOperativaId: journeyId, tipo: 'FIN_JORNADA' },
    }),
  ).toBe(0)
  await login(page, 'administrador')
  await page.goto(`/jornadas?detalle=${journeyId}`)
  const focus = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Jornada vinculada a novedad' }) })
  await expect(focus.getByText(new RegExp(marker)).first()).toBeVisible()
  await page.goto('/alertas')
  await page
    .getByRole('combobox', { name: 'Tipo', exact: true })
    .selectOption('JORNADA_SIN_KILOMETRAJE_FINAL')
  await expect(
    page.getByText('Las alertas son internas; revísalas al iniciar sesión.'),
  ).toBeVisible()
  // The exact origin and recipient are additionally asserted in the persisted record.
  const escalation = await prisma.alertaInterna.findFirstOrThrow({
    where: {
      jornadaOperativaId: journeyId,
      claveDeduplicacion: { startsWith: 'jornada-cierre-escalado:' },
    },
    include: { destinatarios: true },
  })
  expect(escalation.destinatarios.length).toBeGreaterThan(0)
  await capture(page, info, 'alertas-internas')
  await login(page, 'despachador')
  await page.goto('/jornadas')
  const queue = page.getByRole('region', { name: 'Jornadas pendientes de cierre' })
  const card = queue.locator('article').filter({ hasText: `${marker}-2` })
  await expect(
    card.getByText(`Necesito ayuda para leer el odómetro ${marker}.`, { exact: false }),
  ).toBeVisible()
  await capture(page, info, 'despacho-cola-cierres')
  await card.getByRole('button', { name: 'Registrar cierre ahora' }).click()
  const finish = page.getByRole('dialog', { name: 'Finalizar jornada' })
  await expect(finish.getByLabel(/Lectura observada del odómetro/)).toBeEmpty()
  await finish.getByLabel(/Lectura observada del odómetro/).fill('3015')
  await finish.getByRole('button', { name: 'Confirmar' }).click()
  await expect(
    page.getByText('Jornada finalizada con lectura final', { exact: true }),
  ).toBeVisible()
  expect(
    await prisma.jornadaOperativa.findUniqueOrThrow({ where: { id: journeyId } }),
  ).toMatchObject({ estado: 'FINALIZADA' })
  expect(
    await prisma.lecturaKilometraje.count({
      where: { jornadaOperativaId: journeyId, tipo: 'FIN_JORNADA', kilometrajeNuevo: 3015 },
    }),
  ).toBe(1)
})
