// History and reports module regression
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockApi, historyHandler } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RF-06 history and reports frontend', () => {
  it('loads the administrative history, filters, detail and three derived reports', async () => {
    window.history.pushState({}, '', '/historial')
    const fetchMock = mockApi(historyHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /Historial e informes/i }, { timeout: 5_000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Toda la flota y los informes administrativos/i)).toBeInTheDocument()
    expect((await screen.findAllByText('BUS-RF06-001')).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /^Informes administrativos$/i })).toBeInTheDocument()
    expect(screen.getByText(/Repuestos utilizados/i)).toBeInTheDocument()
    expect(screen.getByText(/Costos por bus/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Tipo de orden/i), {
      target: { value: 'PREVENTIVA' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Aplicar filtros/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('tipo=PREVENTIVA'),
        expect.any(Object),
      )
    })

    fireEvent.click((await screen.findAllByRole('button', { name: /Ver detalle/i }))[0])
    expect(await screen.findByText(/Línea de tiempo de mantenimiento/i)).toBeInTheDocument()
    expect(await screen.findByText(/Desgaste de pastillas delanteras/i)).toBeInTheDocument()
    expect(screen.getByText(/Asignaciones de conductor/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Jornadas y kilometraje contextual/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Novedad crítica reportada/i)).toBeInTheDocument()
    expect(screen.getByText(/Compatibilidad: COMPATIBLE/i)).toBeInTheDocument()
    expect(screen.getByText(/Movimiento CONSUMO/i)).toBeInTheDocument()
  })

  it('shows mechanics only their technical history without administrative costs or reports', async () => {
    window.history.pushState({}, '', '/historial')
    mockApi(historyHandler('MECANICO'))

    render(<App />)

    expect(await screen.findByText(/Historial técnico autorizado/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Buses con órdenes asignadas o intervenciones propias/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Informes administrativos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Costo acumulado/i)).not.toBeInTheDocument()

    fireEvent.click((await screen.findAllByRole('button', { name: /Ver detalle/i }))[0])
    expect(await screen.findByText(/Desgaste de pastillas delanteras/i)).toBeInTheDocument()
    expect(await screen.findByText(/REP-RF06-001/i)).toBeInTheDocument()
    expect(screen.queryByText(/Asignaciones de conductor/i)).not.toBeInTheDocument()
  })

  it('shows dispatchers only operational traceability without diagnostics or costs', async () => {
    window.history.pushState({}, '', '/historial')
    mockApi(historyHandler('DESPACHADOR'))

    render(<App />)

    expect(await screen.findByText(/Trazabilidad operativa de la flota/i)).toBeInTheDocument()
    fireEvent.click((await screen.findAllByRole('button', { name: /Ver detalle/i }))[0])
    expect(await screen.findByText(/Centro norte/i)).toBeInTheDocument()
    expect(screen.getByText(/bus disponible/i)).toBeInTheDocument()
    expect(screen.queryByText(/Desgaste de pastillas delanteras/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/REP-RF06-001/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Costo acumulado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Informes administrativos/i)).not.toBeInTheDocument()
  })

  it('loads the driver bus from the dedicated endpoint and keeps private technical data hidden', async () => {
    window.history.pushState({}, '', '/historial')
    const fetchMock = mockApi(historyHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Historial de mi bus asignado/i)).toBeInTheDocument()
    expect(await screen.findByText(/Vibración leve al frenar/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Buscar bus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Desgaste de pastillas delanteras/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/REP-RF06-001/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Informes administrativos/i)).not.toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/historial/mi-bus'),
      expect.any(Object),
    )
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/historial/buses?')),
    ).toBe(false)
  })

  it('shows a clear empty state when the driver has no active assignment', async () => {
    window.history.pushState({}, '', '/historial')
    mockApi(historyHandler('CONDUCTOR', { noAssignment: true }))

    render(<App />)

    expect(await screen.findByText(/Sin bus asignado actualmente/i)).toBeInTheDocument()
    expect(screen.getByText(/no acepta identificadores de bus/i)).toBeInTheDocument()
  })
})
