import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'
import { hash } from 'bcryptjs'

import { prisma } from '../../backend/src/prisma/client.js'

const suffix = randomUUID().slice(0, 8).toUpperCase()
let busId: number
let driverId: number

test.beforeAll(async () => {
  const role = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'CONDUCTOR' } })
  const driver = await prisma.usuario.create({
    data: {
      email: `periodo-e2e-${suffix.toLowerCase()}@test.sgmv.local`,
      nombre: `Conductor período ${suffix}`,
      contrasenaHash: await hash(process.env.SEED_USER_PASSWORD!, 10),
      rolId: role.id,
    },
  })
  driverId = driver.id
  const bus = await prisma.bus.create({
    data: {
      codigoInterno: `PER-E2E-${suffix}`,
      placa: `P${suffix.slice(0, 6)}`,
      anio: 2026,
      marca: 'SGMV-DEMO',
      modelo: 'PERIODO',
      kilometrajeActual: 0,
    },
  })
  busId = bus.id
})

test.afterAll(async () => {
  if (!busId) return
  try {
    await prisma.$transaction(async (tx) => {
      const journeys = await tx.jornadaOperativa.findMany({
        where: { busId },
        select: { id: true },
      })
      const ids = journeys.map((journey) => journey.id)
      const alerts = await tx.alertaInterna.findMany({
        where: { OR: [{ busId }, { jornadaOperativaId: { in: ids } }] },
        select: { id: true },
      })
      const alertIds = alerts.map((alert) => alert.id)
      await tx.alertaDestinatario.deleteMany({ where: { alertaInternaId: { in: alertIds } } })
      await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
      await tx.jornadaOperativa.deleteMany({ where: { id: { in: ids } } })
      await tx.busEstadoHistorial.deleteMany({ where: { busId } })
      await tx.bus.delete({ where: { id: busId } })
      await tx.usuario.delete({ where: { id: driverId } })
    })
  } finally {
    await prisma.$disconnect()
  }
})

test('Despacho previsualiza y confirma cinco jornadas individuales de un período', async ({
  page,
}) => {
  const monday = new Date(Date.now() + 8 * 86_400_000)
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7))
  const friday = new Date(monday.getTime() + 4 * 86_400_000)
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('despachador.demo@sgmv.local')
  await page.getByLabel('Contraseña').fill(process.env.SEED_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  await page.goto('/jornadas')
  await page.getByLabel('Frecuencia').selectOption('period')
  await page.getByLabel('Bus de jornada').selectOption(String(busId))
  await page.getByLabel('Conductor de jornada').selectOption(String(driverId))
  await page.getByLabel('Inicio del período').fill(monday.toISOString().slice(0, 10))
  await page.getByLabel('Fin del período').fill(friday.toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Programar jornada' }).click()
  const preview = page.getByRole('region', { name: 'Confirmar programación' })
  await expect(preview.getByText('5 jornadas propuestas · 5 sin conflictos')).toBeVisible()
  await preview.getByRole('button', { name: 'Confirmar programación' }).click()
  await expect(page.getByText('5 jornadas programadas por período')).toBeVisible()
  expect(
    await prisma.jornadaOperativa.count({
      where: { busId, conductorId: driverId, estado: 'PROGRAMADA' },
    }),
  ).toBe(5)
  await page.getByRole('button', { name: 'Programar jornada' }).click()
  await expect(preview.getByText('5 jornadas propuestas · 0 sin conflictos')).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Confirmar programación' })).toBeDisabled()
})
