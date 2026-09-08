import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { prisma } from '../../backend/src/prisma/client.js'

const demoPassword = process.env.SEED_USER_PASSWORD
const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
const marker = `P8E2E-${suffix}`
const partCode = `REP-${marker}`
const testBusId = randomUUID()
const testOrderId = randomUUID()
const testInterventionId = randomUUID()
let partId: string | null = null
const orderCode = `OT-${marker}`
const adminId = '20000000-0000-4000-8000-000000000001'
const mechanicId = '20000000-0000-4000-8000-000000000002'

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase/).fill(demoPassword!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: /Cerrar/ })).toBeVisible({ timeout: 30_000 })
}

async function openOrder(page: Page) {
  await page.goto('/ordenes-trabajo')
  await page.getByPlaceholder(/Buscar por codigo, bus, placa o descripcion/i).fill(orderCode)
  const row = page.getByRole('row').filter({ hasText: orderCode })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Detalle' }).click()
  await expect(page.getByRole('dialog', { name: 'Detalle de orden' })).toBeVisible()
}

test.beforeAll(async () => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E local')
  }
  const createdAt = new Date(Date.now() - 30_000)
  await prisma.$transaction(async (tx) => {
    await tx.bus.create({
      data: {
        anio: 2026,
        codigoInterno: `000-P8-BUS-${suffix}`,
        estadoOperativo: 'OPERATIVO',
        id: testBusId,
        kilometrajeActual: 30_000,
        marca: 'Marca E2E P8',
        modelo: 'Modelo E2E P8',
        placa: `P8${suffix.slice(0, 6)}`,
      },
    })
    await tx.ordenTrabajo.create({
      data: {
        busId: testBusId,
        codigo: orderCode,
        creadaPorId: adminId,
        descripcion: `Orden de consumo ${marker}`,
        estado: 'EN_EJECUCION',
        fechaAsignacion: new Date(createdAt.getTime() + 1_000),
        fechaCreacion: createdAt,
        fechaInicioEjecucion: new Date(createdAt.getTime() + 2_000),
        id: testOrderId,
        origen: 'CORRECTIVO_DIRECTO',
        prioridad: 'MEDIA',
        tecnicoAsignadoId: mechanicId,
        tipo: 'CORRECTIVA',
      },
    })
    await tx.intervencion.create({
      data: {
        fechaInicio: new Date(createdAt.getTime() + 2_000),
        id: testInterventionId,
        ordenTrabajoId: testOrderId,
        tecnicoId: mechanicId,
      },
    })
  })
})

test.afterAll(async () => {
  const persistedPart = await prisma.repuesto.findUnique({
    select: { id: true },
    where: { codigo: partCode },
  })
  const cleanupPartId = partId ?? persistedPart?.id ?? null

  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      where: { ordenTrabajoId: testOrderId },
      select: { id: true },
    })
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: alerts.map((alert) => alert.id) } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((alert) => alert.id) } } })
    if (cleanupPartId) {
      await tx.movimientoInventario.deleteMany({ where: { repuestoId: cleanupPartId } })
      await tx.consumoRepuesto.deleteMany({ where: { repuestoId: cleanupPartId } })
      await tx.autorizacionExcepcionConsumo.deleteMany({ where: { repuestoId: cleanupPartId } })
      await tx.compatibilidadRepuesto.deleteMany({ where: { repuestoId: cleanupPartId } })
    }
    await tx.actividadOrden.deleteMany({ where: { intervencionId: testInterventionId } })
    await tx.lecturaKilometraje.deleteMany({ where: { ordenTrabajoId: testOrderId } })
    await tx.intervencion.deleteMany({ where: { id: testInterventionId } })
    await tx.ordenEstadoHistorial.deleteMany({ where: { ordenTrabajoId: testOrderId } })
    await tx.eventoAuditoria.deleteMany({
      where: {
        recursoId: { in: [testBusId, testOrderId, ...(cleanupPartId ? [cleanupPartId] : [])] },
      },
    })
    await tx.solicitudIdempotente.deleteMany({
      where: {
        recursoId: { in: [testBusId, testOrderId, ...(cleanupPartId ? [cleanupPartId] : [])] },
      },
    })
    await tx.ordenTrabajo.deleteMany({ where: { id: testOrderId } })
    if (cleanupPartId) await tx.repuesto.deleteMany({ where: { id: cleanupPartId } })
    await tx.bus.deleteMany({ where: { id: testBusId } })
  })
  await prisma.$disconnect()
})

test('administra reglas, rechaza incompatibilidad y registra consumo decimal trazable', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await login(page, 'administrador.demo@sgmv.local')
  await page.goto('/repuestos')
  await page.getByRole('button', { name: 'Nuevo repuesto' }).click()
  const form = page.getByRole('dialog', { name: 'Nuevo repuesto' })
  await form.getByLabel('Codigo').fill(partCode)
  await form.getByLabel('Nombre').fill(`Filtro P8 ${marker}`)
  await form.getByLabel('Categoria').fill('Motor')
  await form.getByLabel('Fabricante').fill('Fabricante P8')
  await form.getByLabel('Numero de parte').fill(`P8-${suffix}`)
  await form.getByLabel('Especificaciones (JSON)').fill('{"material":"reforzado","voltaje":"24V"}')
  await form.getByLabel('Dimensiones (JSON)').fill('{"largoMm":100,"anchoMm":40}')
  await form.getByLabel('Unidad de medida').fill('unidad')
  await form.getByLabel('Stock inicial').fill('2.50')
  await form.getByLabel('Stock minimo').fill('1')
  await form.getByLabel('Costo unitario').fill('125.75')
  await form.getByLabel('Motivo de stock inicial').fill('Existencia de prueba P8')
  await form.getByRole('button', { name: 'Crear repuesto' }).click()
  await expect(page.getByText('Repuesto creado.')).toBeVisible()
  const createdDetail = page.getByRole('dialog', { name: 'Detalle de repuesto' })
  await expect(createdDetail.getByText('Fabricante P8', { exact: true })).toBeVisible()
  const createdPart = await prisma.repuesto.findUniqueOrThrow({ where: { codigo: partCode } })
  partId = createdPart.id
  const order = await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: testOrderId } })

  async function createRule(detail: ReturnType<Page['getByRole']>, allowed: boolean) {
    await detail.getByRole('button', { name: 'Nueva regla o version' }).click()
    const submitRule = page.getByRole('button', { name: 'Crear nueva version' })
    const ruleForm = page.locator('form').filter({ has: submitRule })
    await ruleForm.locator('select').nth(0).selectOption(testBusId)
    await ruleForm.locator('select').nth(1).selectOption(String(allowed))
    await ruleForm
      .getByLabel('Condicion de uso')
      .fill(allowed ? 'Instalar con torque controlado.' : 'Bloqueado hasta validar montaje.')
    await ruleForm
      .getByLabel('Especificaciones validadas (JSON)')
      .fill(JSON.stringify({ fuente: 'E2E P8', marker, resultado: allowed }))
    const creationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/repuestos/${partId}/compatibilidades`),
      { timeout: 30_000 },
    )
    await submitRule.click()
    expect((await creationResponse).status()).toBe(201)
    await expect(page.getByText('Nueva version de compatibilidad creada.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(submitRule).toBeHidden()
  }

  await createRule(createdDetail, false)
  await expect(createdDetail.getByText(/No permitido.*v1/)).toBeVisible()
  await createdDetail.getByRole('button', { name: 'Cerrar' }).click()

  await login(page, 'mecanico.demo@sgmv.local')
  await openOrder(page)
  let orderDetail = page.getByRole('dialog', { name: 'Detalle de orden' })
  await orderDetail.getByLabel('Buscar repuesto').fill(partCode)
  let partOption = orderDetail.locator('option').filter({ hasText: partCode })
  await expect(partOption).toHaveCount(1)
  await expect(partOption).toHaveAttribute('disabled', '')

  const rejectedKey = randomUUID()
  const rejected = await page.evaluate(
    async ({ key, orderId, quantity, sparePartId }) => {
      const csrfResponse = await fetch('http://localhost:4000/auth/csrf', {
        credentials: 'include',
      })
      const csrfBody = (await csrfResponse.json()) as { data: { csrfToken: string } }
      const response = await fetch(`http://localhost:4000/ordenes-trabajo/${orderId}/consumos`, {
        body: JSON.stringify({
          cantidad: quantity,
          claveIdempotencia: key,
          repuestoId: sparePartId,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          'X-CSRF-Token': csrfBody.data.csrfToken,
        },
        method: 'POST',
      })
      return { body: await response.json(), status: response.status }
    },
    { key: rejectedKey, orderId: testOrderId, quantity: '1.25', sparePartId: partId },
  )
  expect(rejected.status).toBe(409)
  expect(consoleErrors.some((message) => message.includes('409 (Conflict)'))).toBe(true)
  consoleErrors.length = 0
  expect(await prisma.consumoRepuesto.count({ where: { repuestoId: partId } })).toBe(0)
  expect(await prisma.movimientoInventario.count({ where: { repuestoId: partId } })).toBe(1)
  expect(
    (await prisma.repuesto.findUniqueOrThrow({ where: { id: partId } })).stockActual.toFixed(2),
  ).toBe('2.50')
  const rejectionAlert = await prisma.alertaInterna.findUniqueOrThrow({
    where: { claveDeduplicacion: `consumo-incompatible:${rejectedKey}` },
  })
  expect(rejectionAlert.ordenTrabajoId).toBe(testOrderId)
  expect(rejectionAlert.contextoEvento).toMatchObject({ busId: testBusId, repuestoId: partId })

  await login(page, 'administrador.demo@sgmv.local')
  await page.goto('/repuestos')
  await page.locator('label').filter({ hasText: 'Buscar' }).first().locator('input').fill(partCode)
  const partRow = page
    .getByRole('row')
    .filter({ hasText: partCode })
    .filter({ has: page.getByRole('button', { name: 'Detalle' }) })
  await expect(partRow).toBeVisible()
  await partRow.getByRole('button', { name: 'Detalle' }).click()
  const ruleDetail = page.getByRole('dialog', { name: 'Detalle de repuesto' })
  await createRule(ruleDetail, true)
  await expect(ruleDetail.getByText(/Permitido.*v2/)).toBeVisible()
  await ruleDetail.getByRole('button', { name: 'Cerrar' }).click()

  await login(page, 'mecanico.demo@sgmv.local')
  await openOrder(page)
  orderDetail = page.getByRole('dialog', { name: 'Detalle de orden' })
  await orderDetail.getByLabel('Buscar repuesto').fill(partCode)
  partOption = orderDetail.locator('option').filter({ hasText: partCode })
  await expect(partOption).toHaveCount(1)
  await expect(partOption).not.toHaveAttribute('disabled')
  await orderDetail.getByLabel('Cantidad').fill('1.25')
  const consumeButton = orderDetail.getByRole('button', { name: 'Registrar consumo' })
  const consumptionForm = orderDetail.locator('form').filter({ hasText: 'Registrar consumo' })
  await consumptionForm.locator('select').selectOption(partId)
  await consumeButton.click()
  await expect(page.getByText('Consumo registrado.')).toBeVisible()
  await expect(orderDetail.getByText('1.25', { exact: true })).toBeVisible()

  const persisted = await prisma.consumoRepuesto.findFirstOrThrow({
    where: { repuestoId: partId, ordenTrabajoId: order.id },
    include: { movimientoInventario: true },
  })
  const stock = await prisma.repuesto.findUniqueOrThrow({ where: { id: partId } })
  expect(persisted.resultadoCompatibilidad).toBe('COMPATIBLE')
  expect(persisted.reglaVersion).toBe(2)
  expect(persisted.intervencionId).not.toBeNull()
  expect(persisted.consumidoPorId).toBe(mechanicId)
  expect(persisted.movimientoInventario?.consumoRepuestoId).toBe(persisted.id)
  expect(stock.stockActual.toFixed(2)).toBe('1.25')
  expect(persisted.costoUnitario.toFixed(2)).toBe('125.75')
  expect(persisted.subtotal.toFixed(2)).toBe('157.19')

  await testInfo.attach('p8-consumo-compatible', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  expect(consoleErrors.filter((message) => !message.includes('401 (Unauthorized)'))).toEqual([])
})
