import { expect, test, type Page } from '@playwright/test'

const demoPassword = process.env.SEED_USER_PASSWORD
const users = {
  admin: 'administrador.demo@sgmv.local',
  dispatcher: 'despachador.demo@sgmv.local',
  mechanic: 'mecanico.demo@sgmv.local',
  driver: 'conductor.demo@sgmv.local',
} as const

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase/).fill(demoPassword!)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible({ timeout: 30_000 })
}

async function getApi(page: Page, path: string) {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(`http://localhost:4000${requestPath}`, {
      credentials: 'include',
    })
    return { body: await response.json(), status: response.status }
  }, path)
}

function expectNoSensitiveProjection(body: unknown) {
  const serialized = JSON.stringify(body).toLowerCase()
  expect(serialized).not.toContain('costounitario')
  expect(serialized).not.toContain('costototal')
  expect(serialized).not.toContain('diagnostico')
  expect(serialized).not.toContain('contrasenahash')
}

test.beforeAll(() => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E P12')
  }
})

test('P12 valida la proyeccion segura y los permisos de los cuatro roles', async ({ page }) => {
  await login(page, users.admin)
  const adminReport = await getApi(page, '/historial/informes/costos')
  expect(adminReport.status).toBe(200)

  await login(page, users.dispatcher)
  const dispatcherReport = await getApi(page, '/historial/informes/costos')
  expect(dispatcherReport.status).toBe(403)
  const dispatcherSummary = await getApi(page, '/historial/resumen')
  expect(dispatcherSummary.status).toBe(200)
  expectNoSensitiveProjection(dispatcherSummary.body)
  const dispatcherBuses = await getApi(page, '/historial/buses')
  expect(dispatcherBuses.status).toBe(200)
  expectNoSensitiveProjection(dispatcherBuses.body)

  await login(page, users.mechanic)
  const mechanicReport = await getApi(page, '/historial/informes/costos')
  expect(mechanicReport.status).toBe(403)
  const mechanicSummary = await getApi(page, '/historial/resumen')
  expect(mechanicSummary.status).toBe(200)
  expectNoSensitiveProjection(mechanicSummary.body)
  const mechanicBuses = await getApi(page, '/historial/buses')
  expect(mechanicBuses.status).toBe(200)
  expectNoSensitiveProjection(mechanicBuses.body)

  await login(page, users.driver)
  const driverReport = await getApi(page, '/historial/informes/costos')
  expect(driverReport.status).toBe(403)
  const driverHistory = await getApi(page, '/historial/mi-bus')
  expect(driverHistory.status).toBe(200)
  expectNoSensitiveProjection(driverHistory.body)
})
