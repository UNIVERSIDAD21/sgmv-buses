import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
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
    '/mi-cuenta',
    '/usuarios',
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
    '/mi-cuenta',
  ],
  mecanico: ['/inicio', '/ordenes-trabajo', '/historial', '/alertas', '/mi-cuenta'],
  conductor: ['/inicio', '/jornadas', '/novedades', '/historial', '/alertas', '/mi-cuenta'],
} as const

for (const [role, paths] of Object.entries(routes)) {
  test(`ASTRA navegación y responsive completos de ${role}`, async ({ page }) => {
    test.setTimeout(180_000)
    const password = process.env.SEED_USER_PASSWORD
    if (!password) throw new Error('SEED_USER_PASSWORD local es obligatoria')
    const failures: string[] = []
    const apiOrigin = new URL(process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000').origin
    const metrics: Array<{ path: string; width: number; overflow: number; apiRequests: number }> =
      []
    let apiRequests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).origin === apiOrigin) apiRequests++
    })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => {
      const url = new URL(response.url())
      const anonymousSessionProbe = response.status() === 401 && url.pathname === '/auth/me'
      if (response.status() >= 400 && url.origin === apiOrigin && !anonymousSessionProbe) {
        failures.push(`${response.status()} ${url.pathname}`)
      }
    })
    await page.goto('/login')
    await page.getByLabel(/Correo/).fill(`${role}.demo@sgmv.local`)
    await page.getByLabel(/Contrase/).fill(password)
    await page.getByRole('button', { name: /Ingresar/ }).click()
    await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible()
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of paths) {
        await test.step(`${width}px ${path}`, async () => {
          const initialRequests = apiRequests
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
          metrics.push({ path, width, overflow, apiRequests: apiRequests - initialRequests })
          const evidence = process.env.SGMV_EVIDENCE_DIR
          if (
            evidence &&
            [390, 1440].includes(width) &&
            [
              '/mantenimiento-preventivo',
              '/repuestos',
              '/novedades',
              '/historial',
              '/ordenes-trabajo',
            ].includes(path)
          ) {
            await mkdir(evidence, { recursive: true })
            await page.screenshot({
              path: join(evidence, `after-${role}-${path.slice(1)}-${width}.png`),
              fullPage: true,
            })
          }
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
    if (process.env.SGMV_EVIDENCE_DIR) {
      await writeFile(
        join(process.env.SGMV_EVIDENCE_DIR, `matrix-${role}.json`),
        JSON.stringify(
          {
            role,
            apiOrigin,
            excludedProbe: '401 /auth/me al iniciar sin sesión',
            failures,
            metrics,
          },
          null,
          2,
        ),
      )
    }
  })
}
