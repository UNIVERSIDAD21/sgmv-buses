import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { hash } from 'bcryptjs'
import { prisma } from '../../backend/src/prisma/client.js'

const suffix = randomUUID().slice(0, 8).toUpperCase()
const email = `amb-e2e-${suffix.toLowerCase()}@test.sgmv.local`
const code = `SIM-E2E-${suffix}`
let busId: number, driverId: number, routeId: number

async function login(page: Page, account: string) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(account)
  await page.getByLabel('Contraseña').fill(process.env.SEED_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
}
function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

test.beforeAll(async () => {
  if (!process.env.SEED_USER_PASSWORD) throw new Error('Falta clave de seed local')
  const role = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'CONDUCTOR' } })
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'administrador.demo@sgmv.local' },
  })
  driverId = (
    await prisma.usuario.create({
      data: {
        nombre: `SIM-CONDUCTOR-${suffix}`,
        email,
        contrasenaHash: await hash(process.env.SEED_USER_PASSWORD, 10),
        rolId: role.id,
      },
    })
  ).id
  busId = (
    await prisma.bus.create({
      data: {
        codigoInterno: code,
        placa: `S${suffix.slice(0, 6)}`,
        anio: 2026,
        marca: 'SGMV-DEMO',
        modelo: 'URBANO-DUAL-A',
        kilometrajeActual: 48930,
      },
    })
  ).id
  routeId = (await prisma.ruta.findUniqueOrThrow({ where: { codigo: '53' } })).id
  const plan = await prisma.planMantenimientoPreventivo.create({
    data: {
      activo: true,
      version: 1,
      busId,
      creadoPorId: admin.id,
      claveTarea: `SIM.E2E.${suffix}`,
      componente: 'Motor demo',
      actividad: 'Servicio simulado',
      criterio: 'KILOMETRAJE',
      intervaloKm: 5000,
      anticipacionKm: 500,
      prioridad: 'MEDIA',
      bloqueaAlVencer: true,
    },
  })
  await prisma.programacionMantenimiento.create({
    data: {
      busId,
      creadaPorId: admin.id,
      tipo: plan.componente,
      actividad: plan.actividad,
      criterio: 'KILOMETRAJE',
      kilometrajeObjetivo: 49500,
      planMantenimientoPreventivoId: plan.id,
    },
  })
})

test.afterAll(async () => {
  if (!busId) return
  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      where: { OR: [{ jornadaOperativa: { busId } }, { programacionMantenimiento: { busId } }] },
      select: { id: true },
    })
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: alerts.map((a) => a.id) } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((a) => a.id) } } })
    await tx.lecturaKilometraje.deleteMany({ where: { busId } })
    await tx.jornadaOperativa.deleteMany({ where: { busId } })
    await tx.programacionMantenimiento.deleteMany({ where: { busId } })
    await tx.planMantenimientoPreventivo.deleteMany({ where: { busId } })
    await tx.busEstadoHistorial.deleteMany({ where: { busId } })
    await tx.bus.delete({ where: { id: busId } })
    await tx.usuario.delete({ where: { id: driverId } })
  })
  await prisma.$disconnect()
})

test('AMB programa desde UI, avisa al Conductor y concilia odómetro sin costos', async ({
  page,
}) => {
  test.setTimeout(120000)
  await login(page, 'despachador.demo@sgmv.local')
  await page.goto('/flota/catalogos')
  await expect(page.getByText('AMB · Longitud oficial:', { exact: false })).toHaveCount(11)
  await page.goto('/jornadas')
  await page.getByLabel('Bus de jornada', { exact: true }).selectOption(String(busId))
  await page.getByLabel('Conductor de jornada').selectOption(String(driverId))
  await page.getByLabel('Ruta de jornada').selectOption(String(routeId))
  await page
    .getByLabel('Inicio programado', { exact: true })
    .fill(localInput(new Date(Date.now() - 3600000)))
  await page
    .getByLabel('Fin programado', { exact: true })
    .fill(localInput(new Date(Date.now() + 3600000)))
  await page.getByLabel('Usar proyección simulada SGMV').check()
  await expect(page.getByText('Jornada proyectada:', { exact: false })).toContainText('290 km')
  await expect(
    page.getByText('La proyección simulada anticipa cercanía al objetivo.', { exact: false }),
  ).toBeVisible()
  const created = page.waitForResponse(
    (r) => new URL(r.url()).pathname.endsWith('/jornadas') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Programar jornada', exact: true }).click()
  const response = await created
  expect(response.status()).toBe(201)
  const payload = await response.json()
  expect(typeof payload.data.jornada.id).toBe('number')
  const journeyId = payload.data.jornada.id
  expect((await prisma.bus.findUniqueOrThrow({ where: { id: busId } })).kilometrajeActual).toBe(
    48930,
  )
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()

  await login(page, email)
  await page.goto('/alertas')
  await expect(
    page.getByText('Mantenimiento anticipado — proyección simulada', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('main')).not.toContainText(/costoTotal|costoUnitario|subtotal/)
  await page.goto('/jornadas')
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: new RegExp(code) }) })
    .first()
  await expect(card.getByText('290 km proyectados')).toBeVisible()
  await card.getByRole('button', { name: 'Iniciar jornada' }).click()
  await page.getByRole('dialog').getByLabel('Kilometraje', { exact: true }).fill('48930')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click()
  await expect(card.getByRole('button', { name: 'Finalizar jornada' })).toBeVisible()
  await card.getByRole('button', { name: 'Finalizar jornada' }).click()
  await page.getByRole('dialog').getByLabel('Kilometraje final').fill('49205')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Jornada finalizada con lectura final')).toBeVisible()
  // Driver's current view removes closed journeys; history remains accessible through its own API.
  const detail = await page.request.get(`${response.url()}/${journeyId}`)
  expect((await detail.json()).data.jornada.proyeccionDemo).toMatchObject({
    kmReal: 275,
    diferenciaKm: -15,
    conciliada: true,
  })
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, 'despachador.demo@sgmv.local')
  await page.goto('/jornadas')
  const closedCard = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: new RegExp(code) }) })
    .first()
  await expect(closedCard.getByText('Recorrido por odómetro:', { exact: false })).toContainText(
    '275 km',
  )
  const directory = join(tmpdir(), 'sgmv-astra-amb-ui')
  await mkdir(directory, { recursive: true })
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(closedCard).toBeVisible()
    await closedCard.scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(directory, `conciliacion-${width}.png`), fullPage: true })
  }
})
