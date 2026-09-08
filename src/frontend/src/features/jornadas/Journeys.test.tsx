// Operational journeys module regression
import { fireEvent, render, screen } from '@testing-library/react'
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
    fireEvent.change(await screen.findByLabelText(/Bus de jornada/i), {
      target: { value: 'bus-journey-1' },
    })
    fireEvent.change(screen.getByLabelText(/Conductor de jornada/i), {
      target: { value: 'user-conductor' },
    })
    fireEvent.change(screen.getByLabelText(/Ruta de jornada/i), {
      target: { value: 'route-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Programar jornada/i }))

    expect(await screen.findByText(/^Jornada programada$/i)).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/jornadas' && init?.method === 'POST',
    )
    const body = JSON.parse(String(createCall?.[1]?.body))
    expect(body).toMatchObject({
      busId: 'bus-journey-1',
      conductorId: 'user-conductor',
      rutaId: 'route-1',
    })
    expect(body).not.toHaveProperty('programadaPorId')
    expect(body).not.toHaveProperty('estado')
  })

  it('lets the conductor start only the journey returned by the own-session endpoint', async () => {
    window.history.pushState({}, '', '/jornadas')
    const fetchMock = mockApi(journeyHandler('CONDUCTOR'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Iniciar jornada/i }))
    fireEvent.change(screen.getByLabelText(/^Kilometraje/i), { target: { value: '45000' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText(/Jornada iniciada con lectura inicial/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Finalizar jornada/i })).toBeInTheDocument()
    const startCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        getPath(input) === '/jornadas/journey-1/iniciar' && init?.method === 'POST',
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
})
