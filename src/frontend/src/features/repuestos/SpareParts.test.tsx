// Spare parts module regression
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPath, mockApi, fleetBus, sparePartHandler } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RF-05 spare parts frontend', () => {
  it('loads the administrative central with summary, catalog, filters and RF-04 movement references', async () => {
    window.history.pushState({}, '', '/repuestos')
    const fetchMock = mockApi(sparePartHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      (await screen.findAllByRole('heading', { name: /Central de repuestos/i })).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Central de repuestos/i }).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('REP-FRENO-001')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Disponible/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Bajo/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Agotado/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Inactivo/i)).length).toBeGreaterThan(0)
    expect(await screen.findByText('OT-RF04-001')).toBeInTheDocument()

    fireEvent.change(screen.getAllByLabelText(/^Buscar$/i)[0], {
      target: { value: 'freno' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('busqueda=freno'),
        expect.any(Object),
      )
    })

    fireEvent.change(screen.getByLabelText(/^Disponibilidad$/i), {
      target: { value: 'BAJO' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('disponibilidad=BAJO'),
        expect.any(Object),
      )
    })

    fireEvent.change(screen.getAllByLabelText(/^Buscar$/i)[1], {
      target: { value: 'OT-RF04' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/inventario/movimientos?'),
        expect.any(Object),
      )
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('busqueda=OT-RF04'),
        expect.any(Object),
      )
    })
  })

  it.each(['MECANICO', 'CONDUCTOR'] as RoleCode[])(
    'keeps %s out of the RF-05 administrative route and navigation',
    async (role) => {
      window.history.pushState({}, '', '/repuestos')
      mockApi(sparePartHandler(role))

      render(<App />)

      expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Central de repuestos/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Nuevo repuesto/i })).not.toBeInTheDocument()
    },
  )

  it('shows empty and recoverable error states', async () => {
    window.history.pushState({}, '', '/repuestos')
    mockApi(sparePartHandler('ADMINISTRADOR', { empty: true }))

    const { unmount } = render(<App />)

    expect(await screen.findByText(/Sin repuestos para mostrar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Limpiar filtros/i })).toBeInTheDocument()

    unmount()
    window.history.pushState({}, '', '/repuestos')
    mockApi(sparePartHandler('ADMINISTRADOR', { failList: true }))
    render(<App />)

    expect(await screen.findByText(/Fallo RF-05 controlado/i)).toBeInTheDocument()
  })

  it('creates a spare part with initial stock, validates input and blocks duplicate submission', async () => {
    window.history.pushState({}, '', '/repuestos')
    const fetchMock = mockApi(sparePartHandler('ADMINISTRADOR', { slowCreate: true }))

    render(<App />)

    expect((await screen.findAllByText('REP-FRENO-001')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo repuesto/i }))

    const dialog = await screen.findByRole('dialog', { name: /Nuevo repuesto/i })
    fireEvent.change(within(dialog).getByLabelText(/^Codigo$/i), {
      target: { value: ' rf05-demo ' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^Nombre$/i), {
      target: { value: ' Kit de filtros ' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^Stock inicial$/i), {
      target: { value: '-1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Crear repuesto/i }))
    expect(
      await within(dialog).findByText(/Stock y costo deben ser valores validos/i),
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/^Categoria$/i), {
      target: { value: 'Filtros' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^Unidad de medida$/i), {
      target: { value: 'unidad' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^Stock inicial$/i), {
      target: { value: '5' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^Stock minimo$/i), {
      target: { value: '2' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^Costo unitario$/i), {
      target: { value: '76000.50' },
    })
    fireEvent.change(await within(dialog).findByLabelText(/Motivo de stock inicial/i), {
      target: { value: 'Carga inicial autorizada' },
    })

    const submit = within(dialog).getByRole('button', { name: /Crear repuesto/i })
    fireEvent.click(submit)
    await waitFor(() => expect(submit).toBeDisabled())
    fireEvent.click(submit)

    expect(await screen.findByText(/Repuesto creado/i)).toBeInTheDocument()
    expect((await screen.findAllByText('RF05-DEMO')).length).toBeGreaterThan(0)

    const createCalls = fetchMock.mock.calls.filter(
      ([input, init]) => String(input).endsWith('/repuestos') && init?.method === 'POST',
    )
    expect(createCalls).toHaveLength(1)
    const body = JSON.parse(String(createCalls[0][1]?.body)) as {
      claveIdempotencia?: string
      codigo: string
      stockInicial: string
    }
    expect(body.codigo).toBe('rf05-demo')
    expect(body.stockInicial).toBe('5')
    expect(body.claveIdempotencia).toEqual(expect.any(String))
  })

  it('shows controlled duplicate-code errors during creation', async () => {
    window.history.pushState({}, '', '/repuestos')
    mockApi(sparePartHandler('ADMINISTRADOR'))

    render(<App />)

    expect((await screen.findAllByText('REP-FRENO-001')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo repuesto/i }))

    const dialog = await screen.findByRole('dialog', { name: /Nuevo repuesto/i })
    fireEvent.change(within(dialog).getByLabelText(/^Codigo$/i), {
      target: { value: 'rep-freno-001' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^Nombre$/i), {
      target: { value: 'Repuesto duplicado' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Crear repuesto/i }))

    expect(await within(dialog).findByText(/El codigo ya existe/i)).toBeInTheDocument()
  })

  it('opens detail, keeps movements immutable, edits only master data and confirms deactivation', async () => {
    window.history.pushState({}, '', '/repuestos')
    const fetchMock = mockApi(sparePartHandler('ADMINISTRADOR'))

    render(<App />)

    const detailButtons = await screen.findAllByRole('button', { name: /^Detalle$/i })
    fireEvent.click(detailButtons[0])

    const detailDialog = await screen.findByRole('dialog', { name: /Detalle de repuesto/i })
    expect(within(detailDialog).getByText('OT-RF04-001')).toBeInTheDocument()
    expect(within(detailDialog).getByText(/Consumo de orden/i)).toBeInTheDocument()
    expect(
      within(detailDialog).queryByRole('button', { name: /Eliminar movimiento/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(within(detailDialog).getByRole('button', { name: /^Editar$/i }))
    const editDialog = await screen.findByRole('dialog', { name: /Editar repuesto/i })
    expect(
      within(editDialog).queryByLabelText(/Stock actual|Existencia actual|Stock inicial/i),
    ).not.toBeInTheDocument()

    fireEvent.change(within(editDialog).getByLabelText(/^Nombre$/i), {
      target: { value: 'Pastilla de freno reforzada' },
    })
    fireEvent.change(within(editDialog).getByLabelText(/^Costo unitario$/i), {
      target: { value: '125000' },
    })
    fireEvent.click(within(editDialog).getByRole('button', { name: /Guardar cambios/i }))

    expect(await screen.findByText(/Repuesto actualizado/i)).toBeInTheDocument()
    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).includes('/repuestos/part-available') && init?.method === 'PATCH',
    )
    expect(patchCall).toBeTruthy()
    expect(String(patchCall?.[1]?.body)).not.toContain('stockActual')
    expect(String(patchCall?.[1]?.body)).not.toContain('stockInicial')

    fireEvent.click(within(detailDialog).getByRole('button', { name: /^Desactivar$/i }))
    const statusDialog = await screen.findByRole('dialog', { name: /Confirmar estado/i })
    expect(
      within(statusDialog).getByText(/El historial y la existencia se conservan/i),
    ).toBeInTheDocument()
    fireEvent.click(within(statusDialog).getByRole('button', { name: /^Desactivar$/i }))

    expect(await screen.findByText(/Repuesto desactivado/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/repuestos/part-available/desactivar'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('creates and inactivates a versioned P8 compatibility rule from the part detail', async () => {
    window.history.pushState({}, '', '/repuestos')
    const fetchMock = mockApi(sparePartHandler('ADMINISTRADOR'))

    render(<App />)

    const detailButtons = await screen.findAllByRole('button', { name: /^Detalle$/i })
    fireEvent.click(detailButtons[0])

    const detailDialog = await screen.findByRole('dialog', { name: /Detalle de repuesto/i })
    expect(await within(detailDialog).findByText(/Sin reglas definidas/i)).toBeInTheDocument()
    fireEvent.click(within(detailDialog).getByRole('button', { name: /Nueva regla o version/i }))

    const ruleDialog = await screen.findByRole('dialog', {
      name: /Nueva regla de compatibilidad/i,
    })
    fireEvent.change(within(ruleDialog).getByLabelText(/^Bus$/i), {
      target: { value: fleetBus.id },
    })
    fireEvent.change(within(ruleDialog).getByLabelText(/^Resultado$/i), {
      target: { value: 'false' },
    })
    fireEvent.change(within(ruleDialog).getByLabelText(/Condicion de uso/i), {
      target: { value: 'Solo con autorizacion P8' },
    })
    fireEvent.click(within(ruleDialog).getByRole('button', { name: /Crear nueva version/i }))

    expect(await screen.findByText(/Nueva version de compatibilidad creada/i)).toBeInTheDocument()
    expect(await within(detailDialog).findByText(/No permitido.*v1.*Vigente/i)).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          getPath(input) === '/repuestos/part-available/compatibilidades' &&
          init?.method === 'POST',
      ),
    ).toBe(true)

    fireEvent.click(within(detailDialog).getByRole('button', { name: /Inactivar regla/i }))
    const deactivateDialog = await screen.findByRole('dialog', {
      name: /Confirmar inactivacion de regla/i,
    })
    fireEvent.click(
      within(deactivateDialog).getByRole('button', { name: /Confirmar inactivacion/i }),
    )

    expect(await screen.findByText(/Regla de compatibilidad inactivada/i)).toBeInTheDocument()
    expect(await within(detailDialog).findByText(/No permitido.*v1.*Inactiva/i)).toBeInTheDocument()
  })

  it('registers entries and explicit adjustments with confirmation and stock-insufficient feedback', async () => {
    window.history.pushState({}, '', '/repuestos')
    const fetchMock = mockApi(sparePartHandler('ADMINISTRADOR'))

    render(<App />)

    expect((await screen.findAllByText('REP-FRENO-001')).length).toBeGreaterThan(0)

    const availableRow = screen.getAllByText('REP-FRENO-001')[0].closest('tr')
    expect(availableRow).toBeTruthy()
    fireEvent.click(within(availableRow as HTMLElement).getByRole('button', { name: /^Entrada$/i }))

    const entryDialog = await screen.findByRole('dialog', { name: /Registrar entrada/i })
    fireEvent.change(within(entryDialog).getByLabelText(/^Cantidad de entrada$/i), {
      target: { value: '2' },
    })
    fireEvent.change(within(entryDialog).getByLabelText(/^Costo unitario futuro$/i), {
      target: { value: '125000' },
    })
    fireEvent.change(within(entryDialog).getByLabelText(/^Motivo$/i), {
      target: { value: 'Reposicion operativa' },
    })
    fireEvent.click(within(entryDialog).getByRole('button', { name: /Registrar entrada/i }))

    expect(await screen.findByText(/Entrada registrada/i)).toBeInTheDocument()
    const entryCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).includes('/repuestos/part-available/entradas') && init?.method === 'POST',
    )
    expect(entryCall).toBeTruthy()
    const entryBody = JSON.parse(String(entryCall?.[1]?.body)) as {
      claveIdempotencia?: string
      costoUnitario?: string
      motivo: string
    }
    expect(entryBody.claveIdempotencia).toEqual(expect.any(String))
    expect(new Headers(entryCall?.[1]?.headers).get('Idempotency-Key')).toBe(
      entryBody.claveIdempotencia,
    )
    expect(entryBody.costoUnitario).toBe('125000')
    expect(entryBody.motivo).toBe('Reposicion operativa')

    fireEvent.click(screen.getByLabelText(/Cerrar panel/i))

    const emptyRow = screen.getAllByText('REP-ACEITE-001')[0].closest('tr')
    expect(emptyRow).toBeTruthy()
    fireEvent.click(within(emptyRow as HTMLElement).getByRole('button', { name: /^Ajuste$/i }))

    const adjustmentDialog = await screen.findByRole('dialog', { name: /Registrar ajuste/i })
    fireEvent.change(within(adjustmentDialog).getByLabelText(/^Direccion$/i), {
      target: { value: 'DISMINUCION' },
    })
    fireEvent.change(within(adjustmentDialog).getByLabelText(/^Cantidad$/i), {
      target: { value: '1' },
    })
    fireEvent.change(within(adjustmentDialog).getByLabelText(/^Motivo$/i), {
      target: { value: 'Conteo fisico' },
    })
    fireEvent.click(within(adjustmentDialog).getByRole('button', { name: /Registrar ajuste/i }))
    expect(
      await within(adjustmentDialog).findByText(/Confirme la disminucion/i),
    ).toBeInTheDocument()

    fireEvent.click(within(adjustmentDialog).getByRole('checkbox'))
    fireEvent.click(within(adjustmentDialog).getByRole('button', { name: /Registrar ajuste/i }))
    expect(await within(adjustmentDialog).findByText(/Stock insuficiente/i)).toBeInTheDocument()

    fireEvent.change(within(adjustmentDialog).getByLabelText(/^Direccion$/i), {
      target: { value: 'INCREMENTO' },
    })
    fireEvent.change(within(adjustmentDialog).getByLabelText(/^Cantidad$/i), {
      target: { value: '2' },
    })
    fireEvent.click(within(adjustmentDialog).getByRole('button', { name: /Registrar ajuste/i }))

    expect(await screen.findByText(/Ajuste registrado/i)).toBeInTheDocument()
    const adjustmentCalls = fetchMock.mock.calls.filter(
      ([input, init]) =>
        String(input).includes('/repuestos/part-empty/ajustes') && init?.method === 'POST',
    )
    const adjustmentCall = adjustmentCalls.at(-1)
    expect(adjustmentCall).toBeTruthy()
    const adjustmentBody = JSON.parse(String(adjustmentCall?.[1]?.body)) as {
      claveIdempotencia?: string
      direccion: string
    }
    expect(adjustmentBody.claveIdempotencia).toEqual(expect.any(String))
    expect(new Headers(adjustmentCall?.[1]?.headers).get('Idempotency-Key')).toBe(
      adjustmentBody.claveIdempotencia,
    )
    expect(adjustmentBody.direccion).toBe('INCREMENTO')
  })
})
