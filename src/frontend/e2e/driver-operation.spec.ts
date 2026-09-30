import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { expect, test } from '@playwright/test'
import { prisma } from '../../backend/src/prisma/client.js'

const marker = randomUUID().slice(0, 8).toUpperCase()
const email = `operacion-${marker.toLowerCase()}@test.sgmv.local`
const buses: number[] = []
const journeys: number[] = []
const novelties: number[] = []
let driverId: number
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

test.beforeAll(async () => {
  const role = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'CONDUCTOR' } })
  const dispatcher = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'despachador.demo@sgmv.local' },
  })
  driverId = (
    await prisma.usuario.create({
      data: {
        email,
        nombre: `Conductor prueba ${marker}`,
        rolId: role.id,
        contrasenaHash: await hash(process.env.SEED_USER_PASSWORD!, 10),
      },
    })
  ).id
  for (let index = 0; index < 3; index++) {
    buses.push(
      (
        await prisma.bus.create({
          data: {
            codigoInterno: `OPERACION-${index}-${marker}`,
            placa: `${index}${marker.slice(0, 6)}`,
            marca: 'Prueba local',
            modelo: 'Prueba local',
            anio: 2026,
            kilometrajeActual: 1000 * (index + 1),
          },
        })
      ).id,
    )
  }
  for (let index = 0; index < 2; index++) {
    journeys.push(
      (
        await prisma.jornadaOperativa.create({
          data: {
            busId: buses[index],
            conductorId: driverId,
            programadaPorId: dispatcher.id,
            estado: 'PROGRAMADA',
            inicioProgramado: minutesAgo(180 - index * 90),
            finProgramado: minutesAgo(120 - index * 90),
          },
        })
      ).id,
    )
  }
  journeys.push(
    (
      await prisma.jornadaOperativa.create({
        data: {
          busId: buses[1],
          conductorId: driverId,
          programadaPorId: dispatcher.id,
          estado: 'PROGRAMADA',
          inicioProgramado: minutesAgo(-60),
          finProgramado: minutesAgo(-120),
        },
      })
    ).id,
  )
})

test.afterAll(async () => {
  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      where: {
        OR: [
          { busId: { in: buses } },
          { jornadaOperativaId: { in: journeys } },
          { novedadId: { in: novelties } },
        ],
      },
      select: { id: true },
    })
    await tx.alertaDestinatario.deleteMany({
      where: {
        OR: [{ alertaInternaId: { in: alerts.map((alert) => alert.id) } }, { usuarioId: driverId }],
      },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alerts.map((alert) => alert.id) } } })
    await tx.novedad.deleteMany({ where: { id: { in: novelties } } })
    await tx.lecturaKilometraje.deleteMany({ where: { busId: { in: buses } } })
    await tx.jornadaOperativa.deleteMany({ where: { id: { in: journeys } } })
    await tx.bus.deleteMany({ where: { id: { in: buses } } })
    if (driverId) await tx.usuario.delete({ where: { id: driverId } })
  })
  await prisma.$disconnect()
})

test('Conductor confirma tramos vencidos desde Inicio y consulta dos buses propios', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(process.env.SEED_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  await page.goto('/inicio')
  await expect(page.getByRole('button', { name: 'Confirmar salida' })).toBeVisible()
  expect(await prisma.lecturaKilometraje.count({ where: { busId: { in: buses } } })).toBe(0)
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: info.outputPath(`inicio-${width}.png`), fullPage: true })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
  for (let index = 0; index < 2; index++) {
    await expect(page.locator('main')).toContainText(`OPERACION-${index}-${marker}`)
    await page.getByRole('button', { name: 'Confirmar salida' }).click()
    const start = page.getByRole('dialog', { name: 'Confirmar salida' })
    await expect(start.getByLabel('Lectura observada del odómetro')).toBeEmpty()
    await start
      .getByLabel('Fecha y hora real de salida')
      .fill(localDate(minutesAgo(170 - index * 90)))
    await start.getByLabel('Lectura observada del odómetro').fill(String(1000 * (index + 1)))
    await start.getByRole('button', { name: 'Confirmar salida' }).dblclick()
    await expect(page.getByRole('button', { name: 'Confirmar llegada' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar llegada' }).click()
    const finish = page.getByRole('dialog', { name: 'Confirmar llegada' })
    await expect(finish.getByLabel('Lectura observada del odómetro')).toBeEmpty()
    await expect(finish.getByText(/Último odómetro registrado/)).toBeVisible()
    await finish
      .getByLabel('Fecha y hora real de llegada')
      .fill(localDate(minutesAgo(130 - index * 90)))
    await finish.getByLabel('Lectura observada del odómetro').fill(String(1000 * (index + 1) + 50))
    await finish.getByRole('button', { name: 'Confirmar llegada' }).click()
    await expect(page.getByRole('status')).toContainText('Distancia confirmada: 50 km')
    await expect(page).toHaveURL(/\/inicio$/)
    expect(
      await prisma.lecturaKilometraje.count({ where: { jornadaOperativaId: journeys[index] } }),
    ).toBe(2)
  }
  await expect(page.getByRole('button', { name: 'Confirmar salida' })).toHaveCount(0)
  await expect(page.getByText('Próxima jornada', { exact: true })).toBeVisible()
  await page.goto('/historial')
  const select = page.getByLabel('Bus de mis jornadas y reportes')
  await expect(select).toBeVisible()
  await expect(select.locator('option')).toHaveCount(2)
  for (const id of buses.slice(0, 2)) {
    await select.selectOption(String(id))
    await expect(select).toBeEnabled()
    await expect(page.locator('main')).toContainText('Mis jornadas y reportes del bus seleccionado')
  }
  const foreign = await page.request.get(`http://localhost:4000/historial/mi-bus?busId=${buses[2]}`)
  expect(foreign.status()).toBe(404)
  expect(errors).toEqual([])
})

test('Conductor reporta problema antes de salir sin lectura ni inicio ficticio', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(process.env.SEED_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  await page.goto(`/jornadas?detalle=${journeys[2]}`)
  const focused = page.getByRole('region', { name: 'Jornada vinculada a novedad' })
  await focused.getByRole('link', { name: 'Reportar problema antes de salir' }).click()
  await expect(page).toHaveURL(new RegExp(`/novedades\\?antesDeSalir=${journeys[2]}`))
  await expect(page.getByText(`jornada #${journeys[2]}`)).toBeVisible()
  const before = await prisma.lecturaKilometraje.count({ where: { busId: buses[1] } })
  await page.getByLabel('No puedo observar el odómetro de forma segura.').check()
  await page
    .getByLabel('Motivo de ausencia de lectura')
    .fill('Tablero sin energía al recibir el bus')
  await page.getByLabel('Tipo de novedad').fill('Tablero sin energía')
  await page
    .getByLabel('Descripcion')
    .fill('El tablero no enciende y no es seguro confirmar la salida.')
  await page.getByRole('button', { name: 'Enviar novedad' }).click()
  await expect(page.getByText(/Problema registrado antes de la salida/)).toBeVisible()
  const novelty = await prisma.novedad.findFirstOrThrow({
    where: { jornadaOperativaId: journeys[2] },
  })
  novelties.push(novelty.id)
  expect(
    await prisma.alertaInterna.count({
      where: { novedadId: novelty.id, tipo: 'NOVEDAD_PREVIA_SALIDA' },
    }),
  ).toBe(1)
  expect(novelty.busId).toBe(buses[1])
  expect(novelty.lecturaKilometrajeId).toBeNull()
  expect(novelty.reportadaAntesSalida).toBe(true)
  expect(await prisma.lecturaKilometraje.count({ where: { busId: buses[1] } })).toBe(before)
  expect(
    (await prisma.jornadaOperativa.findUniqueOrThrow({ where: { id: journeys[2] } })).estado,
  ).toBe('PROGRAMADA')
})
