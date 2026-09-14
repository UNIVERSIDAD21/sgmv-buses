import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const adminEmail = 'administrador.demo@sgmv.local'
const demoPassword = process.env.SEED_USER_PASSWORD
const newPassword = 'Cuenta-Activada-E2E-2026!'

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase/).fill(password)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible({ timeout: 30_000 })
}

test.beforeAll(() => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para E2E de usuarios')
  }
})

test('Administrador crea, usuario activa y Conductor queda fuera de administracion', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const email = `conductor.e2e.${Date.now()}@sgmv.local`
  const evidenceDir = join(tmpdir(), 'sgmv-usuarios-accesos')
  await mkdir(evidenceDir, { recursive: true })

  await login(page, adminEmail, demoPassword!)
  await page.goto('/usuarios')
  await expect(page.getByRole('heading', { name: /^Usuarios$/ })).toBeVisible()
  await page.screenshot({ path: join(evidenceDir, 'after-usuarios-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(evidenceDir, 'after-usuarios-mobile.png'), fullPage: true })
  const overflow = await page.evaluate(() => {
    const pageDocument = (
      globalThis as unknown as {
        document: { documentElement: { clientWidth: number; scrollWidth: number } }
      }
    ).document

    return pageDocument.documentElement.scrollWidth - pageDocument.documentElement.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.getByRole('button', { name: /Nuevo usuario/ }).click()
  const createDialog = page.getByRole('dialog', { name: /Nuevo usuario/ })
  await createDialog.getByLabel(/^Nombre$/).fill('Conductor Activacion E2E')
  await createDialog.getByLabel(/Correo de acceso/).fill(email)
  await createDialog.getByLabel(/Rol inicial/).selectOption('CONDUCTOR')
  const createdResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/usuarios') &&
      response.request().method() === 'POST' &&
      response.status() === 201,
  )
  await createDialog.getByRole('button', { name: /Crear cuenta/ }).click()
  const createdResponse = await createdResponsePromise
  const createdBody = (await createdResponse.json()) as {
    data: { activacion: { token: string }; usuario: { id: number } }
  }
  const activationToken = createdBody.data.activacion.token
  expect(activationToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  await expect(page.getByRole('dialog', { name: /Cuenta pendiente/ })).toBeVisible()
  await expect(page.getByText(activationToken)).toHaveCount(0)
  await page.getByRole('button', { name: /^Cerrar$/ }).click()

  await page.getByRole('button', { name: /Cerrar sesi/ }).click()
  await page.goto('/activar-cuenta')
  await page.getByLabel(/C.digo temporal/).fill(activationToken)
  await page.getByLabel(/^Nueva contrase.a$/).fill(newPassword)
  await page.getByLabel(/Confirmar contrase.a/).fill(newPassword)
  await page.getByRole('button', { name: /Establecer contrase.a y activar/ }).click()
  await expect(page.getByRole('heading', { name: /Cuenta activada/ })).toBeVisible()

  await login(page, email, newPassword)
  await expect(page.getByRole('link', { name: /Administraci.n de usuarios/ })).toHaveCount(0)
  const backendDenied = await page.evaluate(async () => {
    const response = await fetch('http://localhost:4000/usuarios', { credentials: 'include' })
    return response.status
  })
  expect(backendDenied).toBe(403)
  await page.goto('/usuarios')
  await expect(page.getByText(/Acceso denegado/)).toBeVisible()
  await expect(page).toHaveURL(/acceso-denegado$/)

  await login(page, adminEmail, demoPassword!)
  await page.goto('/usuarios')
  await page.getByPlaceholder(/Buscar por nombre o correo/).fill(email)
  const createdUserRow = page.getByRole('row').filter({ hasText: email })
  await expect(createdUserRow).toBeVisible()
  await createdUserRow.getByRole('button', { name: /Gestionar/ }).click()
  const manageDialog = page.getByRole('dialog', { name: /Gestionar usuario/ })
  const stateSelect = manageDialog.getByLabel(/^Estado$/)
  await stateSelect.selectOption('INACTIVO')
  const stateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/usuarios/${createdBody.data.usuario.id}/estado`) &&
      response.request().method() === 'PATCH' &&
      response.status() === 200,
  )
  await manageDialog.getByRole('button', { name: /Cambiar estado/ }).click()
  await stateResponsePromise
  await expect(stateSelect).toHaveValue('INACTIVO')
})
