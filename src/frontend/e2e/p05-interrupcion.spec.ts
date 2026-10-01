import { expect, test } from '@playwright/test'

test('la interrupción móvil no exige odómetro ficticio y conserva el bloqueo operativo', async ({
  page,
}) => {
  const password = process.env.SEED_USER_PASSWORD
  if (!password) throw new Error('Falta la clave demo local para la regresión E2E')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByLabel(/Correo/).fill('despachador.demo@sgmv.local')
  await page.getByLabel(/Contrase/).fill(password)
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.locator('#contenido-principal')).toBeVisible()

  const now = new Date()
  let interrupted = false
  const bus = {
    codigoInterno: 'BUS-INTERRUPCION',
    placa: 'INT001',
    id: 99005,
    estadoOperativo: 'OPERATIVO',
  }
  const driver = { id: 99006, nombre: 'Conductor de prueba', rol: 'CONDUCTOR' }
  const journey = {
    id: 99007,
    bus,
    conductor: driver,
    ruta: null,
    estado: 'EN_CURSO',
    inicioProgramado: new Date(now.getTime() - 90 * 60_000).toISOString(),
    finProgramado: new Date(now.getTime() + 60 * 60_000).toISOString(),
    inicioReal: new Date(now.getTime() - 80 * 60_000).toISOString(),
    finReal: null,
    fechaCambio: null,
    motivoCambio: null,
    cambioPor: null,
    finalizadaPor: null,
    iniciadaPor: driver,
    programadaPor: { id: 99008, nombre: 'Despachador de prueba', rol: 'DESPACHADOR' },
    jornadaAnteriorId: null,
    jornadaSucesoraId: null,
    lecturaInicial: {
      id: 99009,
      fechaLectura: new Date(now.getTime() - 80 * 60_000).toISOString(),
      kilometraje: 45000,
      kilometrajeAnterior: 44900,
      registradoPor: driver,
      observadoPor: driver,
      tipo: 'INICIO_JORNADA',
    },
    lecturaFinal: null,
    lecturaReferencia: null,
    interrupcion: null,
    cierrePendiente: null,
    proyeccionDemo: null,
    causasDisponibilidad: [],
    acciones: {
      puedeIniciar: false,
      puedeFinalizar: true,
      puedeCancelar: true,
      puedeReasignar: true,
      puedeInterrumpir: true,
      puedeConciliarLectura: false,
      puedeMarcarNoRecuperable: false,
    },
    updatedAt: now.toISOString(),
  }
  await page.route('**/jornadas**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.port !== '4000' || request.method() === 'OPTIONS') return route.continue()
    const headers = {
      'access-control-allow-origin': 'http://localhost:5173',
      'access-control-allow-credentials': 'true',
    }
    if (url.pathname === '/jornadas/opciones') {
      return route.fulfill({
        headers,
        json: { data: { buses: [bus], conductores: [driver], rutas: [] } },
      })
    }
    if (url.pathname === '/jornadas' && request.method() === 'GET') {
      const futureJourneys = Array.from({ length: 11 }, (_, index) => ({
        ...journey,
        id: 99020 + index,
        estado: 'PROGRAMADA',
        inicioProgramado: new Date(now.getTime() + (index + 1) * 86_400_000).toISOString(),
        finProgramado: new Date(
          now.getTime() + (index + 1) * 86_400_000 + 8 * 3_600_000,
        ).toISOString(),
        inicioReal: null,
        lecturaInicial: null,
        acciones: {
          ...journey.acciones,
          puedeIniciar: false,
          puedeFinalizar: false,
          puedeCancelar: false,
          puedeReasignar: false,
          puedeInterrumpir: false,
        },
      }))
      const items =
        url.searchParams.get('cierreAtrasado') === 'true'
          ? []
          : [
              interrupted
                ? {
                    ...journey,
                    estado: 'INTERRUMPIDA',
                    finReal: now.toISOString(),
                    motivoCambio: 'Falla operacional durante el recorrido',
                    bus: { ...bus, estadoOperativo: 'FUERA_DE_SERVICIO' },
                    interrupcion: {
                      estadoConciliacion: 'PENDIENTE',
                      motivoAusenciaLectura: 'Odómetro inaccesible',
                      motivoNoRecuperable: null,
                      conciliadaAt: null,
                      conciliadaPor: null,
                      detalleConciliacion: null,
                    },
                    acciones: {
                      ...journey.acciones,
                      puedeFinalizar: false,
                      puedeCancelar: false,
                      puedeReasignar: true,
                      puedeInterrumpir: false,
                      puedeConciliarLectura: true,
                    },
                  }
                : journey,
              ...futureJourneys,
            ]
      return route.fulfill({
        headers,
        json: {
          data: {
            jornadas: items,
            paginacion: { limite: 12, pagina: 1, paginas: 1, total: items.length },
          },
        },
      })
    }
    if (url.pathname === '/jornadas/99007/interrumpir' && request.method() === 'POST') {
      const body = request.postDataJSON() as {
        motivoSinLectura?: string
        kilometrajeFinal?: number
      }
      expect(body.motivoSinLectura).toBe('Odómetro inaccesible')
      expect(body.kilometrajeFinal).toBeUndefined()
      interrupted = true
      return route.fulfill({ headers, json: { data: { jornada: journey } } })
    }
    return route.continue()
  })

  await page.goto('/jornadas')
  const agenda = page.getByRole('region', { name: 'Agenda compacta de jornadas' })
  await agenda.getByLabel('Agrupar por').selectOption('conductor')
  await expect(
    agenda.getByRole('article', { name: 'Jornadas de Conductor de prueba' }),
  ).toBeVisible()
  await agenda.getByLabel('Agrupar por').selectOption('fecha')
  await expect(agenda.getByRole('article')).toHaveCount(12)
  await agenda.getByLabel('Agrupar por').selectOption('bus')
  const group = agenda.getByRole('article', { name: 'Jornadas de BUS-INTERRUPCION · INT001' })
  await expect(group.getByText('Operativo')).toBeVisible()
  await expect(group).toContainText('12 jornadas en esta página')
  await group.getByRole('button', { name: 'Ver jornadas' }).click()
  await expect(group.getByLabel(/Acciones de jornada/)).toHaveCount(12)
  await group.getByLabel('Acciones de jornada 99007').click()
  await group.getByRole('button', { name: 'Interrumpir jornada' }).click()
  const dialog = page.getByRole('dialog', { name: 'Interrumpir jornada' })
  await dialog.getByLabel('Motivo operacional').fill('Falla operacional durante el recorrido')
  await dialog.getByLabel('Por qué falta la lectura').fill('Odómetro inaccesible')
  await dialog.getByRole('button', { name: 'Confirmar' }).click()
  await expect(group.getByText('Fuera de servicio')).toBeVisible()
  await group.getByRole('button', { name: 'Ver jornadas' }).click()
  await expect(group.getByText('Interrumpida')).toBeVisible()
  await group.getByLabel('Acciones de jornada 99007').click()
  await group.getByRole('button', { name: 'Ver detalle' }).click()
  await expect(group.getByText(/Conciliación: Pendiente/)).toBeVisible()
  await expect(group.getByText(/La interrupción no habilita automáticamente el bus/)).toBeVisible()
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(mobileOverflow).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 1440, height: 900 })
  const firstRow = group.getByLabel('Acciones de jornada 99007').locator('xpath=../..')
  await firstRow.scrollIntoViewIfNeeded()
  const desktopColumns = await firstRow.evaluate(
    (row) => getComputedStyle(row).gridTemplateColumns.split(' ').length,
  )
  expect(desktopColumns).toBe(5)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
