// Operational journeys module regression
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPath, mockApi, journeyHandler, journeyFixture, ok } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('P4 journey frontend', () => {
  it('muestra a Despacho la cola de jornadas con Conductor no disponible', async () => {
    window.history.pushState({}, '', '/jornadas')
    const handler = journeyHandler('DESPACHADOR')
    const fetchMock = mockApi(async (path, init, query) => {
      if (path === '/jornadas' && query?.get('requiereReasignacion') === 'true') {
        return ok({
          jornadas: [journeyFixture('PROGRAMADA')],
          paginacion: { limite: 12, pagina: 1, paginas: 1, total: 1 },
        })
      }
      return handler(path, init, query)
    })
    render(<App />)
    const queue = await screen.findByRole('region', { name: 'Jornadas por reasignar' })
    expect(within(queue).getByText(/Jornadas por reasignar \(1\)/)).toBeInTheDocument()
    expect(within(queue).getByText(/no tiene acceso o cambió de rol/i)).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([input]) => new URL(String(input)).searchParams.get('requiereReasignacion') === 'true',
      ),
    ).toBe(true)
  })
  it('permite a Despacho interrumpir sin inventar kilometraje y muestra la conciliación pendiente', async () => {
    window.history.pushState({}, '', '/jornadas')
    const handler = journeyHandler('DESPACHADOR')
    let interrupted = false
    const active = {
      ...journeyFixture('EN_CURSO'),
      acciones: { ...journeyFixture('EN_CURSO').acciones, puedeInterrumpir: true },
    }
    const interruptedJourney = {
      ...active,
      estado: 'INTERRUMPIDA',
      finReal: new Date().toISOString(),
      bus: { ...active.bus, estadoOperativo: 'FUERA_DE_SERVICIO' },
      motivoCambio: 'El bus perdió potencia durante el recorrido',
      interrupcion: {
        estadoConciliacion: 'PENDIENTE',
        motivoAusenciaLectura: 'Odómetro inaccesible',
        motivoNoRecuperable: null,
        conciliadaAt: null,
        conciliadaPor: null,
        detalleConciliacion: null,
      },
      acciones: { ...active.acciones, puedeInterrumpir: false, puedeConciliarLectura: true },
    }
    const fetchMock = mockApi(async (path, init, query) => {
      if (path === '/jornadas' && !init?.method) {
        const jornadas =
          query?.get('cierreAtrasado') === 'true' || query?.get('requiereReasignacion') === 'true'
            ? []
            : [interrupted ? interruptedJourney : active]
        return ok({
          jornadas,
          paginacion: { limite: 12, pagina: 1, paginas: 1, total: jornadas.length },
        })
      }
      if (path === '/jornadas/2029/interrumpir' && init?.method === 'POST') {
        interrupted = true
        return ok({ jornada: interruptedJourney })
      }
      return handler(path, init, query)
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Interrumpir jornada' }))
    const dialog = screen.getByRole('dialog', { name: 'Interrumpir jornada' })
    fireEvent.change(within(dialog).getByLabelText('Motivo operacional'), {
      target: { value: 'El bus perdió potencia durante el recorrido' },
    })
    fireEvent.change(within(dialog).getByLabelText('Por qué falta la lectura'), {
      target: { value: 'Odómetro inaccesible' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/Lectura final: Pendiente/)).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/jornadas/2029/interrumpir' && init?.method === 'POST',
    )
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      motivo: 'El bus perdió potencia durante el recorrido',
      motivoSinLectura: 'Odómetro inaccesible',
    })
    expect(JSON.parse(String(call?.[1]?.body))).not.toHaveProperty('kilometrajeFinal')
  })
  it('prioriza el pendiente sobre una jornada futura y confirma desde Inicio sin precargar odómetro', async () => {
    window.history.pushState({}, '', '/inicio')
    const handler = journeyHandler('CONDUCTOR')
    let started = false
    const pending = {
      ...journeyFixture('PROGRAMADA'),
      lecturaReferencia: { kilometraje: 44000, fechaLectura: '2026-09-01T10:00:00Z' },
    }
    const future = {
      ...pending,
      id: 2099,
      bus: { ...pending.bus, codigoInterno: 'FUTURA-NO-PRIORIZAR' },
    }
    const fetchMock = mockApi(async (path, init, query) => {
      if (path === '/jornadas/mi-jornada')
        return ok({
          jornadaActual: started ? journeyFixture('EN_CURSO') : null,
          jornadaPendiente: started ? null : pending,
          proximaJornada: future,
        })
      if (path.endsWith('/iniciar')) started = true
      return handler(path, init, query)
    })
    render(<App />)
    const button = await screen.findByRole('button', { name: 'Confirmar salida' })
    expect(screen.queryByText(/FUTURA-NO-PRIORIZAR/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    fireEvent.click(button)
    const dialog = screen.getByRole('dialog', { name: 'Confirmar salida' })
    expect(within(dialog).getByLabelText('Lectura observada del odómetro')).toHaveValue(null)
    expect(within(dialog).getByText(/Último odómetro registrado/)).toHaveTextContent(/44[.,]000 km/)
    fireEvent.change(within(dialog).getByLabelText('Lectura observada del odómetro'), {
      target: { value: '45000' },
    })
    const confirm = within(dialog).getByRole('button', { name: 'Confirmar salida' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(await screen.findByRole('button', { name: 'Confirmar llegada' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/inicio')
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) => String(url).endsWith('/iniciar') && init?.method === 'POST',
      ),
    ).toHaveLength(1)
  })

  it('conserva la clave de reintento si se pierde la respuesta de una confirmación', async () => {
    window.history.pushState({}, '', '/jornadas')
    const handler = journeyHandler('CONDUCTOR')
    let attempts = 0
    const keys: Array<string | null> = []
    mockApi(async (path, init, query) => {
      if (path.endsWith('/iniciar')) {
        keys.push(new Headers(init?.headers).get('Idempotency-Key'))
        attempts++
        if (attempts === 1) throw new TypeError('Respuesta perdida')
      }
      return handler(path, init, query)
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar salida' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirmar salida' })
    fireEvent.change(within(dialog).getByLabelText('Lectura observada del odómetro'), {
      target: { value: '45000' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar salida' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Puede reintentar/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar salida' }))
    expect(await screen.findByRole('button', { name: 'Confirmar llegada' })).toBeInTheDocument()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeTruthy()
    expect(keys[0]).toBe(keys[1])
  })

  it('reports an overdue closure without a mileage input or automatic closure', async () => {
    window.history.pushState({}, '', '/jornadas')
    const fetchMock = mockApi(journeyHandler('CONDUCTOR', { overdue: true }))
    render(<App />)
    expect(await screen.findByText('Cierre atrasado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar llegada' })).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Informar que no puedo registrar el cierre' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Informar cierre pendiente' })
    expect(within(dialog).queryByLabelText(/odómetro/i)).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Motivo/i), {
      target: { value: 'No tengo acceso al bus para observar el odómetro.' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar/i }))
    expect(
      await screen.findByText(/Informe enviado a la bandeja interna de Despacho/i),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls
        .filter(([url, init]) => init?.method === 'POST' && !String(url).includes('/auth/'))
        .map(([url]) => String(url)),
    ).toEqual([expect.stringContaining('/informar-cierre-pendiente')])
    expect(
      screen.queryByRole('button', { name: 'Informar que no puedo registrar el cierre' }),
    ).not.toBeInTheDocument()
  })

  it('shows dispatch an independent overdue queue with bus, driver and real closure action', async () => {
    window.history.pushState({}, '', '/jornadas')
    mockApi(journeyHandler('DESPACHADOR', { overdue: true }))
    render(<App />)
    const queue = await screen.findByRole('region', { name: 'Jornadas pendientes de cierre' })
    expect(within(queue).getByText(/BUS-JORNADA-01/)).toBeInTheDocument()
    expect(within(queue).getByText(/Atraso: 25 h/)).toBeInTheDocument()
    expect(
      within(queue).getByRole('button', { name: 'Registrar cierre ahora' }),
    ).toBeInTheDocument()
  })

  it('lets the dispatcher program a journey from controlled options and session authorship', async () => {
    window.history.pushState({}, '', '/jornadas')
    const fetchMock = mockApi(journeyHandler('DESPACHADOR'))

    render(<App />)

    expect(
      (await screen.findAllByRole('heading', { name: /Jornadas operativas/i })).length,
    ).toBeGreaterThan(0)
    expect(
      await screen.findByText(/Recordatorio: el Conductor debe registrar la lectura observada/i),
    ).toBeInTheDocument()
    fireEvent.change(await screen.findByLabelText(/Bus de jornada/i), {
      target: { value: '2007' },
    })
    fireEvent.change(screen.getByLabelText(/Conductor de jornada/i), {
      target: { value: '2071' },
    })
    fireEvent.change(screen.getByLabelText(/Ruta de jornada/i), {
      target: { value: '2065' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Programar jornada/i }))

    expect(await screen.findByText(/^Jornada programada$/i)).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/jornadas' && init?.method === 'POST',
    )
    const body = JSON.parse(String(createCall?.[1]?.body))
    expect(body).toMatchObject({
      busId: 2007,
      conductorId: 2071,
      rutaId: 2065,
    })
    expect(body).not.toHaveProperty('programadaPorId')
    expect(body).not.toHaveProperty('estado')
  })

  it('previsualiza y confirma jornadas individuales del período con una clave estable', async () => {
    window.history.pushState({}, '', '/jornadas')
    const handler = journeyHandler('DESPACHADOR')
    const preview = {
      total: 2,
      aptas: 2,
      puedeConfirmar: true,
      jornadas: [
        {
          fecha: '2026-10-05',
          inicioProgramado: '2026-10-05T11:00:00.000Z',
          finProgramado: '2026-10-05T19:00:00.000Z',
          conflictos: [],
        },
        {
          fecha: '2026-10-06',
          inicioProgramado: '2026-10-06T11:00:00.000Z',
          finProgramado: '2026-10-06T19:00:00.000Z',
          conflictos: [],
        },
      ],
    }
    const fetchMock = mockApi(async (path, init, query) => {
      if (path === '/jornadas/periodo/previsualizar') return ok(preview)
      if (path === '/jornadas/periodo/confirmar')
        return ok({
          creadas: 2,
          jornadas: [
            { id: 1, fecha: '2026-10-05' },
            { id: 2, fecha: '2026-10-06' },
          ],
        })
      return handler(path, init, query)
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Bus del período'), { target: { value: '2007' } })
    fireEvent.change(screen.getByLabelText('Conductor del período'), { target: { value: '2071' } })
    fireEvent.change(screen.getByLabelText('Ruta del período'), { target: { value: '2065' } })
    fireEvent.change(screen.getByLabelText('Inicio del período'), {
      target: { value: '2026-10-05' },
    })
    fireEvent.change(screen.getByLabelText('Fin del período'), { target: { value: '2026-10-06' } })
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar período' }))
    expect(await screen.findByText('2 jornadas propuestas · 2 sin conflictos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar 2 jornadas' }))
    expect(await screen.findByText('2 jornadas programadas por período')).toBeInTheDocument()
    const previewCall = fetchMock.mock.calls.find(
      ([input]) => getPath(input) === '/jornadas/periodo/previsualizar',
    )
    const confirmCall = fetchMock.mock.calls.find(
      ([input]) => getPath(input) === '/jornadas/periodo/confirmar',
    )
    const previewBody = JSON.parse(String(previewCall?.[1]?.body))
    const confirmBody = JSON.parse(String(confirmCall?.[1]?.body))
    expect(previewBody).toMatchObject({
      busId: 2007,
      conductorId: 2071,
      rutaId: 2065,
      fechaInicio: '2026-10-05',
      fechaFin: '2026-10-06',
      diasSemana: [1, 2, 3, 4, 5],
      horaInicio: '06:00',
      horaFin: '14:00',
    })
    expect(confirmBody).toEqual(previewBody)
    expect(confirmBody.claveIdempotencia).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('muestra conflictos del período e invalida la previsualización al cambiar una fecha', async () => {
    window.history.pushState({}, '', '/jornadas')
    const handler = journeyHandler('DESPACHADOR')
    mockApi(async (path, init, query) => {
      if (path === '/jornadas/periodo/previsualizar')
        return ok({
          total: 1,
          aptas: 0,
          puedeConfirmar: false,
          jornadas: [
            {
              fecha: '2026-10-05',
              inicioProgramado: '2026-10-05T11:00:00.000Z',
              finProgramado: '2026-10-05T19:00:00.000Z',
              conflictos: [{ codigo: 'BUS_OCUPADO', mensaje: 'Bus reservado en otra jornada' }],
            },
          ],
        })
      return handler(path, init, query)
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Bus del período'), { target: { value: '2007' } })
    fireEvent.change(screen.getByLabelText('Conductor del período'), { target: { value: '2071' } })
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar período' }))
    expect(await screen.findByText('Bus reservado en otra jornada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar 1 jornadas' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Fin del período'), { target: { value: '2026-10-10' } })
    expect(screen.queryByRole('button', { name: 'Confirmar 1 jornadas' })).not.toBeInTheDocument()
  })

  it('lets the conductor start only the journey returned by the own-session endpoint', async () => {
    window.history.pushState({}, '', '/jornadas')
    const fetchMock = mockApi(journeyHandler('CONDUCTOR'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Confirmar salida/i }))
    expect(
      screen.getByText(/Usted registra la lectura observada del odómetro/i),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Lectura observada del odómetro/i), {
      target: { value: '45000' },
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText(/Salida confirmada con lectura real/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Confirmar llegada/i })).toBeInTheDocument()
    const startCall = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/jornadas/2029/iniciar' && init?.method === 'POST',
    )
    const body = JSON.parse(String(startCall?.[1]?.body))
    expect(body).toMatchObject({ kilometraje: 45000 })
    expect(body).not.toHaveProperty('busId')
    expect(body).not.toHaveProperty('conductorId')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/jornadas/mi-jornada'),
      expect.any(Object),
    )
  })

  it('renders explicit empty and error states for the operational agenda', async () => {
    window.history.pushState({}, '', '/jornadas')
    mockApi(journeyHandler('DESPACHADOR', { empty: true }))
    const emptyRender = render(<App />)
    expect(await screen.findByText(/^Sin jornadas$/i)).toBeInTheDocument()

    emptyRender.unmount()
    vi.restoreAllMocks()
    window.history.pushState({}, '', '/jornadas')
    mockApi(journeyHandler('DESPACHADOR', { fail: true }))
    render(<App />)
    expect(await screen.findByText(/No fue posible cargar las jornadas/i)).toBeInTheDocument()
  })

  it('opens the exact journey linked from an operational novelty', async () => {
    window.history.pushState({}, '', '/jornadas?detalle=2029')
    const fetchMock = mockApi(journeyHandler('DESPACHADOR'))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /Jornada vinculada a novedad/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Revise el impacto operativo de este tramo antes de cambiar recursos/i),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/jornadas/2029'),
      expect.any(Object),
    )
  })

  it('guides a replacement through its operational context and optional academic estimate', async () => {
    window.history.pushState({}, '', '/jornadas')
    const fetchMock = mockApi(journeyHandler('DESPACHADOR'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Cambiar bus o conductor/i }))
    const dialog = screen.getByRole('dialog', { name: /Cambiar bus o conductor/i })

    expect(within(dialog).getByText(/Estado del tramo actual/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/tramo programado reemplazado/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Resumen antes de confirmar/i)).toBeInTheDocument()
    expect(within(dialog).queryByText(/sucesora/i)).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/Motivo del cambio/i), {
      target: { value: 'El conductor debe ser reemplazado antes de iniciar el turno.' },
    })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.change(within(dialog).getByLabelText(/Ciclos completos simulados/i), {
      target: { value: '2' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Kilómetros no comerciales simulados/i), {
      target: { value: '4' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar cambio de tramo/i }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.find(
          ([input, init]) =>
            getPath(input) === '/jornadas/2029/reasignar' && init?.method === 'POST',
        ),
      ).toBeDefined()
    })
    const reassignCall = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/jornadas/2029/reasignar' && init?.method === 'POST',
    )
    expect(JSON.parse(String(reassignCall?.[1]?.body))).toMatchObject({
      motivo: 'El conductor debe ser reemplazado antes de iniciar el turno.',
      simulacion: { ciclosCompletosSimulados: 2, kmNoComercialesSimulados: 4 },
    })
  })

  it('keeps the optional academic estimate editable and normalizes an empty non-commercial value to zero', async () => {
    window.history.pushState({}, '', '/jornadas')
    mockApi(journeyHandler('DESPACHADOR'))

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/Ruta de jornada/i), {
      target: { value: '2065' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /Usar proyección simulada SGMV/i }))
    const nonCommercial = screen.getByLabelText(/Km no comerciales simulados/i)
    fireEvent.change(nonCommercial, { target: { value: '' } })
    fireEvent.blur(nonCommercial)
    expect(nonCommercial).toHaveValue(0)

    fireEvent.change(nonCommercial, { target: { value: '4' } })
    expect(nonCommercial).toHaveValue(4)
  })
})
