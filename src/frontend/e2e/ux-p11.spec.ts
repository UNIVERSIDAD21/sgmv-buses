import { expect, test, type Page } from '@playwright/test'

const demoPassword = process.env.SEED_USER_PASSWORD

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase/).fill(demoPassword!)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible({ timeout: 30_000 })
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const pageDocument = (
      globalThis as unknown as {
        document: {
          body: { clientWidth: number; scrollWidth: number }
          documentElement: { clientWidth: number; scrollWidth: number }
        }
      }
    ).document

    return {
      body: pageDocument.body.scrollWidth - pageDocument.body.clientWidth,
      html: pageDocument.documentElement.scrollWidth - pageDocument.documentElement.clientWidth,
    }
  })
  expect(overflow.body).toBeLessThanOrEqual(1)
  expect(overflow.html).toBeLessThanOrEqual(1)
}

test.beforeAll(() => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E P11')
  }
})

test('P11 teclado, lazy loading, foco y envío único', async ({ page }) => {
  let loginRequests = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/auth/login')) {
      loginRequests += 1
    }
  })

  await page.goto('/login')
  const initialResources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  )
  expect(initialResources.some((url) => url.includes('/features/flota/FleetPage.tsx'))).toBe(false)

  await page.keyboard.press('Tab')
  await expect(page.getByLabel(/Correo/)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText(/correo y contrase/i)
  await expect(page.getByLabel(/Correo/)).toBeFocused()

  await page.keyboard.type('administrador.demo@sgmv.local')
  await page.keyboard.press('Tab')
  await page.keyboard.type(demoPassword!)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible({ timeout: 30_000 })
  expect(loginRequests).toBe(1)
  await expect(page.locator('#contenido-principal')).toBeFocused()

  const skipLink = page.getByRole('link', { name: 'Saltar al contenido principal' })
  await skipLink.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#contenido-principal')).toBeFocused()

  const fleetLink = page.getByRole('link', { name: 'Flota' }).first()
  await fleetLink.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/flota$/)
  await expect(page.getByRole('heading', { name: 'Flota' })).toBeVisible()

  await expect
    .poll(async () =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.includes('/features/flota/FleetPage.tsx')),
      ),
    )
    .toBe(true)

  const detailButton = page.getByRole('button', { name: 'Detalle' }).first()
  await detailButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Detalle de bus' })).toBeFocused()

  const mileageButton = page.getByRole('button', { name: 'Kilometraje' })
  await mileageButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Registrar kilometraje' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Registrar kilometraje' })).toHaveCount(0)
  await expect(mileageButton).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Detalle de bus' })).toHaveCount(0)
  await expect(detailButton).toBeFocused()
})

test('P11 responsive y permisos en los tres tamaños objetivo', async ({ page }) => {
  await login(page, 'administrador.demo@sgmv.local')

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 768, width: 1024 },
    { height: 900, width: 1440 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/inicio')
    await expect(page.locator('#contenido-principal')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    if (viewport.width === 390) {
      const menuButton = page.getByRole('button', { name: 'Abrir menú' })
      await menuButton.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: 'Menú principal SGMV' })).toBeVisible()
      await expect(page.getByText('Menú principal SGMV')).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(menuButton).toBeFocused()
    } else {
      await expect(page.getByRole('navigation').first()).toBeVisible()
    }
  }

  await login(page, 'conductor.demo@sgmv.local')
  await page.goto('/repuestos')
  await expect(page.getByRole('alert')).toContainText('Acceso denegado')
  await expect(page.getByRole('link', { name: 'Repuestos' })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/costo unitario|diagnóstico técnico/i)
})
