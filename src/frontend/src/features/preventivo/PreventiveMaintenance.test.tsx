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
  it.each([
    ['PENDIENTE_ASIGNACION', /Abre la orden y asigna un Mecánico/i],
    ['ASIGNADA', /Mecánico debe ejecutar/i],
    ['EN_EJECUCION', /Mecánico debe ejecutar/i],
    ['DEVUELTA_CORRECCION', /Mecánico debe corregir/i],
    ['COMPLETADA_TECNICO', /Revisa el trabajo y cierra/i],
  ])(
    'guides the next responsible actor for %s without offering a duplicate',
    async (orderStatus, guidance) => {
      window.history.pushState({}, '', '/mantenimiento-preventivo?detalle=2056')
      mockApi(preventiveHandler('ADMINISTRADOR', { orderStatus: String(orderStatus) }))
      render(<App />)
      const dialog = await screen.findByRole('dialog', { name: /Detalle preventivo/i })
      expect(within(dialog).getByText(guidance)).toBeInTheDocument()
      expect(within(dialog).getByRole('link', { name: /Abrir orden/i })).toHaveAttribute(
        'href',
        '/ordenes-trabajo?detalle=2044',
      )
      expect(
        within(dialog).queryByRole('button', { name: /Generar orden|Reprogramar/i }),
      ).not.toBeInTheDocument()
    },
  )

  it('loads the administrative preventive list with summary, filters and pagination', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByRole(
        'heading',
        {
          name: /^Gestión del mantenimiento preventivo$/i,
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

  it('applies the dashboard filter for maintenance that requires attention', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo?requiereAtencion=true')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByText(
        /Mostrando mantenimientos próximos o vencidos que requieren seguimiento/i,
      ),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('requiereAtencion=true'),
        expect.any(Object),
      )
    })
  })

  it('highlights the exact preventive restriction linked from an alert for dispatch', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo?detalle=2056&desde=alertas')
    mockApi(preventiveHandler('DESPACHADOR'))

    render(<App />)

    expect(
      await screen.findByRole('article', {
        name: /Mantenimiento preventivo 2056, origen de la alerta/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver a alertas/i })).toHaveAttribute(
      'href',
      '/alertas',
    )
  })

  it('opens the exact preventive schedule received through an operational deep link', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo?detalle=2056')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    expect(await screen.findByText(/Detalle preventivo/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mantenimiento-preventivo/programaciones/2056'),
      expect.any(Object),
    )
  })

  it('creates preventive schedules by date, mileage and combined criteria with validation', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Programar mantenimiento/i }))
    const dateDialog = await screen.findByRole('dialog', {
      name: /Crear programacion preventiva/i,
    })

    fireEvent.change(within(dateDialog).getByLabelText(/^Bus$/i), { target: { value: '2006' } })
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

    fireEvent.click(screen.getByRole('button', { name: /Programar mantenimiento/i }))
    const mileageDialog = await screen.findByRole('dialog', {
      name: /Crear programacion preventiva/i,
    })
    fireEvent.change(within(mileageDialog).getByLabelText(/^Bus$/i), {
      target: { value: '2006' },
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

    fireEvent.click(screen.getByRole('button', { name: /Programar mantenimiento/i }))
    const combinedDialog = await screen.findByRole('dialog', {
      name: /Crear programacion preventiva/i,
    })
    fireEvent.change(within(combinedDialog).getByLabelText(/^Bus$/i), {
      target: { value: '2006' },
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
    expect(within(orderDialog).getByText(/orden técnica activa/i)).toBeInTheDocument()
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
      expect.stringContaining('/mantenimiento-preventivo/programaciones/2056'),
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mantenimiento-preventivo/programaciones/2056/generar-orden'),
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
    expect(
      screen.queryByRole('button', { name: /Programar mantenimiento/i }),
    ).not.toBeInTheDocument()

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

    fireEvent.click(await screen.findByRole('button', { name: /Rutinas de mantenimiento/i }))
    expect(await screen.findByText('FRENOS.001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Crear rutina$/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/identificador interno.*generar\u00e1/i)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Clave de tarea/i)).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Componente del veh\u00edculo/i), {
      target: { value: 'Motor' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Actividad que se realizar\u00e1/i), {
      target: { value: 'Cambio preventivo de aceite del motor.' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Repetir cada \(d\u00edas\)/i), {
      target: { value: '30' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Bus destino/i), { target: { value: '2006' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Crear rutina$/i }))
    expect(await screen.findByText(/Rutina de mantenimiento registrada/i)).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/mantenimiento-preventivo/planes') && init?.method === 'POST',
    )
    expect(String(createCall?.[1]?.body)).toContain('2006')
    expect(String(createCall?.[1]?.body)).not.toContain('modeloBusId')
    expect(String(createCall?.[1]?.body)).not.toContain('claveTarea')

    expect(screen.queryByRole('button', { name: /Asignar a buses/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Aplica únicamente a:/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Versiones$/i }))
    expect(
      await screen.findByRole('dialog', { name: /Versiones del plan preventivo/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Cerrar diálogo$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^Nueva versión$/i }))
    expect(await screen.findByText(/Crear nueva versión de FRENOS.001/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Guardar nueva versión$/i }))
    expect(await screen.findByText(/Nueva versión de la rutina registrada/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Dejar de usar$/i }))
    const deactivateDialog = await screen.findByRole('dialog', {
      name: /Dejar de usar esta rutina/i,
    })
    fireEvent.click(
      within(deactivateDialog).getByRole('checkbox', {
        name: /Confirmo que deseo dejar de usar/i,
      }),
    )
    fireEvent.click(within(deactivateDialog).getByRole('button', { name: /Dejar de usar rutina/i }))
    expect(
      await screen.findByText(/La rutina FRENOS.001 dejó de usarse para nuevas asignaciones/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Motivos que impiden operar/i }))
    expect(
      await screen.findByRole('heading', { name: /Motivos preventivos que impiden operar/i }),
    ).toBeInTheDocument()
  })

  it('explains version history and the impact of leaving a routine unused', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('ADMINISTRADOR'))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Rutinas de mantenimiento/i }))
    await screen.findByText('FRENOS.001')
    fireEvent.click(screen.getByRole('button', { name: /Nueva versi.n/i }))
    expect(await screen.findByText(/Nueva version sin perder historial/i)).toBeInTheDocument()
    expect(screen.getByText(/Comparacion antes y despues/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cerrar di.log/i }))

    fireEvent.click(screen.getByRole('button', { name: /^Dejar de usar$/i }))
    const deactivateDialog = await screen.findByRole('dialog', {
      name: /Dejar de usar esta rutina/i,
    })
    expect(
      within(deactivateDialog).getByText(/Actualmente hay 1 mantenimiento programado activo/i),
    ).toBeInTheDocument()
  })

  it('shows the target and opens an existing scheduled maintenance without duplication', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('ADMINISTRADOR', { planAlreadyExists: true, modelPlan: true }))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Rutinas de mantenimiento/i }))
    fireEvent.click(
      await screen.findByRole('button', { name: /^Asignar a buses de este modelo$/i }),
    )
    const dialog = await screen.findByRole('dialog', { name: /Asignar a buses de este modelo/i })
    expect(within(dialog).getByText(/Buses no elegibles \(0\)/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Seleccionar todos/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Revisar programación/i }))
    expect(
      await within(dialog).findByText(/Se crearán 0 programaciones para 1 buses/i),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/Ya programado; se conserva/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar programaciones/i }))
    expect(
      await screen.findByText(/0 programaciones creadas. 1 existentes conservadas/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Abrir mantenimiento programado/i }))
    expect(await screen.findByRole('heading', { name: /Detalle preventivo/i })).toBeInTheDocument()
  })

  it('shows only the operational restriction projection to dispatchers', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('DESPACHADOR'))
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: /Motivos preventivos que impiden operar/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/impide nuevas jornadas/i)).toBeInTheDocument()
    expect(screen.getByText(/Mantenimiento preventivo programado/i)).toBeInTheDocument()
    expect(screen.queryByText(/Revision preventiva de frenos/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Abrir mantenimiento programado/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Crear rutina|Nueva versión|Dejar de usar/i }),
    ).not.toBeInTheDocument()
  })

  it('lets administrators open the scheduled maintenance behind an operational restriction', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(preventiveHandler('ADMINISTRADOR'))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Motivos que impiden operar/i }))
    expect(await screen.findByText(/Revision preventiva de frenos/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Abrir mantenimiento programado/i }))
    expect(await screen.findByRole('heading', { name: /Detalle preventivo/i })).toBeInTheDocument()
  })
})
