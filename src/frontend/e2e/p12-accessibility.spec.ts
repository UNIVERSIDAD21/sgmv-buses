import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const demoPassword = process.env.SEED_USER_PASSWORD

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill('administrador.demo@sgmv.local')
  await page.getByLabel(/Contrase/).fill(demoPassword!)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible({ timeout: 30_000 })
}

test.beforeAll(() => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba axe de P12')
  }
})

test('P12 no introduce violaciones axe en login ni inicio', async ({ page }) => {
  await page.goto('/login')
  const loginResults = await new AxeBuilder({ page }).analyze()
  expect(loginResults.violations).toEqual([])

  await login(page)
  await page.goto('/inicio')
  const homeResults = await new AxeBuilder({ page }).analyze()
  expect(homeResults.violations).toEqual([])
})
