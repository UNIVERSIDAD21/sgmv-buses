import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { prisma } from '../../backend/src/prisma/client.js'
import { testEntityId } from '../../backend/test/entity-id.js'

const marker = `ADM-${randomUUID().slice(0, 8).toUpperCase()}`
const busIds: number[] = []
const partIds: number[] = []
const orderIds: number[] = []
let noveltyId: number
let baseline: number[]
const evidence = process.env.SGMV_EVIDENCE_DIR
test.use({ viewport: { width: 1440, height: 900 } })

async function counts() {
  return Promise.all([
    prisma.bus.count(),
    prisma.repuesto.count(),
    prisma.ordenTrabajo.count(),
    prisma.novedad.count(),
    prisma.programacionMantenimiento.count(),
  ])
}
async function login(page: Page, role = 'administrador') {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(`${role}.demo@sgmv.local`)
  await page.getByLabel(/Contrase/).fill('123456')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: /Cerrar sesi/ })).toBeVisible()
}
async function capture(page: Page, name: string) {
  if (!evidence) return
  await mkdir(evidence, { recursive: true })
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true })
}

test.beforeAll(async () => {
  baseline = await counts()
  const createdAt = new Date(Date.now() - 60_000)
  for (let index = 0; index < 11; index++) {
    const busId = testEntityId(),
      partId = testEntityId(),
      orderId = testEntityId(),
      interventionId = testEntityId()
    busIds.push(busId)
    partIds.push(partId)
    orderIds.push(orderId)
    await prisma.$transaction(async (tx) => {
      await tx.bus.create({
        data: {
          id: busId,
          codigoInterno: `${marker}-${index}`,
          placa: `A${busId}`,
          marca: 'Vehículo de validación',
          modelo: 'Modelo de validación',
          anio: 2026,
          kilometrajeActual: 30_000,
        },
      })
      if (index === 0) {
        noveltyId = testEntityId()
        await tx.novedad.create({
          data: {
            id: noveltyId,
            busId,
            conductorId: 1009,
            tipo: `Falla ${marker}`,
            descripcion: 'Reporte para verificar la prioridad de la orden asociada.',
            estado: 'CONVERTIDA_A_ORDEN',
            fechaReporte: createdAt,
            fechaRevision: new Date(createdAt.getTime() + 500),
            revisadaPorId: 1005,
          },
        })
      }
      await tx.repuesto.create({
        data: {
          id: partId,
          codigo: `${marker}-R${index}`,
          nombre: `Filtro ${marker}-${index}`,
          unidadMedida: 'unidad',
          stockActual: '5.00',
          stockMinimo: '1.00',
          costoUnitario: '100.00',
        },
      })
      const rule = await tx.compatibilidadRepuesto.create({
        data: {
          busId,
          repuestoId: partId,
          version: 1,
          permitido: true,
          vigente: true,
          definidaPorId: 1005,
          especificacionesValidadas: { referencia: marker },
          fechaDefinicion: createdAt,
        },
      })
      await tx.ordenTrabajo.create({
        data: {
          id: orderId,
          busId,
          codigo: `OT-${marker}-${index}`,
          tipo: 'CORRECTIVA',
          origen: index === 0 ? 'NOVEDAD' : 'CORRECTIVO_DIRECTO',
          ...(index === 0 ? { novedadId: noveltyId } : {}),
          prioridad: index === 0 ? 'ALTA' : 'MEDIA',
          descripcion: `Verificación de funcionamiento ${marker}`,
          estado: 'EN_EJECUCION',
          creadaPorId: 1005,
          tecnicoAsignadoId: 1007,
          fechaCreacion: createdAt,
          fechaAsignacion: new Date(createdAt.getTime() + 1000),
          fechaInicioEjecucion: new Date(createdAt.getTime() + 2000),
        },
      })
      await tx.intervencion.create({
        data: {
          id: interventionId,
          ordenTrabajoId: orderId,
          tecnicoId: 1007,
          fechaInicio: new Date(createdAt.getTime() + 3000),
        },
      })
      const consumption = await tx.consumoRepuesto.create({
        data: {
          ordenTrabajoId: orderId,
          intervencionId: interventionId,
          repuestoId: partId,
          consumidoPorId: 1007,
          cantidad: '1.00',
          costoUnitario: '100.00',
          subtotal: '100.00',
          resultadoCompatibilidad: 'COMPATIBLE',
          reglaCompatibilidadId: rule.id,
          reglaVersion: 1,
          evidenciaCompatibilidad: { fuente: marker },
          fechaConsumo: new Date(createdAt.getTime() + 4000),
        },
      })
      await tx.movimientoInventario.create({
        data: {
          consumoRepuestoId: consumption.id,
          repuestoId: partId,
          responsableId: 1007,
          tipo: 'CONSUMO',
          cantidad: '1.00',
          costoUnitario: '100.00',
        },
      })
      await tx.repuesto.update({
        where: { id: partId },
        data: { stockActual: { decrement: '1.00' } },
      })
    })
  }
})

test.afterAll(async () => {
  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      where: { OR: [{ busId: { in: busIds } }, { repuestoId: { in: partIds } }] },
      select: { id: true },
    })
    await tx.alertaDestinatario.deleteMany({
      where: { alertaInternaId: { in: alerts.map((item) => item.id) } },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((item) => item.id) } } })
    await tx.movimientoInventario.deleteMany({ where: { repuestoId: { in: partIds } } })
    await tx.consumoRepuesto.deleteMany({ where: { repuestoId: { in: partIds } } })
    await tx.autorizacionExcepcionConsumo.deleteMany({
      where: { ordenTrabajoId: { in: orderIds } },
    })
    await tx.compatibilidadRepuesto.deleteMany({ where: { busId: { in: busIds } } })
    await tx.actividadOrden.deleteMany({
      where: { intervencion: { ordenTrabajoId: { in: orderIds } } },
    })
    await tx.lecturaKilometraje.deleteMany({ where: { busId: { in: busIds } } })
    await tx.intervencion.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenEstadoHistorial.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenReasignacion.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
    await tx.ordenTrabajo.deleteMany({ where: { busId: { in: busIds } } })
    await tx.novedad.deleteMany({ where: { busId: { in: busIds } } })
    await tx.programacionMantenimiento.deleteMany({ where: { busId: { in: busIds } } })
    await tx.busEstadoHistorial.deleteMany({ where: { busId: { in: busIds } } })
    await tx.bus.deleteMany({ where: { id: { in: busIds } } })
    await tx.repuesto.deleteMany({ where: { id: { in: partIds } } })
  })
  expect(await counts(), 'La validación no debe dejar registros de prueba visibles').toEqual(
    baseline,
  )
  await prisma.$disconnect()
})

test('acepta miles en costo y kilometraje; distingue etiquetas, filtros y flujo', async ({
  page,
}) => {
  await login(page)
  await page.goto('/repuestos')
  await page
    .locator('section')
    .filter({ has: page.getByRole('combobox', { name: 'Disponibilidad', exact: true }) })
    .getByRole('textbox', { name: 'Buscar', exact: true })
    .fill(`${marker}-R0`)
  const row = page.getByRole('row').filter({ hasText: `${marker}-R0` })
  await row.getByRole('button', { name: /^Entrada$/ }).click()
  const entry = page.getByRole('dialog', { name: /Registrar entrada/ })
  await entry.getByLabel('Cantidad de entrada').fill('2')
  await entry.getByLabel('Costo unitario futuro').fill('120.000,50')
  await entry.getByLabel(/^Motivo$/).fill('Reposición de inventario para validación local.')
  await entry.getByRole('button', { name: /Registrar entrada/ }).click()
  await expect(page.getByText(/Entrada registrada/)).toBeVisible()
  expect(
    (await prisma.repuesto.findUniqueOrThrow({ where: { id: partIds[0] } })).costoUnitario.toFixed(
      2,
    ),
  ).toBe('120000.50')
  await page.goto('/mantenimiento-preventivo')
  await expect(
    page.getByRole('heading', { name: 'Flujo del mantenimiento preventivo' }),
  ).toBeVisible()
  await expect(page.getByLabel(/^Criterio$/)).toHaveValue('')
  await expect(
    page.getByLabel(/^Criterio$/).getByRole('option', { name: 'Sin filtro' }),
  ).toHaveCount(1)
  await page.getByRole('button', { name: 'Programar mantenimiento' }).click()
  const preventive = page.getByRole('dialog', { name: 'Crear programacion preventiva' })
  await preventive
    .getByRole('combobox', { name: 'Bus', exact: true })
    .selectOption(String(busIds[0]))
  await preventive
    .getByRole('combobox', { name: 'Criterio', exact: true })
    .selectOption('KILOMETRAJE')
  await preventive.getByLabel(/^Tipo$/).fill('Inspección preventiva')
  await preventive.getByLabel(/Kilometraje objetivo/).fill('120.000')
  await preventive
    .getByLabel(/^Actividad$/)
    .fill(`Inspección del vehículo para validación ${marker}.`)
  await preventive.getByRole('button', { name: 'Registrar programacion' }).click()
  await expect(page.getByText('Programacion preventiva registrada.')).toBeVisible()
  expect(
    (await prisma.programacionMantenimiento.findFirstOrThrow({ where: { busId: busIds[0] } }))
      .kilometrajeObjetivo,
  ).toBe(120000)
  await capture(page, 'after-preventivo-formato')
})

test('consulta excepciones, recupera un error controlado y conserva permisos del Mecánico', async ({
  page,
}) => {
  await login(page)
  const path = `**/ordenes-trabajo/${orderIds[0]}/repuestos-disponibles**`
  await page.route(path, (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'COMPATIBILITY_QUERY_UNAVAILABLE',
          message: 'No se pudo consultar la compatibilidad en este momento. Vuelva a intentarlo.',
        },
      },
    }),
  )
  await page.goto(`/ordenes-trabajo?detalle=${orderIds[0]}`)
  const dialog = page.getByRole('dialog', { name: 'Detalle de orden' })
  await expect(dialog.getByText(/No se pudo consultar la compatibilidad/)).toBeVisible()
  await page.unroute(path)
  await dialog.getByRole('button', { name: 'Reintentar consulta de repuestos' }).click()
  await dialog.getByLabel('Buscar repuesto para excepción').fill(`${marker}-R1`)
  await expect(
    dialog
      .getByRole('combobox', { name: 'Repuesto', exact: true })
      .locator(`option[value="${partIds[1]}"]`),
  ).toBeAttached()
  await dialog
    .getByRole('combobox', { name: 'Repuesto', exact: true })
    .selectOption(String(partIds[1]))
  await dialog.getByLabel('Cantidad maxima').fill('0.5')
  await dialog
    .getByLabel('Motivo administrativo')
    .fill('Autorización puntual de validación; se conserva la regla original.')
  await dialog.getByRole('button', { name: 'Autorizar excepcion' }).click()
  await expect(page.getByText('Excepcion puntual autorizada.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Revocar' }).click()
  await expect(page.getByText('Excepcion revocada.')).toBeVisible()
  await dialog
    .getByRole('heading', { name: 'Excepciones de compatibilidad' })
    .scrollIntoViewIfNeeded()
  await capture(page, 'after-excepciones')
  await login(page, 'mecanico')
  await page.goto(`/ordenes-trabajo?detalle=${orderIds[0]}`)
  await expect(page.getByRole('dialog', { name: 'Detalle de orden' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Excepciones de compatibilidad' })).toHaveCount(0)
  expect((await page.request.get('http://localhost:4000/historial/informes/costos')).status()).toBe(
    403,
  )
})

test('permite consultar las once filas de cada informe, con paginación independiente y prioridad visible', async ({
  page,
}) => {
  await login(page)
  await page.goto('/historial')
  await page.getByLabel('Buscar bus').fill(marker)
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  for (const [button, title] of [
    ['Ver todo el mantenimiento', 'Informe de mantenimiento'],
    ['Ver todos los repuestos', 'Informe de repuestos utilizados'],
    ['Ver todos los costos', 'Informe de costos por bus'],
  ]) {
    await page.getByRole('button', { name: button }).click()
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog.getByRole('row')).toHaveCount(11)
    await expect(dialog.getByText(/11 registros/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Siguiente' }).click()
    await expect(dialog.getByText('Página 2 de 2')).toBeVisible()
    await expect(dialog.getByRole('row')).toHaveCount(2)
    await expect(dialog.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    await capture(page, `after-${title.replaceAll(' ', '-')}`)
    await dialog.getByRole('button', { name: 'Cerrar diálogo' }).click()
  }
  await page.goto('/novedades')
  await page.getByPlaceholder(/Buscar por tipo/).fill(marker)
  await page.getByLabel(/^Prioridad$/).selectOption('ALTA')
  const table = page.getByRole('table', { name: 'Novedades operativas' })
  await expect(table.getByRole('columnheader', { name: 'Prioridad' })).toBeVisible()
  await expect(
    table.getByRole('row').filter({ hasText: marker }).getByText('Alta', { exact: true }),
  ).toBeVisible()
  await capture(page, 'after-novedades-prioridad')
})
