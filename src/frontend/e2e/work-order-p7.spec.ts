import { randomUUID } from 'node:crypto'

import { expect, test, type Locator, type Page } from '@playwright/test'

import { prisma } from '../../backend/src/prisma/client.js'

const demoPassword = process.env.SEED_USER_PASSWORD
const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
const marker = `E2E P7 ${suffix}`
const busId = randomUUID()
let orderId: string | null = null
let orderCode: string | null = null

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(demoPassword!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible({ timeout: 20_000 })
}

async function openOrder(page: Page, search: string) {
  await page.goto('/ordenes-trabajo')
  await page.getByPlaceholder(/Buscar por codigo, bus, placa o descripcion/i).fill(search)
  const row = page.getByRole('row').filter({ hasText: search })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Detalle' }).click()
  await expect(page.getByRole('dialog', { name: 'Detalle de orden' })).toBeVisible()
}

function technicalReadingPanel(page: Page): Locator {
  return page.getByRole('heading', { name: 'Kilometraje tecnico' }).locator('..')
}

async function registerReading(page: Page, input: { date: Date; mileage: string; type: string }) {
  const panel = technicalReadingPanel(page)
  await panel.getByLabel('Tipo').selectOption(input.type)
  await panel.getByLabel('Fecha del evento').fill(toLocalInput(input.date))
  await panel.getByLabel('Kilometraje').fill(input.mileage)
  await panel.getByRole('button', { name: 'Registrar lectura' }).click()
  await expect(page.getByText('Lectura tecnica registrada.')).toBeVisible()
}

test.beforeAll(async () => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E local')
  }
  await prisma.bus.create({
    data: {
      anio: 2026,
      codigoInterno: `P7E2E-${suffix}`,
      estadoOperativo: 'OPERATIVO',
      id: busId,
      kilometrajeActual: 30_000,
      marca: 'Marca E2E P7',
      modelo: 'Modelo E2E P7',
      placa: `P7${suffix.slice(0, 6)}`,
    },
  })
})

test.afterAll(async () => {
  const orders = await prisma.ordenTrabajo.findMany({ where: { busId }, select: { id: true } })
  const orderIds = orders.map((order) => order.id)
  const alerts = await prisma.alertaInterna.findMany({
    where: { OR: [{ busId }, { ordenTrabajoId: { in: orderIds } }] },
    select: { id: true },
  })
  const resourceIds = [busId, ...orderIds]

  await prisma.$transaction(async (tx) => {
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: alerts.map((alert) => alert.id) } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((alert) => alert.id) } } })
    await tx.movimientoInventario.deleteMany({
      where: { consumoRepuesto: { ordenTrabajoId: { in: orderIds } } },
    })
    await tx.consumoRepuesto.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.actividadOrden.deleteMany({
      where: { intervencion: { ordenTrabajoId: { in: orderIds } } },
    })
    await tx.lecturaKilometraje.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.intervencion.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenReasignacion.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenEstadoHistorial.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenTrabajo.deleteMany({ where: { id: { in: orderIds } } })
    await tx.eventoAuditoria.deleteMany({ where: { recursoId: { in: resourceIds } } })
    await tx.solicitudIdempotente.deleteMany({ where: { recursoId: { in: resourceIds } } })
    await tx.bus.deleteMany({ where: { id: busId } })
  })
  await prisma.$disconnect()
})

test('P7 conserva trazabilidad tecnica y proyecta disponibilidad segura al despacho', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await login(page, 'administrador.demo@sgmv.local')
  await page.goto('/ordenes-trabajo')
  await page.getByRole('button', { name: 'Crear orden' }).click()
  const createDialog = page.getByRole('dialog', { name: 'Crear orden manual' })
  await createDialog.getByLabel('Bus').selectOption(busId)
  await createDialog.getByLabel('Prioridad').selectOption('ALTA')
  await createDialog.getByLabel('Descripcion').fill(`${marker} orden correctiva directa.`)
  await createDialog.getByRole('button', { name: 'Crear orden' }).click()
  await expect(page.getByText('Orden de trabajo creada.')).toBeVisible()

  const createdOrder = await prisma.ordenTrabajo.findFirstOrThrow({ where: { busId } })
  orderId = createdOrder.id
  orderCode = createdOrder.codigo
  expect(createdOrder.origen).toBe('CORRECTIVO_DIRECTO')
  expect(createdOrder.novedadId).toBeNull()
  expect(createdOrder.programacionMantenimientoId).toBeNull()
  const detailDialog = page.getByRole('dialog', { name: 'Detalle de orden' })
  await expect(detailDialog.getByText('Correctiva directa', { exact: true })).toBeVisible()

  await detailDialog.getByRole('button', { name: 'Asignar' }).click()
  const assignDialog = page.getByRole('dialog', { name: 'Asignar mecanico' })
  await assignDialog.getByLabel('Mecanico').selectOption('20000000-0000-4000-8000-000000000002')
  await assignDialog.getByRole('button', { name: 'Asignar' }).click()
  await expect(page.getByText('Orden asignada.')).toBeVisible()

  await login(page, 'mecanico.demo@sgmv.local')
  await openOrder(page, marker)
  const baseTime = Date.now() - 30_000
  await registerReading(page, {
    date: new Date(baseTime),
    mileage: '30000',
    type: 'INGRESO_TALLER',
  })
  await page.getByRole('button', { name: 'Iniciar' }).click()
  await expect(page.getByText('Ejecucion iniciada.')).toBeVisible()

  await page.getByLabel('Diagnostico').fill(`Diagnostico tecnico ${marker}`)
  await page.getByLabel('Observaciones tecnicas').fill('Intervencion activa verificada.')
  await page.getByRole('button', { name: 'Guardar tecnica' }).click()
  await expect(page.getByText('Intervencion actualizada.')).toBeVisible()
  await page.getByLabel('Actividad realizada').fill(`Actividad controlada ${marker}`)
  await page.getByRole('button', { name: 'Registrar actividad' }).click()
  await expect(page.getByText('Actividad registrada.')).toBeVisible()

  await registerReading(page, {
    date: new Date(baseTime + 10_000),
    mileage: '30001',
    type: 'REVISION_TECNICA',
  })

  await page.getByRole('button', { name: 'Completar' }).click()
  await page
    .getByRole('dialog', { name: 'Completar orden' })
    .getByRole('button', { name: 'Confirmar completado' })
    .click()
  await expect(page.getByText('Orden completada tecnicamente.')).toBeVisible()

  await login(page, 'administrador.demo@sgmv.local')
  await openOrder(page, marker)
  await registerReading(page, {
    date: new Date(),
    mileage: '30002',
    type: 'CIERRE_MANTENIMIENTO',
  })
  await page
    .getByRole('dialog', { name: 'Detalle de orden' })
    .getByRole('button', { name: 'Cerrar', exact: true })
    .click()
  const closeDialog = page.getByRole('dialog', { name: 'Cerrar orden' })
  await closeDialog.getByLabel(/Confirmo que la orden/i).check()
  await closeDialog.getByLabel('Observacion de cierre').fill(`Cierre administrativo ${marker}`)
  await closeDialog.getByRole('button', { name: 'Cerrar orden' }).click()
  await expect(page.getByText('Orden cerrada.')).toBeVisible()
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible()

  const persisted = await prisma.ordenTrabajo.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      estadosHistorial: true,
      intervenciones: { include: { actividades: true } },
      lecturasKilometraje: true,
    },
  })
  expect(persisted.estado).toBe('CERRADA')
  expect(persisted.disponibilidadAlCierre).toBe(true)
  expect(persisted.intervenciones).toHaveLength(1)
  expect(persisted.intervenciones[0]?.actividades).toHaveLength(1)
  expect(persisted.lecturasKilometraje.map((reading) => reading.tipo)).toEqual([
    'INGRESO_TALLER',
    'REVISION_TECNICA',
    'CIERRE_MANTENIMIENTO',
  ])

  await login(page, 'despachador.demo@sgmv.local')
  await page.goto('/ordenes-trabajo/despacho')
  const projection = page.locator('article').filter({ hasText: orderCode! })
  await expect(projection).toBeVisible()
  await expect(projection.getByText('Disponible', { exact: true })).toBeVisible()
  await expect(projection.getByText(/Snapshot: disponible/i)).toBeVisible()
  await expect(page.getByText(`Diagnostico tecnico ${marker}`)).toHaveCount(0)
  await expect(page.getByText(`Actividad controlada ${marker}`)).toHaveCount(0)

  await testInfo.attach('p7-disponibilidad-despacho', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  expect(
    consoleErrors.filter(
      (message) => !message.includes('server responded with a status of 401 (Unauthorized)'),
    ),
  ).toEqual([])
})
