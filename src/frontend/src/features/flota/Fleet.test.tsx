// Fleet module regression
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  userForRole,
  ok,
  apiError,
  getPath,
  mockApi,
  fleetBus,
  catalogModel,
  fleetSummary,
  fleetList,
  fleetHandler,
  journeyHandler,
} from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RF-01 fleet frontend', () => {
  it('loads fleet list with search, filter and pagination', async () => {
    window.history.pushState({}, '', '/flota')
    const fetchMock = mockApi(fleetHandler())

    render(<App />)

    expect(await screen.findByText('BUS-001')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText(/1 resultado/i)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/Buscar por codigo o placa/i), {
      target: { value: 'ABC' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('busqueda=ABC'),
        expect.any(Object),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /Operativo/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('estado=OPERATIVO'),
        expect.any(Object),
      )
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Siguiente/i })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('pagina=2'),
        expect.any(Object),
      )
    })
  })

  it('opens bus detail and completes mileage and state actions without legacy assignment writes', async () => {
    window.history.pushState({}, '', '/flota')
    const fetchMock = mockApi(fleetHandler())

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Detalle/i }))
    expect(await screen.findByText(/Detalle de bus/i)).toBeInTheDocument()
    expect(screen.getByText(/Ultimas lecturas/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Kilometraje/i }))
    fireEvent.change(screen.getByLabelText(/Nueva lectura/i), { target: { value: '12000' } })
    fireEvent.change(screen.getByLabelText(/^Motivo$/i), {
      target: { value: 'Lectura validada' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
    expect(await screen.findByText(/Kilometraje registrado/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Estado$/i }))
    fireEvent.change(screen.getByLabelText(/Estado nuevo/i), {
      target: { value: 'EN_MANTENIMIENTO' },
    })
    fireEvent.change(screen.getByLabelText(/^Motivo$/i), {
      target: { value: 'Revision programada' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
    expect(await screen.findByText(/Estado actualizado/i)).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: /Asignar/i })).not.toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/buses/bus-1/kilometraje'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/buses/bus-1/estado'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          getPath(input) === '/flota/buses/bus-1/asignaciones' && init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('shows empty and error states for the fleet list', async () => {
    window.history.pushState({}, '', '/flota')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      if (path === '/flota/resumen') {
        return ok(fleetSummary())
      }

      if (path === '/flota/buses') {
        return ok(fleetList({ buses: [] }))
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Sin resultados/i)).toBeInTheDocument()

    vi.restoreAllMocks()
    window.history.pushState({}, '', '/flota')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      if (path === '/flota/resumen') {
        return ok(fleetSummary())
      }

      if (path === '/flota/buses') {
        return apiError(500, 'INTERNAL_ERROR', 'Fallo controlado')
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/No fue posible cargar/i)).toBeInTheDocument()
  })

  it('registers a bus and shows backend duplicate errors', async () => {
    window.history.pushState({}, '', '/flota/nuevo')
    let duplicate = false
    const fetchMock = mockApi(async (path, init) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      if (path === '/flota/resumen') {
        return ok(fleetSummary())
      }

      if (path === '/flota/modelos-bus' && !init?.method) {
        return ok({ modelosBus: [catalogModel] })
      }

      if (path === '/flota/buses' && init?.method === 'POST') {
        if (duplicate) {
          return apiError(409, 'DUPLICATE_BUS_IDENTIFIER', 'La placa ya esta registrada')
        }

        duplicate = true
        return ok({ bus: fleetBus })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Guardar/i }))
    expect(await screen.findByText(/El codigo interno es obligatorio/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Codigo interno/i), { target: { value: 'bus-001' } })
    fireEvent.change(screen.getByLabelText(/Placa/i), { target: { value: 'abc123' } })
    fireEvent.change(screen.getByLabelText(/^Marca$/i), { target: { value: 'Mercedes' } })
    fireEvent.change(screen.getByLabelText(/^Modelo$/i), { target: { value: 'Padron' } })
    fireEvent.change(await screen.findByLabelText(/Modelo tecnico normalizado/i), {
      target: { value: 'model-1' },
    })
    fireEvent.change(screen.getByLabelText(/Anio/i), { target: { value: '2022' } })
    fireEvent.change(screen.getByLabelText(/Kilometraje actual/i), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    expect(await screen.findByText(/Bus registrado/i)).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/flota/buses' && init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({ modeloBusId: 'model-1' })

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))
    expect(await screen.findByText(/La placa ya esta registrada/i)).toBeInTheDocument()
  })

  it('edits a bus through the real PATCH endpoint', async () => {
    window.history.pushState({}, '', '/flota/bus-1/editar')
    const fetchMock = mockApi(fleetHandler())

    render(<App />)

    expect(await screen.findByDisplayValue('Mercedes')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Marca$/i), { target: { value: 'Volvo' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    expect(await screen.findByText(/Bus actualizado/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/buses/bus-1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('limits the driver operational view to the journey derived from session', async () => {
    window.history.pushState({}, '', '/jornadas')
    mockApi(journeyHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Mi jornada/i)).toBeInTheDocument()
    expect(await screen.findByText(/BUS-JORNADA-01/i)).toBeInTheDocument()
    expect(screen.queryByText(/Registrar bus/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Iniciar jornada/i })).toBeInTheDocument()
  })

  it('shows the driver journey empty state and denies mechanic access to RF-01', async () => {
    window.history.pushState({}, '', '/jornadas')
    mockApi(journeyHandler('CONDUCTOR', { empty: true }))

    render(<App />)

    expect(await screen.findByText(/Sin jornada asignada/i)).toBeInTheDocument()

    vi.restoreAllMocks()
    window.history.pushState({}, '', '/flota')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('MECANICO') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
  })
})
