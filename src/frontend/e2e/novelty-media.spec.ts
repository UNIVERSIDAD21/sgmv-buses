/// <reference lib="dom" />
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { prisma } from '../../backend/src/prisma/client.js'

const marker = `MED-${randomUUID().slice(0, 8).toUpperCase()}`
let busId: number
let noveltyId: number
let orderId: number
let evidenceId: number | undefined

async function login(page: Page, role: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(`${role}.demo@sgmv.local`)
  await page.getByLabel('Contraseña').fill('123456')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/inicio$/)
}

async function visiblePhoto(page: Page) {
  const photo = page.getByRole('img', { name: 'Evidencia prueba-ux.png' })
  await expect(photo).toBeVisible()
  await expect
    .poll(() => photo.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0)
}

async function deleteThroughUi(page: Page) {
  await login(page, 'administrador')
  await page.goto(`/novedades?detalle=${noveltyId}`)
  await visiblePhoto(page)
  await page.getByRole('button', { name: 'Eliminar con justificación' }).click()
  await page
    .getByLabel('Motivo para eliminar prueba-ux.png')
    .fill('Retiro de imagen temporal de la prueba real UX-MED-001.')
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click()
  await expect(
    page.getByText('La imagen fue eliminada con su justificación registrada.'),
  ).toBeVisible()
}

test.beforeAll(async () => {
  const driver = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'conductor.demo@sgmv.local' },
  })
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'administrador.demo@sgmv.local' },
  })
  const mechanic = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'mecanico.demo@sgmv.local' },
  })
  const fixture = await prisma.$transaction(async (tx) => {
    const bus = await tx.bus.create({
      data: {
        anio: 2026,
        codigoInterno: marker,
        kilometrajeActual: 1000,
        marca: 'Prueba',
        modelo: 'Prueba',
        placa: marker.slice(0, 10),
      },
    })
    const novelty = await tx.novedad.create({
      data: {
        busId: bus.id,
        conductorId: driver.id,
        tipo: marker,
        descripcion: 'Evidencia temporal para comprobar fotografías privadas.',
      },
    })
    const order = await tx.ordenTrabajo.create({
      data: {
        busId: bus.id,
        novedadId: novelty.id,
        codigo: marker,
        creadaPorId: admin.id,
        descripcion: 'Inspeccionar evidencia de prueba',
        estado: 'ASIGNADA',
        fechaCreacion: new Date(Date.now() - 1000),
        fechaAsignacion: new Date(),
        origen: 'NOVEDAD',
        prioridad: 'MEDIA',
        tecnicoAsignadoId: mechanic.id,
        tipo: 'CORRECTIVA',
      },
    })
    return { bus, novelty, order }
  })
  busId = fixture.bus.id
  noveltyId = fixture.novelty.id
  orderId = fixture.order.id
})

test.afterAll(async ({ browser }) => {
  try {
    if (!noveltyId) return
    const active = await prisma.evidenciaNovedad.count({
      where: { novedadId: noveltyId, estado: 'ACTIVA' },
    })
    if (active) {
      const page = await browser.newPage({
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
      })
      try {
        await deleteThroughUi(page)
      } finally {
        await page.close()
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.evidenciaNovedad.deleteMany({ where: { novedadId: noveltyId } })
      await tx.ordenTrabajo.delete({ where: { id: orderId } })
      await tx.novedad.delete({ where: { id: noveltyId } })
      await tx.bus.delete({ where: { id: busId } })
    })
  } finally {
    await prisma.$disconnect()
  }
})

test('fotografía real: Conductor carga, Administración y Mecánico ven, Despacho no accede y se elimina con motivo', async ({
  page,
}, info) => {
  test.setTimeout(150_000)
  await login(page, 'conductor')
  await page.goto(`/novedades?detalle=${noveltyId}`)
  const picker = page.getByRole('dialog').locator('input[type=file]')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#047857'
    ctx.fillRect(0, 0, 320, 180)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('EVIDENCIA TEMPORAL SGMV', 20, 90)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  await picker.setInputFiles({
    name: 'prueba-ux.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await expect(page.getByRole('img', { name: 'Vista previa de prueba-ux.png' })).toBeVisible()
  const upload = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/novedades/${noveltyId}/evidencias`),
  )
  await page.getByRole('button', { name: 'Cargar imágenes' }).click()
  const response = await upload
  expect(response.status()).toBe(201)
  const headers = await response.request().allHeaders()
  expect(Boolean(headers.cookie)).toBe(true)
  expect(Boolean(headers['x-csrf-token'])).toBe(true)
  expect(headers['content-type']).toMatch(/^multipart\/form-data; boundary=/)
  evidenceId = (await response.json()).data.evidencias[0].id as number
  await visiblePhoto(page)
  await info.attach('conductor-foto-real', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  await login(page, 'administrador')
  await page.goto(`/novedades?detalle=${noveltyId}`)
  await visiblePhoto(page)
  await login(page, 'mecanico')
  await page.goto(`/ordenes-trabajo?detalle=${orderId}`)
  await page.getByText('Contexto e historial de la orden', { exact: true }).click()
  await visiblePhoto(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await info.attach('mecanico-foto-movil', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  await login(page, 'despachador')
  await page.goto(`/novedades?detalle=${noveltyId}`)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Evidencia prueba-ux.png' })).toHaveCount(0)
  const access = await page.evaluate(
    async ({ noveltyId, evidenceId }) => {
      const result = await fetch(
        `http://localhost:4000/novedades/${noveltyId}/evidencias/${evidenceId}/contenido`,
        { credentials: 'include' },
      )
      const detail = await fetch(`http://localhost:4000/novedades/${noveltyId}`, {
        credentials: 'include',
      })
      const body = (await detail.json()) as { data: { novedad: Record<string, unknown> } }
      return { status: result.status, hasMetadata: 'evidencias' in body.data.novedad }
    },
    { noveltyId, evidenceId },
  )
  expect(access).toEqual({ status: 403, hasMetadata: false })
  await deleteThroughUi(page)
  const stored = await prisma.evidenciaNovedad.findUniqueOrThrow({ where: { id: evidenceId } })
  expect(stored.estado).toBe('ELIMINADA')
  expect(stored.motivoEliminacion).toContain('UX-MED-001')
  expect(stored.eliminadaPorId).not.toBeNull()
})
