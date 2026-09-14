import { expect, test, type Page } from '@playwright/test'

import { ACADEMIC_DEMO_ACCOUNTS } from '../../backend/prisma/demo-accounts.js'

const smokePassword = process.env.SGMV_PROD_TEST_PASSWORD
const smokeBaseUrl =
  process.env.P13_PRODUCTION_URL ?? 'https://v0-bus-fleet-management-neon.vercel.app'
const smokeTarget = new URL(smokeBaseUrl)
const isLocalSmoke = ['127.0.0.1', '::1', 'localhost'].includes(smokeTarget.hostname)
const smokeApiBase = isLocalSmoke ? 'http://localhost:4000' : '/api'
const secureCookiesExpected = smokeTarget.protocol === 'https:'

function apiUrl(path: string) {
  return `${smokeApiBase}${path}`
}

const roleAccess = {
  ADMINISTRADOR: { allowedPath: '/usuarios' },
  CONDUCTOR: { allowedPath: '/novedades', deniedPath: '/usuarios' },
  DESPACHADOR: { allowedPath: '/jornadas', deniedPath: '/usuarios' },
  MECANICO: { allowedPath: '/ordenes-trabajo', deniedPath: '/usuarios' },
} as const

const accounts = ACADEMIC_DEMO_ACCOUNTS.map((account) => ({
  ...account,
  ...roleAccess[account.role],
}))

async function login(page: Page, email: string) {
  if (!smokePassword) {
    throw new Error('SGMV_PROD_TEST_PASSWORD must be provided through the protected environment')
  }

  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contraseña/).fill(smokePassword)

  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith('/auth/login') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /Ingresar/ }).click()
  const loginResponse = await loginResponsePromise

  expect(loginResponse.status()).toBe(200)
  await expect(page).toHaveURL(/\/inicio$/)

  return loginResponse.json() as Promise<{
    data: { user: { rol: { codigo: string } } }
  }>
}

function expectNoEconomicFields(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/"(?:costoTotal|costoUnitario|subtotal)"\s*:/)
}

async function getWithRetry(page: Page, path: string) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.request.get(path)
      if (response.status() < 500 || attempt === 3) return response
    } catch (error) {
      lastError = error
      if (attempt === 3) throw error
    }

    await page.waitForTimeout(attempt * 1000)
  }

  throw lastError
}

test.describe('P13 production session and role smoke tests', () => {
  test.describe.configure({ mode: 'serial' })

  for (const account of accounts) {
    test(`${account.role} ${account.email} authenticates and remains inside its permissions`, async ({
      page,
    }) => {
      const loginBody = await login(page, account.email)
      expect(loginBody.data.user.rol.codigo).toBe(account.role)

      const sessionResponse = await page.request.get(apiUrl('/auth/me'))
      expect(sessionResponse.status()).toBe(200)

      const missingCsrfResponse = await page.request.post(apiUrl('/auth/logout'))
      expect(missingCsrfResponse.status()).toBe(403)

      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find((cookie) => cookie.name === 'sgmv_session')
      const csrfCookie = cookies.find((cookie) => cookie.name === 'sgmv_csrf')

      expect(sessionCookie).toMatchObject({
        httpOnly: true,
        sameSite: 'Lax',
        secure: secureCookiesExpected,
      })
      expect(csrfCookie).toMatchObject({
        httpOnly: true,
        sameSite: 'Lax',
        secure: secureCookiesExpected,
      })

      await page.goto(account.allowedPath)
      await expect(page).toHaveURL(new RegExp(`${account.allowedPath.replace('/', '\\/')}$`))

      if (account.role === 'ADMINISTRADOR') {
        await expect(page.getByRole('heading', { name: /^Usuarios$/ })).toBeVisible()
        await expect(page.getByPlaceholder(/Buscar por nombre o correo/)).toBeVisible()
        await expect(page.getByRole('combobox', { name: /Filtrar por rol/ })).toBeVisible()
        await expect(page.getByRole('combobox', { name: /Filtrar por estado/ })).toBeVisible()
        await expect(page.getByRole('button', { name: /Nuevo usuario/ })).toBeVisible()
        const usersResponse = await getWithRetry(page, apiUrl('/usuarios?limite=100&pagina=1'))
        expect(usersResponse.status()).toBe(200)
        expect(JSON.stringify(await usersResponse.json())).not.toMatch(
          /Conductor Activacion E2E|\.e2e\.|PLAYWRIGHT|TEMP/i,
        )

        const response = await getWithRetry(page, apiUrl('/ordenes-trabajo?limite=10&pagina=1'))
        expect(response.status()).toBe(200)
        expect(JSON.stringify(await response.json())).toMatch(/"costoTotal"\s*:/)
      } else {
        expect((await page.request.get(apiUrl('/usuarios'))).status()).toBe(403)
      }

      if (account.role === 'MECANICO') {
        await expect(page.getByRole('columnheader', { name: /^Costo$/i })).toHaveCount(0)
        await expect(page.getByRole('option', { name: /^Costo$/i })).toHaveCount(0)
        const listResponse = await getWithRetry(
          page,
          apiUrl('/ordenes-trabajo/mis-ordenes?limite=10&pagina=1'),
        )
        expect(listResponse.status()).toBe(200)
        const listBody = await listResponse.json()
        expectNoEconomicFields(listBody)
        const firstOrderId = listBody.data?.ordenes?.[0]?.id as string | undefined
        if (firstOrderId) {
          const detailResponse = await getWithRetry(
            page,
            apiUrl(`/ordenes-trabajo/${firstOrderId}`),
          )
          expect(detailResponse.status()).toBe(200)
          expectNoEconomicFields(await detailResponse.json())
        }
      }

      if (account.role === 'DESPACHADOR') {
        const response = await getWithRetry(page, apiUrl('/ordenes-trabajo/despacho'))
        expect(response.status()).toBe(200)
        expectNoEconomicFields(await response.json())
      }

      if (account.role === 'CONDUCTOR') {
        expect((await page.request.get(apiUrl('/ordenes-trabajo'))).status()).toBe(403)
        expect((await page.request.get(apiUrl('/ordenes-trabajo/resumen'))).status()).toBe(403)
      }

      if ('deniedPath' in account) {
        await page.goto(account.deniedPath)
        await expect(page).toHaveURL(/\/acceso-denegado$/)
      }

      await page.goto('/mi-cuenta')
      await expect(page.getByRole('heading', { name: /^Mi cuenta$/ })).toBeVisible()

      const logoutResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith('/auth/logout') && response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: /Cerrar sesión/ }).click()
      expect((await logoutResponsePromise).status()).toBe(200)
      await expect(page).toHaveURL(/\/login$/)
      expect((await page.request.get(apiUrl('/auth/me'))).status()).toBe(401)
    })
  }
})
