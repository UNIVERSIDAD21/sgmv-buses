import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const routes = {
  administrador: [
    '/inicio',
    '/flota',
    '/flota/catalogos',
    '/flota/nuevo',
    '/jornadas',
    '/novedades',
    '/mantenimiento-preventivo',
    '/ordenes-trabajo',
    '/ordenes-trabajo/despacho',
    '/repuestos',
    '/historial',
    '/alertas',
  ],
  despachador: [
    '/inicio',
    '/flota',
    '/flota/catalogos',
    '/jornadas',
    '/novedades',
    '/mantenimiento-preventivo',
    '/ordenes-trabajo/despacho',
    '/historial',
    '/alertas',
  ],
  mecanico: ['/inicio', '/ordenes-trabajo', '/historial', '/alertas'],
  conductor: ['/inicio', '/jornadas', '/novedades', '/historial', '/alertas'],
} as const

for (const [role, paths] of Object.entries(routes)) {
  test(`ASTRA navegación y responsive completos de ${role}`, async ({ page }) => {
    test.setTimeout(180_000)
    const password = process.env.SEED_USER_PASSWORD
    if (!password) throw new Error('SEED_USER_PASSWORD local es obligatoria')
    const failures: string[] = []
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/api/')) {
        failures.push(`${response.status()} ${new URL(response.url()).pathname}`)
      }
    })
    await page.goto('/login')
    await page.getByLabel(/Correo/).fill(`${role}.demo@sgmv.local`)
    await page.getByLabel(/Contrase/).fill(password)
    await page.getByRole('button', { name: /Ingresar/ }).click()
    await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible()
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of paths) {
        await test.step(`${width}px ${path}`, async () => {
          await page.goto(path)
          await page.waitForLoadState('networkidle')
          await expect(page.locator('#contenido-principal')).toBeVisible()
          await expect(page).toHaveURL(new RegExp(`${path}$`))
          await expect(page.getByText(/Error al cargar|No fue posible cargar/i)).toHaveCount(0)
          const overflow = await page.evaluate(() => {
            const doc = (
              globalThis as unknown as {
                document: { documentElement: { scrollWidth: number; clientWidth: number } }
              }
            ).document
            return doc.documentElement.scrollWidth - doc.documentElement.clientWidth
          })
          expect(overflow, `Desbordamiento ${role} ${path} a ${width}px`).toBeLessThanOrEqual(1)
          expect(failures).toEqual([])
          if (width === 390 && path === '/historial') {
            const directory = join(tmpdir(), 'sgmv-astra-ui')
            await mkdir(directory, { recursive: true })
            await page.screenshot({
              path: join(directory, `${role}-historial-390.png`),
              fullPage: true,
            })
          }
        })
      }
    }
  })
}
