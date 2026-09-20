import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

async function login(page: import('@playwright/test').Page, role = 'despachador') {
  const password = process.env.SEED_USER_PASSWORD
  if (!password) throw new Error('SEED_USER_PASSWORD local es obligatoria')

  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(`${role}.demo@sgmv.local`)
  await page.getByLabel(/Contrase/).fill(password)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.locator('#contenido-principal')).toBeVisible()
}

test('SOL sidebar conserva navegación accesible en desktop, tablet y móvil', async ({ page }) => {
  test.setTimeout(90_000)
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('response', (response) => {
    const url = new URL(response.url())
    const isExpectedAnonymousProbe = response.status() === 401 && url.pathname === '/auth/me'
    if (response.status() >= 400 && url.port === '4000' && !isExpectedAnonymousProbe) {
      failures.push(`${response.status()} ${url.pathname}`)
    }
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)

  const desktopSidebar = page.locator('aside').first()
  await expect(desktopSidebar).toBeVisible()
  await expect(desktopSidebar).toHaveCSS('width', '248px')
  await page.getByRole('button', { name: /Colapsar men/ }).click()
  await expect(desktopSidebar).toHaveCSS('width', '72px')
  await expect(page.getByRole('link', { name: 'Jornadas operativas', exact: true })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('sgmv:sidebar-expanded')))
    .toBe('false')

  await page.reload()
  await expect(desktopSidebar).toHaveCSS('width', '72px')

  await page.setViewportSize({ width: 768, height: 900 })
  await expect(desktopSidebar).toHaveCSS('width', '72px')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(desktopSidebar).toBeHidden()
  await page.getByRole('button', { name: /Abrir men/ }).focus()
  await page.keyboard.press('Enter')
  const mobileMenu = page.getByRole('dialog', { name: /Men. principal SGMV/ })
  await expect(mobileMenu).toBeVisible()
  await mobileMenu.getByRole('link', { name: 'Jornadas operativas' }).click()
  await expect(page).toHaveURL(/\/jornadas$/)
  await expect(mobileMenu).toBeHidden()
  await expect(
    page.locator('#contenido-principal h2').filter({ hasText: 'Jornadas operativas' }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')

  const overflow = await page.evaluate(() => {
    const pageDocument = (
      globalThis as unknown as {
        document: { documentElement: { clientWidth: number; scrollWidth: number } }
      }
    ).document
    return pageDocument.documentElement.scrollWidth - pageDocument.documentElement.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(1)
  expect(failures).toEqual([])

  const evidenceDir = process.env.SOL_UX_EVIDENCE_DIR
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true })
    await page.screenshot({
      fullPage: true,
      path: join(evidenceDir, 'despachador-jornadas-390.png'),
    })
  }
})
