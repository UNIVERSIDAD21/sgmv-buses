import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { evaluatePreventiveAlertsForBus } from '../../backend/src/alerts/alert.service.js'
import { prisma } from '../../backend/src/prisma/client.js'

const demoPassword = process.env.SEED_USER_PASSWORD
const marker = `E2E.P6.${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
const busId = randomUUID()
const busCode = `P6E2E-${marker.slice(-8)}`
let planId: string | null = null
let scheduleId: string | null = null
let orderId: string | null = null

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(demoPassword!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
}

test.beforeAll(async () => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E local')
  }
  await prisma.bus.create({
    data: {
      anio: 2026,
      codigoInterno: busCode,
      estadoOperativo: 'OPERATIVO',
      id: busId,
      kilometrajeActual: 10_000,
      marca: 'Marca E2E P6',
      modelo: 'Modelo E2E P6',
      placa: `E${marker.slice(-6)}`,
    },
  })
})

test.afterAll(async () => {
  const plans = await prisma.planMantenimientoPreventivo.findMany({
    where: { OR: [...(planId ? [{ id: planId }] : []), { claveTarea: marker }] },
    select: { id: true },
  })
  const schedules = await prisma.programacionMantenimiento.findMany({
    where: {
      OR: [
        ...(scheduleId ? [{ id: scheduleId }] : []),
        { busId },
        { planMantenimientoPreventivoId: { in: plans.map((plan) => plan.id) } },
      ],
    },
    select: { id: true },
  })
  const orders = await prisma.ordenTrabajo.findMany({
    where: {
      OR: [
        ...(orderId ? [{ id: orderId }] : []),
        { busId },
        { programacionMantenimientoId: { in: schedules.map((schedule) => schedule.id) } },
      ],
    },
    select: { id: true },
  })
  const alerts = await prisma.alertaInterna.findMany({
    where: { programacionMantenimientoId: { in: schedules.map((schedule) => schedule.id) } },
    select: { id: true },
  })
  const resourceIds = [
    busId,
    ...plans.map((plan) => plan.id),
    ...schedules.map((schedule) => schedule.id),
    ...orders.map((order) => order.id),
  ]

  await prisma.$transaction(async (tx) => {
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: alerts.map((alert) => alert.id) } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((alert) => alert.id) } } })
    await tx.ordenEstadoHistorial.deleteMany({
      where: { ordenTrabajoId: { in: orders.map((order) => order.id) } },
    })
    await tx.ordenTrabajo.deleteMany({ where: { id: { in: orders.map((order) => order.id) } } })
    await tx.programacionMantenimiento.deleteMany({
      where: { id: { in: schedules.map((schedule) => schedule.id) } },
    })
    await tx.lecturaKilometraje.deleteMany({ where: { busId } })
    await tx.planMantenimientoPreventivo.deleteMany({
      where: { id: { in: plans.map((plan) => plan.id) } },
    })
    await tx.eventoAuditoria.deleteMany({ where: { recursoId: { in: resourceIds } } })
    await tx.solicitudIdempotente.deleteMany({ where: { recursoId: { in: resourceIds } } })
    await tx.bus.deleteMany({ where: { id: busId } })
  })
  await prisma.$disconnect()
})

test('P6 aplica plan, deriva obligacion, restringe despacho y evita orden duplicada', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)

  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await login(page, 'administrador.demo@sgmv.local')
  await page.goto('/mantenimiento-preventivo')
  await page.getByRole('button', { name: 'Planes recurrentes' }).click()
  await page.getByRole('button', { name: 'Crear plan' }).click()
  const planDialog = page.getByRole('dialog')
  await planDialog.getByLabel('Clave de tarea').fill(marker)
  await planDialog.getByLabel('Componente').fill(`Componente ${marker}`)
  await planDialog.getByLabel('Actividad').fill(`Actividad preventiva reproducible para ${marker}.`)
  await planDialog.getByLabel('Criterio de plan').selectOption('KILOMETRAJE')
  await planDialog.getByLabel('Intervalo kilometraje').fill('100')
  await planDialog.getByLabel('Anticipacion kilometraje').fill('50')
  await planDialog.getByLabel('Bus destino').selectOption(busId)
  await planDialog.getByText('Bloquear operacion al vencer').click()
  await planDialog.getByRole('button', { name: 'Crear plan' }).click()
  await expect(page.getByText('Plan preventivo registrado.')).toBeVisible()

  planId = (
    await prisma.planMantenimientoPreventivo.findFirstOrThrow({
      where: { busId, claveTarea: marker },
    })
  ).id
  const row = page.getByRole('row').filter({ hasText: marker })
  await row.getByRole('button', { name: 'Aplicar' }).click()
  const applyDialog = page.getByRole('dialog', { name: 'Aplicar plan preventivo' })
  await expect(applyDialog.getByLabel('Bus para aplicar plan')).toHaveValue(busId)
  await applyDialog.getByRole('button', { name: 'Aplicar plan' }).click()
  await expect(page.getByText(/objetivos derivados correctamente/i)).toBeVisible()

  const schedule = await prisma.programacionMantenimiento.findFirstOrThrow({
    where: { activa: true, busId, planMantenimientoPreventivoId: planId },
  })
  scheduleId = schedule.id
  expect(schedule.kilometrajeObjetivo).toBe(10_100)

  // Avance reproducible de odometro del fixture; no depende de esperar tiempo real.
  await prisma.$transaction(async (tx) => {
    await tx.bus.update({ where: { id: busId }, data: { kilometrajeActual: 10_100 } })
    await tx.lecturaKilometraje.create({
      data: {
        busId,
        fechaLectura: new Date(),
        kilometrajeAnterior: 10_000,
        kilometrajeNuevo: 10_100,
        motivo: marker,
        registradoPorId: '20000000-0000-4000-8000-000000000001',
        tipo: 'AJUSTE_ADMINISTRATIVO',
      },
    })
    await evaluatePreventiveAlertsForBus(busId, tx)
  })

  await page.getByRole('button', { name: 'Programaciones' }).click()
  await page.getByPlaceholder(/Buscar por actividad/i).fill(marker)
  const scheduleRow = page.getByRole('row').filter({ hasText: marker })
  await expect(scheduleRow.getByText(`${marker} v1`)).toBeVisible()
  await expect(scheduleRow.getByText('Vencido')).toBeVisible()
  await scheduleRow.getByRole('button', { name: 'Detalle' }).click()
  await expect(page.getByText(`Plan de bus · ${marker} v1`)).toBeVisible()
  await page.getByRole('button', { name: 'Generar orden' }).click()
  await page
    .getByRole('dialog', { name: 'Generar orden preventiva' })
    .getByRole('button', {
      name: 'Crear orden',
    })
    .click()
  await expect(
    page.locator('div.border-emerald-200').filter({ hasText: /Orden preventiva .* generada/i }),
  ).toBeVisible()

  const order = await prisma.ordenTrabajo.findFirstOrThrow({
    where: { programacionMantenimientoId: scheduleId },
  })
  orderId = order.id
  expect(order.planAplicado).toMatchObject({
    claveTarea: marker,
    kilometrajeObjetivo: 10_100,
    planId,
    planVersion: 1,
  })

  const retry = await page.evaluate(
    async ({ currentScheduleId }) => {
      const csrfResponse = await fetch('http://localhost:4000/auth/csrf', {
        credentials: 'include',
      })
      const csrfBody = (await csrfResponse.json()) as { data: { csrfToken: string } }
      const key = crypto.randomUUID()
      const execute = async () => {
        const response = await fetch(
          `http://localhost:4000/mantenimiento-preventivo/programaciones/${currentScheduleId}/generar-orden`,
          {
            body: JSON.stringify({ prioridad: 'BAJA' }),
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': key,
              'X-CSRF-Token': csrfBody.data.csrfToken,
            },
            method: 'POST',
          },
        )
        return {
          body: await response.json(),
          replayed: response.headers.get('Idempotency-Replayed'),
        }
      }
      return { first: await execute(), key, second: await execute() }
    },
    { currentScheduleId: scheduleId },
  )
  const firstRetryBody = retry.first.body as { data: { yaExistia: boolean } }
  expect(firstRetryBody.data.yaExistia).toBe(true)
  expect(retry.second.body).toEqual(retry.first.body)
  expect(await prisma.solicitudIdempotente.count({ where: { clave: retry.key } })).toBe(1)
  expect(
    await prisma.ordenTrabajo.count({ where: { programacionMantenimientoId: scheduleId } }),
  ).toBe(1)

  await page.context().clearCookies()
  await login(page, 'despachador.demo@sgmv.local')
  await page.goto('/mantenimiento-preventivo')
  await expect(page.getByText(busCode)).toBeVisible()
  await expect(page.getByText('Bloquea despacho').first()).toBeVisible()
  await expect(page.getByText(`Componente ${marker}`)).toHaveCount(0)
  await expect(page.getByText(`Actividad preventiva reproducible para ${marker}.`)).toHaveCount(0)
  await testInfo.attach('p6-restriccion-despachador', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  expect(
    consoleErrors.filter(
      (message) => !message.includes('server responded with a status of 401 (Unauthorized)'),
    ),
  ).toEqual([])
})
