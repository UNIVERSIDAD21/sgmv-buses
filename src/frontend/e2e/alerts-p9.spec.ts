import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'
import { hash } from 'bcryptjs'

import { prisma } from '../../backend/src/prisma/client.js'

const demoPassword = process.env.SEED_USER_PASSWORD
const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
const marker = `P9E2E-${suffix}`
const ids = {
  admin: randomUUID(),
  bus: randomUUID(),
  dispatcher: randomUUID(),
  driver: randomUUID(),
  journey: randomUUID(),
  mechanic: randomUUID(),
}
const emails = {
  admin: `p9-admin-${suffix.toLowerCase()}@test.sgmv.local`,
  dispatcher: `p9-despacho-${suffix.toLowerCase()}@test.sgmv.local`,
  driver: `p9-conductor-${suffix.toLowerCase()}@test.sgmv.local`,
  mechanic: `p9-mecanico-${suffix.toLowerCase()}@test.sgmv.local`,
}
let noveltyId: string | null = null
let alertId: string | null = null
let adminRecipientId: string | null = null
let dispatcherRecipientId: string | null = null

async function login(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase/).fill(demoPassword!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('button', { name: /Cerrar/ })).toBeVisible({ timeout: 30_000 })
}

async function csrfPost(page: Page, path: string, body: Record<string, unknown>) {
  return page.evaluate(
    async ({ payload, requestPath }) => {
      const csrfResponse = await fetch('http://localhost:4000/auth/csrf', {
        credentials: 'include',
      })
      const csrfBody = (await csrfResponse.json()) as { data: { csrfToken: string } }
      const idempotencyKey = crypto.randomUUID()
      const response = await fetch(`http://localhost:4000${requestPath}`, {
        body: JSON.stringify(payload),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-CSRF-Token': csrfBody.data.csrfToken,
        },
        method: 'POST',
      })
      return { body: await response.json(), status: response.status }
    },
    { payload: body, requestPath: path },
  )
}

test.beforeAll(async () => {
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD es obligatoria para la prueba E2E P9')
  }
  const passwordHash = await hash(demoPassword, 10)
  const roles = await prisma.rol.findMany({
    select: { codigo: true, id: true },
    where: { codigo: { in: ['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR'] } },
  })
  const roleId = Object.fromEntries(roles.map((role) => [role.codigo, role.id]))
  const startAt = new Date(Date.now() - 2 * 60_000)
  const endAt = new Date(Date.now() + 60 * 60_000)

  await prisma.$transaction(async (tx) => {
    await tx.usuario.createMany({
      data: [
        {
          contrasenaHash: passwordHash,
          email: emails.admin,
          estado: 'ACTIVO',
          id: ids.admin,
          nombre: `Administrador ${marker}`,
          rolId: roleId.ADMINISTRADOR!,
        },
        {
          contrasenaHash: passwordHash,
          email: emails.dispatcher,
          estado: 'ACTIVO',
          id: ids.dispatcher,
          nombre: `Despachador ${marker}`,
          rolId: roleId.DESPACHADOR!,
        },
        {
          contrasenaHash: passwordHash,
          email: emails.driver,
          estado: 'ACTIVO',
          id: ids.driver,
          nombre: `Conductor ${marker}`,
          rolId: roleId.CONDUCTOR!,
        },
        {
          contrasenaHash: passwordHash,
          email: emails.mechanic,
          estado: 'ACTIVO',
          id: ids.mechanic,
          nombre: `Mecánico ${marker}`,
          rolId: roleId.MECANICO!,
        },
      ],
    })
    await tx.bus.create({
      data: {
        anio: 2026,
        codigoInterno: `P9-BUS-${suffix}`,
        id: ids.bus,
        kilometrajeActual: 40_000,
        marca: 'Marca E2E P9',
        modelo: 'Modelo E2E P9',
        placa: `P9${suffix.slice(0, 6)}`,
      },
    })
    await tx.jornadaOperativa.create({
      data: {
        busId: ids.bus,
        conductorId: ids.driver,
        estado: 'PROGRAMADA',
        finProgramado: endAt,
        id: ids.journey,
        inicioProgramado: startAt,
        programadaPorId: ids.dispatcher,
      },
    })
    await tx.jornadaOperativa.update({
      data: { estado: 'EN_CURSO', iniciadaPorId: ids.driver, inicioReal: startAt },
      where: { id: ids.journey },
    })
    await tx.lecturaKilometraje.create({
      data: {
        busId: ids.bus,
        fechaLectura: startAt,
        fechaRegistro: startAt,
        jornadaOperativaId: ids.journey,
        kilometrajeAnterior: 40_000,
        kilometrajeNuevo: 40_000,
        registradoPorId: ids.driver,
        tipo: 'INICIO_JORNADA',
      },
    })
  })
})

test.afterAll(async () => {
  await prisma.$transaction(async (tx) => {
    const alerts = await tx.alertaInterna.findMany({
      select: { id: true },
      where: {
        OR: [
          { busId: ids.bus },
          { jornadaOperativaId: ids.journey },
          ...(noveltyId ? [{ novedadId: noveltyId }] : []),
        ],
      },
    })
    const alertIds = alerts.map((alert) => alert.id)
    await tx.alertaDestinatario.deleteMany({
      where: {
        OR: [
          { alertaInternaId: { in: alertIds } },
          { usuarioId: { in: [ids.admin, ids.dispatcher, ids.driver, ids.mechanic] } },
        ],
      },
    })
    await tx.alertaInterna.deleteMany({ where: { id: { in: alertIds } } })
    await tx.solicitudIdempotente.deleteMany({
      where: { actorId: { in: [ids.admin, ids.dispatcher, ids.driver, ids.mechanic] } },
    })
    await tx.eventoAuditoria.deleteMany({
      where: {
        OR: [
          { actorId: { in: [ids.admin, ids.dispatcher, ids.driver, ids.mechanic] } },
          { recursoId: { in: [ids.bus, ids.journey, ...(noveltyId ? [noveltyId] : [])] } },
        ],
      },
    })
    if (noveltyId) await tx.novedad.deleteMany({ where: { id: noveltyId } })
    await tx.lecturaKilometraje.deleteMany({ where: { jornadaOperativaId: ids.journey } })
    await tx.jornadaOperativa.deleteMany({ where: { id: ids.journey } })
    await tx.bus.deleteMany({ where: { id: ids.bus } })
    await tx.usuario.deleteMany({
      where: { id: { in: [ids.admin, ids.dispatcher, ids.driver, ids.mechanic] } },
    })
  })
  await prisma.$disconnect()
})

test('materializa evento crítico, opera bandeja propia y bloquea lectura ajena', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  const occurrence = new Date(Date.now() - 30_000)

  await login(page, emails.driver)
  const report = await csrfPost(page, '/novedades', {
    descripcion: `Pérdida crítica de presión ${marker}`,
    fechaOcurrencia: occurrence.toISOString(),
    kilometraje: 40_001,
    tipo: `Falla crítica ${marker}`,
  })
  expect(report.status).toBe(201)
  noveltyId = (report.body as { data: { novedad: { id: string } } }).data.novedad.id

  await login(page, emails.admin)
  const review = await csrfPost(page, `/novedades/${noveltyId}/revision`, {
    accion: 'CLASIFICAR',
    afectaOperacion: true,
    bloqueaDisponibilidad: true,
    clasificacion: 'Falla crítica de seguridad',
    criticidad: 'CRITICA',
    observacion: 'Retirar el bus y coordinar reemplazo',
  })
  expect(review.status).toBe(200)

  const alert = await prisma.alertaInterna.findUniqueOrThrow({
    include: { destinatarios: { include: { usuario: { include: { rol: true } } } } },
    where: { claveDeduplicacion: `novedad-critica:${noveltyId}` },
  })
  alertId = alert.id
  expect(new Set(alert.destinatarios.map((item) => item.usuario.rol.codigo))).toEqual(
    new Set(['ADMINISTRADOR', 'DESPACHADOR']),
  )
  adminRecipientId = alert.destinatarios.find((item) => item.usuarioId === ids.admin)!.id
  dispatcherRecipientId = alert.destinatarios.find((item) => item.usuarioId === ids.dispatcher)!.id

  await page.goto('/inicio')
  await expect(page.getByRole('button', { name: 'Alertas internas, 1 sin leer' })).toBeVisible()
  await page.getByRole('button', { name: 'Alertas internas, 1 sin leer' }).click()
  await expect(page).toHaveURL(/\/alertas$/)
  const article = page.getByRole('article').filter({ hasText: 'Novedad crítica reportada' })
  await expect(article).toBeVisible()
  await expect(article.getByText('Crítica', { exact: true })).toBeVisible()
  await expect(article.getByText(`P9-BUS-${suffix}`, { exact: true })).toBeVisible()
  await expect(article.getByText('CRITICA', { exact: true })).toBeVisible()

  await article.getByRole('button', { name: 'Marcar leída' }).click()
  await expect(
    page.getByRole('button', { name: 'Alertas internas, ninguna sin leer' }),
  ).toBeVisible()
  await article.getByRole('button', { name: 'Marcar atendida' }).click()
  await expect(article.getByText('Atendida', { exact: true })).toBeVisible()
  await article.getByRole('button', { name: 'Ver origen' }).click()
  await expect(page).toHaveURL(/\/novedades$/)

  await login(page, emails.mechanic)
  await page.goto('/alertas')
  await expect(page.getByText('Bandeja vacía')).toBeVisible()
  const foreignMutation = await page.evaluate(async (recipientId) => {
    const csrfResponse = await fetch('http://localhost:4000/auth/csrf', { credentials: 'include' })
    const csrfBody = (await csrfResponse.json()) as { data: { csrfToken: string } }
    const response = await fetch(`http://localhost:4000/alertas/${recipientId}/leida`, {
      body: '{}',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfBody.data.csrfToken },
      method: 'PATCH',
    })
    return response.status
  }, adminRecipientId)
  expect(foreignMutation).toBe(404)

  const recipients = await prisma.alertaDestinatario.findMany({
    where: { id: { in: [adminRecipientId, dispatcherRecipientId] } },
  })
  expect(recipients.find((item) => item.id === adminRecipientId)).toMatchObject({
    estado: 'ATENDIDA',
  })
  expect(recipients.find((item) => item.id === dispatcherRecipientId)).toMatchObject({
    estado: 'NO_LEIDA',
    fechaAtencion: null,
    fechaLectura: null,
  })
  expect(alertId).not.toBeNull()

  await testInfo.attach('p9-bandeja-alerta-atendida', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  expect(
    consoleErrors.filter(
      (message) => !message.includes('401 (Unauthorized)') && !message.includes('404 (Not Found)'),
    ),
  ).toEqual([])
})
