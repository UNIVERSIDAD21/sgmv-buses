import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { testEntityId } from '../../backend/test/entity-id.js'
import { prisma } from '../../backend/src/prisma/client.js'

const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
const marker = `E2E REVERSO ${suffix}`
const busId = testEntityId()
const orderId = testEntityId()
const interventionId = testEntityId()
const partId = testEntityId()
const ruleId = testEntityId()

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill('123456')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
}

async function openOrder(page: Page) {
  await page.goto('/ordenes-trabajo')
  await page.getByPlaceholder(/Buscar por codigo, bus, placa o descripcion/i).fill(marker)
  const row = page.getByRole('row').filter({ hasText: marker })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Detalle' }).click()
  await expect(page.getByRole('dialog', { name: 'Detalle de orden' })).toBeVisible()
}

test.beforeAll(async () => {
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'administrador.demo@sgmv.local' },
  })
  const mechanic = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'mecanico.demo@sgmv.local' },
  })
  const startedAt = new Date(Date.now() - 60_000)
  await prisma.bus.create({
    data: {
      anio: 2026,
      codigoInterno: `000-REV-${suffix}`,
      estadoOperativo: 'OPERATIVO',
      id: busId,
      kilometrajeActual: 30_000,
      marca: 'Marca reverso',
      modelo: 'Modelo reverso',
      placa: `RV${suffix.slice(0, 6)}`,
    },
  })
  await prisma.ordenTrabajo.create({
    data: {
      busId,
      codigo: `OT-REV-${suffix}`,
      creadaPorId: admin.id,
      descripcion: `${marker} orden con consumo físico`,
      estado: 'EN_EJECUCION',
      fechaAsignacion: new Date(startedAt.getTime() - 1000),
      fechaCreacion: new Date(startedAt.getTime() - 2000),
      fechaInicioEjecucion: startedAt,
      id: orderId,
      origen: 'CORRECTIVO_DIRECTO',
      prioridad: 'MEDIA',
      tecnicoAsignadoId: mechanic.id,
      tipo: 'CORRECTIVA',
    },
  })
  await prisma.intervencion.create({
    data: {
      fechaInicio: startedAt,
      id: interventionId,
      ordenTrabajoId: orderId,
      tecnicoId: mechanic.id,
    },
  })
  await prisma.repuesto.create({
    data: {
      codigo: `REP-REV-${suffix}`,
      costoUnitario: '100.00',
      id: partId,
      nombre: 'Repuesto para reverso E2E',
      stockActual: '5.00',
      stockMinimo: '0.00',
      unidadMedida: 'unidad',
    },
  })
  await prisma.compatibilidadRepuesto.create({
    data: {
      busId,
      definidaPorId: admin.id,
      fechaDefinicion: new Date(),
      especificacionesValidadas: { fuente: 'E2E reverso' },
      id: ruleId,
      permitido: true,
      repuestoId: partId,
      version: 1,
      vigente: true,
    },
  })
  await prisma.$transaction(async (tx) => {
    const consumption = await tx.consumoRepuesto.create({
      data: {
        cantidad: '2.00',
        claveIdempotencia: randomUUID(),
        consumidoPorId: mechanic.id,
        costoUnitario: '100.00',
        evidenciaCompatibilidad: { reglaId: ruleId },
        intervencionId: interventionId,
        ordenTrabajoId: orderId,
        repuestoId: partId,
        resultadoCompatibilidad: 'COMPATIBLE',
        reglaCompatibilidadId: ruleId,
        reglaVersion: 1,
        subtotal: '200.00',
      },
    })
    await tx.movimientoInventario.create({
      data: {
        cantidad: '2.00',
        consumoRepuestoId: consumption.id,
        costoUnitario: '100.00',
        repuestoId: partId,
        responsableId: mechanic.id,
        tipo: 'CONSUMO',
      },
    })
    await tx.repuesto.update({
      where: { id: partId },
      data: { stockActual: { decrement: '2.00' } },
    })
  })
})

test.afterAll(async () => {
  await prisma.$transaction(async (tx) => {
    await tx.movimientoInventario.deleteMany({ where: { repuestoId: partId } })
    await tx.reversoConsumo.deleteMany({
      where: { consumoOriginal: { ordenTrabajoId: orderId } },
    })
    await tx.consumoRepuesto.deleteMany({ where: { ordenTrabajoId: orderId } })
    await tx.compatibilidadRepuesto.deleteMany({ where: { id: ruleId } })
    await tx.intervencion.deleteMany({ where: { id: interventionId } })
    await tx.ordenTrabajo.deleteMany({ where: { id: orderId } })
    await tx.solicitudIdempotente.deleteMany({ where: { recursoId: String(orderId) } })
    await tx.bus.deleteMany({ where: { id: busId } })
    await tx.repuesto.deleteMany({ where: { id: partId } })
  })
  await prisma.$disconnect()
})

test('Administrador revierte parcialmente; Mecánico ve saldo sin costo ni motivo reservado', async ({
  page,
}) => {
  await login(page, 'administrador.demo@sgmv.local')
  await openOrder(page)
  await expect(page.getByText('Saldo pendiente: 2.00')).toBeVisible()
  await page.getByRole('button', { name: 'Reversar consumo' }).click()
  await page.getByLabel('Cantidad a reversar').fill('0.75')
  await page.getByLabel('Motivo del reverso').fill('Tres cuartos no se instalaron')
  await page.getByRole('button', { name: 'Confirmar reverso' }).click()
  await expect(page.getByText('Consumo revertido; stock y costo actualizados.')).toBeVisible()
  await expect(page.getByText('Saldo pendiente: 1.25')).toBeVisible()
  expect(
    (await prisma.repuesto.findUniqueOrThrow({ where: { id: partId } })).stockActual.toFixed(2),
  ).toBe('3.75')
  expect(
    (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: orderId } })).costoTotal.toFixed(2),
  ).toBe('125.00')
  expect(
    await prisma.reversoConsumo.count({ where: { consumoOriginal: { ordenTrabajoId: orderId } } }),
  ).toBe(1)

  await login(page, 'mecanico.demo@sgmv.local')
  await openOrder(page)
  await page.getByText('Ver instrucciones y antecedentes').click()
  await expect(page.getByText(/Saldo pendiente: 1.25/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reversar consumo' })).toHaveCount(0)
  await expect(page.getByText(/Tres cuartos no se instalaron/)).toHaveCount(0)
  const response = await page.evaluate(async (id) => {
    const result = await fetch(`http://localhost:4000/ordenes-trabajo/${id}`, {
      credentials: 'include',
    })
    return result.json()
  }, orderId)
  expect(JSON.stringify(response)).not.toMatch(/"(?:costoTotal|costoUnitario|subtotal)"\s*:/)
  expect(JSON.stringify(response)).not.toContain('Tres cuartos no se instalaron')
})
