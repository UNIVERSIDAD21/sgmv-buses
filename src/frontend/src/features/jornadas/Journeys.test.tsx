// Operational journeys module regression
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPath, mockApi, journeyHandler } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('P4 journey frontend', () => {
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

  it('lets the conductor start only the journey returned by the own-session endpoint', async () => {
    window.history.pushState({}, '', '/jornadas')
    const fetchMock = mockApi(journeyHandler('CONDUCTOR'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Iniciar jornada/i }))
    expect(
      screen.getByText(/Usted registra la lectura observada del odómetro/i),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Lectura observada del odómetro/i), {
      target: { value: '45000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText(/Jornada iniciada con lectura inicial/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Finalizar jornada/i })).toBeInTheDocument()
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
