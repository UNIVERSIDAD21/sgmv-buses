import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { prisma } from '../../backend/src/prisma/client.js'
import { assertSafeWriteE2eTarget } from './support/e2e-safety.js'

const adminEmail = 'administrador.demo@sgmv.local'
const demoPassword = process.env.SEED_USER_PASSWORD
const newPassword = 'Cuenta-Activada-E2E-2026!'
const fixtureName = 'Conductor Activacion E2E'
let fixtureEmail = ''

async function cleanupFixture() {
  if (!fixtureEmail) return
  if (!/^conductor\.e2e\.\d+@sgmv\.local$/.test(fixtureEmail)) {
    throw new Error('Limpieza E2E rechazada: correo fuera del patron controlado')
  }

  const fixture = await prisma.usuario.findUnique({
    select: { id: true, nombre: true },
    where: { email: fixtureEmail },
  })
  if (!fixture) return
  if (fixture.nombre !== fixtureName) {
    throw new Error('Limpieza E2E rechazada: la identidad no coincide con el fixture creado')
  }

  await prisma.$transaction(async (tx) => {
    await tx.tokenActivacionCuenta.deleteMany({ where: { usuarioId: fixture.id } })
    await tx.usuario.delete({ where: { id: fixture.id } })
  })
}

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase/).fill(password)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible({ timeout: 30_000 })
}

test.beforeAll(({ baseURL }) => {
  assertSafeWriteE2eTarget(baseURL)
  if (demoPassword !== '123456') {
    throw new Error('SEED_USER_PASSWORD debe corresponder a la credencial demo academica')
  }
})

test.afterEach(async () => {
  await cleanupFixture()
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('Administrador crea, usuario activa y Conductor queda fuera de administracion', async ({
  page,
}) => {
  test.setTimeout(120_000)
  fixtureEmail = `conductor.e2e.${Date.now()}@sgmv.local`
  const evidenceDir = process.env.RC2_EVIDENCE_DIR ?? join(tmpdir(), 'sgmv-usuarios-accesos')
  await mkdir(evidenceDir, { recursive: true })

  await login(page, adminEmail, demoPassword!)
  await page.goto('/usuarios')
  await expect(page.getByRole('heading', { name: /^Usuarios$/ })).toBeVisible()

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 1024, width: 768 },
    { height: 768, width: 1024 },
    { height: 900, width: 1440 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByPlaceholder(/Buscar por nombre o correo/)).toBeVisible()
    await expect(page.getByRole('combobox', { name: /Filtrar por rol/ })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /Filtrar por estado/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Nuevo usuario/ })).toBeVisible()

    if (viewport.width < 1024) {
      await expect(page.getByTestId('user-card-list')).toBeVisible()
      await expect(page.getByTestId('user-table')).toBeHidden()
    } else {
      await expect(page.getByTestId('user-card-list')).toBeHidden()
      await expect(page.getByTestId('user-table')).toBeVisible()
    }

    const overflow = await page.evaluate(() => {
      const pageDocument = (
        globalThis as unknown as {
          document: {
            documentElement: { clientWidth: number; scrollWidth: number }
            querySelector: (selector: string) => { clientWidth: number; scrollWidth: number } | null
          }
        }
      ).document
      const root = pageDocument.documentElement
      const main = pageDocument.querySelector('main')
      return {
        document: root.scrollWidth - root.clientWidth,
        main: main ? main.scrollWidth - main.clientWidth : 0,
      }
    })
    expect(overflow.document).toBeLessThanOrEqual(1)
    expect(overflow.main).toBeLessThanOrEqual(1)

    if (viewport.width === 390 || viewport.width === 1440) {
      await page.screenshot({
        fullPage: true,
        path: join(evidenceDir, `after-local-usuarios-${viewport.width}.png`),
      })
    }
  }

  await page.getByRole('button', { name: /Nuevo usuario/ }).click()
  const createDialog = page.getByRole('dialog', { name: /Nuevo usuario/ })
  await createDialog.getByLabel(/^Nombre$/).fill(fixtureName)
  await createDialog.getByLabel(/Correo de acceso/).fill(fixtureEmail)
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

  await login(page, fixtureEmail, newPassword)
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
  await page.getByPlaceholder(/Buscar por nombre o correo/).fill(fixtureEmail)
  const createdUserCard = page.getByTestId('user-table').getByRole('row').filter({
    hasText: fixtureEmail,
  })
  await expect(createdUserCard).toBeVisible()
  await createdUserCard.getByRole('button', { name: /Gestionar/ }).click()
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
