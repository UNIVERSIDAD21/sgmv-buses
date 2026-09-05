import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { prisma } from '../../backend/src/prisma/client.js'

const demoPassword = process.env.SEED_USER_PASSWORD
const marker = `E2E-P5-${randomUUID().slice(0, 8)}`
let createdNoveltyId: string | null = null

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(demoPassword!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
}

test.beforeAll(() => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E local')
  }
})

test.afterAll(async () => {
  const novelty = createdNoveltyId
    ? await prisma.novedad.findUnique({ where: { id: createdNoveltyId } })
    : await prisma.novedad.findFirst({ where: { tipo: marker } })
  if (!novelty) {
    await prisma.$disconnect()
    return
  }

  const alertIds = (
    await prisma.alertaInterna.findMany({
      select: { id: true },
      where: { novedadId: novelty.id },
    })
  ).map((alert) => alert.id)
  const reading = novelty.lecturaKilometrajeId
    ? await prisma.lecturaKilometraje.findUnique({
        where: { id: novelty.lecturaKilometrajeId },
      })
    : null

  await prisma.$transaction(async (tx) => {
    await tx.alertaDestinatario.deleteMany({ where: { alertaInternaId: { in: alertIds } } })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
    await tx.novedad.delete({ where: { id: novelty.id } })
    if (reading) {
      const next = await tx.lecturaKilometraje.findFirst({
        orderBy: [{ fechaLectura: 'asc' }, { id: 'asc' }],
        where: {
          busId: reading.busId,
          fechaLectura: { gt: reading.fechaLectura ?? reading.fechaRegistro },
        },
      })
      if (next) {
        await tx.lecturaKilometraje.update({
          data: { kilometrajeAnterior: reading.kilometrajeAnterior },
          where: { id: next.id },
        })
      }
      await tx.lecturaKilometraje.delete({ where: { id: reading.id } })
    }
  })
  await prisma.$disconnect()
})

test('P5 enlaza reporte tardio, clasificacion critica y reaccion de despacho', async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await login(page, 'conductor.demo@sgmv.local')
  await page.goto('/novedades')

  await expect(
    page.getByText('No use este dispositivo ni complete el formulario mientras conduce.'),
  ).toBeVisible()
  await expect(page.getByText('Sin jornada en curso')).toBeVisible()
  await page.getByLabel('Fecha y hora de ocurrencia').fill('2026-09-01T08:00')
  await page.getByLabel('Kilometraje observado').fill('44950')
  await page.getByLabel('Tipo de novedad').fill(marker)
  await page
    .getByLabel('Descripcion')
    .fill('Vibracion de prueba E2E detectada durante la jornada finalizada.')
  await page.getByRole('button', { name: 'Enviar novedad' }).click()
  await expect(
    page.getByText('Novedad registrada y vinculada a la jornada correspondiente.'),
  ).toBeVisible()
  createdNoveltyId = (await prisma.novedad.findFirstOrThrow({ where: { tipo: marker } })).id

  await logout(page)
  await login(page, 'administrador.demo@sgmv.local')
  await page.goto('/novedades')
  await page.getByPlaceholder('Buscar por tipo, descripcion, placa o codigo').fill(marker)
  await expect(page.getByText(marker).first()).toBeVisible()
  await page.getByRole('button', { name: 'Detalle' }).first().click()
  await page.getByRole('button', { name: 'Clasificar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Clasificar novedad' })
  await dialog.getByLabel('Clasificacion').fill('Falla critica E2E')
  await dialog.getByLabel('Criticidad').selectOption('CRITICA')
  await dialog.getByLabel('Observacion').fill('Coordinacion operativa inmediata E2E')
  await dialog.getByRole('button', { name: 'Guardar clasificacion' }).click()
  await expect(page.getByText('Novedad actualizada.')).toBeVisible()
  await expect(page.getByText('Bus bloqueado')).toBeVisible()

  await logout(page)
  await login(page, 'despachador.demo@sgmv.local')
  await page.goto('/novedades')
  await page.getByPlaceholder('Buscar por tipo, descripcion, placa o codigo').fill(marker)
  await page.getByRole('button', { name: 'Detalle' }).first().click()
  await expect(page.getByText('Reaccion operativa requerida')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Coordinar jornada' })).toBeVisible()
  await expect(page.getByText('Coordinacion operativa inmediata E2E')).toHaveCount(0)
  await expect(page.getByText('Acciones administrativas')).toHaveCount(0)
  await testInfo.attach('p5-despachador', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  await page.getByRole('link', { name: 'Coordinar jornada' }).click()
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'Jornadas operativas' }),
  ).toBeVisible()
  expect(
    consoleErrors.filter(
      (message) => !message.includes('server responded with a status of 401 (Unauthorized)'),
    ),
  ).toEqual([])
})
