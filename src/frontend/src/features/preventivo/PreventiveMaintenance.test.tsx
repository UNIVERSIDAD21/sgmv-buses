// Preventive maintenance module regression
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockApi, preventiveHandler } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RF-03 preventive maintenance frontend', () => {
  it('loads the administrative preventive list with summary, filters and pagination', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByRole(
        'heading',
        {
          name: /^Administracion del mantenimiento preventivo$/i,
        },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument()
    expect((await screen.findAllByText('ABC123')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Revision preventiva/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Proximo/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Vigente/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Vencido/i).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText(/Buscar por actividad/i), {
      target: { value: 'frenos' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('busqueda=frenos'),
        expect.any(Object),
      )
    })

    fireEvent.change(screen.getByLabelText(/^Criterio$/i), {
      target: { value: 'KILOMETRAJE' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('criterio=KILOMETRAJE'),
        expect.any(Object),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /^Vencido$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('estado=VENCIDO'),
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

  it('creates preventive schedules by date, mileage and combined criteria with validation', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Crear programacion/i }))
    const dateDialog = await screen.findByRole('dialog', {
      name: /Crear programacion preventiva/i,
    })

    fireEvent.change(within(dateDialog).getByLabelText(/^Bus$/i), { target: { value: 'bus-1' } })
    fireEvent.change(within(dateDialog).getByLabelText(/^Tipo$/i), {
      target: { value: 'Revision mensual' },
    })
    fireEvent.change(within(dateDialog).getByLabelText(/^Actividad$/i), {
      target: { value: 'Revision preventiva mensual por fecha.' },
    })
    fireEvent.click(within(dateDialog).getByRole('button', { name: /Registrar programacion/i }))
    expect(await screen.findByText(/Seleccione una fecha programada/i)).toBeInTheDocument()

    fireEvent.change(within(dateDialog).getByLabelText(/Fecha programada/i), {
      target: { value: '2026-09-05' },
    })
    fireEvent.click(within(dateDialog).getByRole('button', { name: /Registrar programacion/i }))
    fireEvent.click(within(dateDialog).getByRole('button', { name: /Registrar programacion/i }))
    expect(await screen.findByText(/Programacion preventiva registrada/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Crear programacion/i }))
    const mileageDialog = await screen.findByRole('dialog', {
      name: /Crear programacion preventiva/i,
    })
    fireEvent.change(within(mileageDialog).getByLabelText(/^Bus$/i), {
      target: { value: 'bus-1' },
    })
    fireEvent.change(within(mileageDialog).getByLabelText(/^Criterio$/i), {
      target: { value: 'KILOMETRAJE' },
    })
    fireEvent.change(within(mileageDialog).getByLabelText(/^Tipo$/i), {
      target: { value: 'Cambio aceite' },
    })
    fireEvent.change(within(mileageDialog).getByLabelText(/Kilometraje objetivo/i), {
      target: { value: '12000' },
    })
    fireEvent.change(within(mileageDialog).getByLabelText(/^Actividad$/i), {
      target: { value: 'Cambio preventivo de aceite por kilometraje.' },
    })
    fireEvent.click(within(mileageDialog).getByRole('button', { name: /Registrar programacion/i }))

    expect(await screen.findByText(/Programacion preventiva registrada/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Crear programacion/i }))
    const combinedDialog = await screen.findByRole('dialog', {
      name: /Crear programacion preventiva/i,
    })
    fireEvent.change(within(combinedDialog).getByLabelText(/^Bus$/i), {
      target: { value: 'bus-1' },
    })
    fireEvent.change(within(combinedDialog).getByLabelText(/^Criterio$/i), {
      target: { value: 'FECHA_KILOMETRAJE' },
    })
    fireEvent.change(within(combinedDialog).getByLabelText(/^Tipo$/i), {
      target: { value: 'Frenos' },
    })
    fireEvent.change(within(combinedDialog).getByLabelText(/Fecha programada/i), {
      target: { value: '2026-09-06' },
    })
    fireEvent.change(within(combinedDialog).getByLabelText(/Kilometraje objetivo/i), {
      target: { value: '12100' },
    })
    fireEvent.change(within(combinedDialog).getByLabelText(/^Actividad$/i), {
      target: { value: 'Revision combinada de frenos por fecha y kilometraje.' },
    })
    fireEvent.click(within(combinedDialog).getByRole('button', { name: /Registrar programacion/i }))

    expect(await screen.findByText(/Programacion preventiva registrada/i)).toBeInTheDocument()

    const createCalls = fetchMock.mock.calls.filter(
      ([input, init]) =>
        String(input).includes('/mantenimiento-preventivo/programaciones') &&
        init?.method === 'POST',
    )

    expect(createCalls).toHaveLength(3)
    expect(String(createCalls[0][1]?.body)).toContain('FECHA')
    expect(String(createCalls[1][1]?.body)).toContain('KILOMETRAJE')
    expect(String(createCalls[2][1]?.body)).toContain('FECHA_KILOMETRAJE')
    expect(String(createCalls[0][1]?.body)).not.toContain('kilometrajeActual')
  })

  it('opens detail, shows remaining values, reprograms and generates a preventive order', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    fireEvent.click(
      await screen.findAllByRole('button', { name: /Detalle/i }).then((buttons) => buttons[0]),
    )
    expect(await screen.findByText(/Detalle preventivo/i)).toBeInTheDocument()
    expect(screen.getByText('500 km')).toBeInTheDocument()
    expect(screen.getByText(/Sin orden preventiva activa/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Reprogramar/i }))
    const reprogramDialog = await screen.findByRole('dialog', {
      name: /Reprogramar mantenimiento/i,
    })
    fireEvent.change(within(reprogramDialog).getByLabelText(/Kilometraje objetivo/i), {
      target: { value: '11600' },
    })
    fireEvent.click(within(reprogramDialog).getByRole('button', { name: /Guardar cambios/i }))
    expect(await screen.findByText(/Programacion preventiva actualizada/i)).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Generar orden/i }))
    const orderDialog = await screen.findByRole('dialog', { name: /Generar orden preventiva/i })
    expect(within(orderDialog).getByText(/RF-04/i)).toBeInTheDocument()
    fireEvent.change(within(orderDialog).getByLabelText(/^Prioridad$/i), {
      target: { value: 'MEDIA' },
    })
    fireEvent.change(within(orderDialog).getByLabelText(/^Observacion$/i), {
      target: { value: 'Generar orden preventiva elegible.' },
    })
    fireEvent.click(within(orderDialog).getByRole('button', { name: /Crear orden/i }))

    expect(
      await screen.findByText(/Orden preventiva OT-PREV-001 generada en estado pendiente/i),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Orden preventiva activa/i)).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mantenimiento-preventivo/programaciones/prev-1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mantenimiento-preventivo/programaciones/prev-1/generar-orden'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows empty and error states for preventive administration', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('ADMINISTRADOR', { empty: true }))

    render(<App />)

    expect(await screen.findByText(/Sin resultados/i)).toBeInTheDocument()

    vi.restoreAllMocks()
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('ADMINISTRADOR', { failList: true }))

    render(<App />)

    expect(await screen.findByText(/Fallo preventivo controlado/i)).toBeInTheDocument()
  })

  it('denies conductor and mechanic access to RF-03 administrative controls', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Crear programacion/i })).not.toBeInTheDocument()

    vi.restoreAllMocks()
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('MECANICO'))

    render(<App />)

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
  })

  it('administers plans with an XOR destination, versioning and inactivation', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Planes recurrentes/i }))
    expect(await screen.findByText('FRENOS.001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Crear plan$/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Clave de tarea/i), {
      target: { value: 'ACEITE.001' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Componente/i), { target: { value: 'Motor' } })
    fireEvent.change(within(dialog).getByLabelText(/Actividad/i), {
      target: { value: 'Cambio preventivo de aceite del motor.' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Intervalo dias/i), { target: { value: '30' } })
    fireEvent.change(within(dialog).getByLabelText(/Bus destino/i), { target: { value: 'bus-1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Crear plan$/i }))
    expect(await screen.findByText(/Plan preventivo registrado/i)).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/mantenimiento-preventivo/planes') && init?.method === 'POST',
    )
    expect(String(createCall?.[1]?.body)).toContain('bus-1')
    expect(String(createCall?.[1]?.body)).not.toContain('modeloBusId')

    fireEvent.click(screen.getByRole('button', { name: /^Aplicar$/i }))
    const applyDialog = await screen.findByRole('dialog', { name: /Aplicar plan preventivo/i })
    fireEvent.click(within(applyDialog).getByRole('button', { name: /^Aplicar plan$/i }))
    expect(await screen.findByText(/objetivos derivados correctamente/i)).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith('/mantenimiento-preventivo/programaciones') &&
          init?.method === 'POST' &&
          String(init.body).includes('"planId":"plan-1"'),
      ),
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /^Versiones$/i }))
    expect(
      await screen.findByRole('dialog', { name: /Versiones del plan preventivo/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Cerrar diálogo$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^Versionar$/i }))
    expect(await screen.findByText(/Versionar FRENOS.001/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Crear version$/i }))
    expect(await screen.findByText(/Nueva version registrada/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Inactivar$/i }))
    expect(await screen.findByText(/Plan FRENOS.001 inactivado/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Restricciones$/i }))
    expect(
      await screen.findByRole('heading', { name: /Restricciones preventivas/i }),
    ).toBeInTheDocument()
  })

  it('shows only the operational restriction projection to dispatchers', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('DESPACHADOR'))
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: /Restricciones preventivas/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Bloquea despacho/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Crear plan|Versionar|Inactivar/i }),
    ).not.toBeInTheDocument()
  })
})
