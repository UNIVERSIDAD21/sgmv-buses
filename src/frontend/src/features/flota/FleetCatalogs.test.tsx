// Fleet catalogs module regression
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockApi, fleetCatalogHandler } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('P3 fleet catalogs frontend', () => {
  it('loads catalogs and lets an administrator edit a model and a route', async () => {
    window.history.pushState({}, '', '/flota/catalogos')
    const fetchMock = mockApi(fleetCatalogHandler())

    render(<App />)

    expect(await screen.findByText(/Mercedes-Benz OF-1721/i)).toBeInTheDocument()
    expect(screen.getByText(/RUTA-CENTRO-NORTE/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mostrar inactivos/i)).toBeInTheDocument()

    const modelArticle = screen.getByText(/Mercedes-Benz OF-1721/i).closest('article')!
    fireEvent.click(within(modelArticle).getByRole('button', { name: /Editar/i }))
    expect(await screen.findByDisplayValue('Mercedes-Benz')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Nombre del modelo/i), {
      target: { value: 'OF-1722' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar modelo/i }))
    expect(await screen.findByText(/Modelo de bus actualizado/i)).toBeInTheDocument()

    const routeArticle = screen.getByText(/RUTA-CENTRO-NORTE/i).closest('article')!
    fireEvent.click(within(routeArticle).getByRole('button', { name: /Editar/i }))
    fireEvent.change(screen.getByLabelText(/^Destino$/i), { target: { value: 'Terminal Sur' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar ruta/i }))
    expect(await screen.findByText(/Ruta actualizada/i)).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/modelos-bus/model-1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/rutas/route-1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('shows read-only operational catalogs to the dispatcher', async () => {
    window.history.pushState({}, '', '/flota/catalogos')
    mockApi(fleetCatalogHandler('DESPACHADOR'))

    render(<App />)

    expect(await screen.findByText(/Mercedes-Benz OF-1721/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar modelo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Inactivar/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Mostrar inactivos/i)).not.toBeInTheDocument()
  })

  it('renders explicit empty and error states for catalogs', async () => {
    window.history.pushState({}, '', '/flota/catalogos')
    mockApi(fleetCatalogHandler('ADMINISTRADOR', { empty: true }))

    const firstRender = render(<App />)
    expect(await screen.findByText(/Sin modelos disponibles/i)).toBeInTheDocument()
    expect(screen.getByText(/Sin rutas disponibles/i)).toBeInTheDocument()

    firstRender.unmount()
    vi.restoreAllMocks()
    mockApi(fleetCatalogHandler('ADMINISTRADOR', { fail: true }))
    render(<App />)

    expect(await screen.findByText(/No fue posible cargar los catalogos/i)).toBeInTheDocument()
  })
})
