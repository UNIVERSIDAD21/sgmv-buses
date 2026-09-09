import { expect, test, type Page } from '@playwright/test'

const smokePassword = process.env.SGMV_PROD_TEST_PASSWORD

const accounts = [
  {
    role: 'ADMINISTRADOR',
    email: 'administrador.demo@sgmv.local',
    allowedPath: '/repuestos',
  },
  {
    role: 'DESPACHADOR',
    email: 'despachador.demo@sgmv.local',
    allowedPath: '/flota',
    deniedPath: '/repuestos',
  },
  {
    role: 'MECANICO',
    email: 'mecanico.demo@sgmv.local',
    allowedPath: '/ordenes-trabajo',
    deniedPath: '/flota',
  },
  {
    role: 'CONDUCTOR',
    email: 'conductor.demo@sgmv.local',
    allowedPath: '/novedades',
    deniedPath: '/repuestos',
  },
] as const

async function login(page: Page, email: string) {
  if (!smokePassword) {
    throw new Error('SGMV_PROD_TEST_PASSWORD must be provided through the protected environment')
  }

  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contraseña/).fill(smokePassword)

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /Iniciar sesión/ }).click()
  const loginResponse = await loginResponsePromise

  expect(loginResponse.status()).toBe(200)
  await expect(page).toHaveURL(/\/inicio$/)

  return loginResponse.json() as Promise<{
    data: { user: { rol: { codigo: string } } }
  }>
}

test.describe('P13 production session and role smoke tests', () => {
  test.describe.configure({ mode: 'serial' })

  for (const account of accounts) {
    test(`${account.role} authenticates and remains inside its permissions`, async ({ page }) => {
      const loginBody = await login(page, account.email)
      expect(loginBody.data.user.rol.codigo).toBe(account.role)

      const sessionResponse = await page.request.get('/api/auth/me')
      expect(sessionResponse.status()).toBe(200)

      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find((cookie) => cookie.name === 'sgmv_session')
      const csrfCookie = cookies.find((cookie) => cookie.name === 'sgmv_csrf')

      expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: true })
      expect(csrfCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: true })

      await page.goto(account.allowedPath)
      await expect(page).toHaveURL(new RegExp(`${account.allowedPath.replace('/', '\\/')}$`))

      if ('deniedPath' in account) {
        await page.goto(account.deniedPath)
        await expect(page).toHaveURL(/\/inicio$/)
      }

      const logoutResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: /Cerrar sesión/ }).click()
      expect((await logoutResponsePromise).status()).toBe(200)
      await expect(page).toHaveURL(/\/login$/)
      expect((await page.request.get('/api/auth/me')).status()).toBe(401)
    })
  }
})
