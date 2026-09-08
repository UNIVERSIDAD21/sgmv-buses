// Work orders module regression
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPath, mockApi, workOrderPart, workOrderHandler } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RF-04 work order frontend', () => {
  it('shows dispatchers only the operational work-order projection', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo/despacho')
    mockApi(workOrderHandler('DESPACHADOR'))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /Disponibilidad por orden tecnica/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('OT-RF04-001')).toBeInTheDocument()
    expect(screen.getByText(/Orden tecnica activa/i)).toBeInTheDocument()
    expect(screen.queryByText(/Desgaste en sistema de frenos confirmado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/120\.000/)).not.toBeInTheDocument()
  })

  it('loads administrative summary, filters, manual creation, assignment and reassignment', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo')
    const fetchMock = mockApi(workOrderHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^Seguimiento de ordenes de trabajo$/i }),
    ).toBeInTheDocument()
    expect((await screen.findAllByText('OT-RF04-001')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Pendiente de asignacion/i).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText(/Buscar por codigo/i), {
      target: { value: 'frenos' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('busqueda=frenos'),
        expect.any(Object),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /^Pendiente de asignacion$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('estado=PENDIENTE_ASIGNACION'),
        expect.any(Object),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /^Crear orden$/i }))
    const createDialog = await screen.findByRole('dialog', { name: /Crear orden manual/i })

    fireEvent.click(within(createDialog).getByRole('button', { name: /^Crear orden$/i }))
    expect(await screen.findByText(/Seleccione un bus/i)).toBeInTheDocument()

    fireEvent.change(within(createDialog).getByLabelText(/^Bus$/i), {
      target: { value: 'bus-1' },
    })
    fireEvent.change(within(createDialog).getByLabelText(/^Prioridad$/i), {
      target: { value: 'ALTA' },
    })
    fireEvent.change(within(createDialog).getByLabelText(/^Descripcion$/i), {
      target: { value: 'Orden correctiva directa creada desde el formulario RF-04.' },
    })
    fireEvent.click(within(createDialog).getByRole('button', { name: /^Crear orden$/i }))

    expect(await screen.findByText(/Orden de trabajo creada/i)).toBeInTheDocument()
    expect((await screen.findAllByText('OT-DIR-001')).length).toBeGreaterThan(0)

    const createCalls = fetchMock.mock.calls.filter(
      ([input, init]) => String(input).endsWith('/ordenes-trabajo') && init?.method === 'POST',
    )
    expect(createCalls).toHaveLength(1)
    expect(String(createCalls[0][1]?.body)).not.toContain('estado')
    expect(String(createCalls[0][1]?.body)).not.toContain('novedadId')

    fireEvent.click(await screen.findByRole('button', { name: /^Asignar$/i }))
    const assignDialog = await screen.findByRole('dialog', { name: /Asignar mecanico/i })
    fireEvent.change(within(assignDialog).getByLabelText(/^Mecanico$/i), {
      target: { value: 'user-mecanico' },
    })
    fireEvent.click(within(assignDialog).getByRole('button', { name: /^Asignar$/i }))

    expect(await screen.findByText(/Orden asignada/i)).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /^Reasignar$/i }))
    const reassignDialog = await screen.findByRole('dialog', { name: /Reasignar mecanico/i })
    fireEvent.click(within(reassignDialog).getByRole('button', { name: /^Reasignar$/i }))
    expect(await screen.findByText(/El motivo de reasignacion es obligatorio/i)).toBeInTheDocument()
    fireEvent.change(within(reassignDialog).getByLabelText(/^Mecanico$/i), {
      target: { value: 'user-mecanico-alt' },
    })
    fireEvent.change(within(reassignDialog).getByLabelText(/Motivo de reasignacion/i), {
      target: { value: 'Balance de carga' },
    })
    fireEvent.click(within(reassignDialog).getByRole('button', { name: /^Reasignar$/i }))

    expect(await screen.findByText(/Orden reasignada/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/Mecanico Dos/i)).length).toBeGreaterThan(0)
  })

  it('lets an administrator authorize and revoke a scoped P8 consumption exception', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo')
    const fetchMock = mockApi(workOrderHandler('ADMINISTRADOR', { initialStatus: 'EN_EJECUCION' }))

    render(<App />)

    fireEvent.click((await screen.findAllByRole('button', { name: /Detalle/i }))[0])
    expect(
      await screen.findByRole('heading', { name: /Excepciones de compatibilidad/i }),
    ).toBeInTheDocument()

    const partSelect = await screen.findByLabelText(/^Repuesto$/i)
    expect(await within(partSelect).findByRole('option', { name: /REP-001/i })).toBeInTheDocument()
    fireEvent.change(partSelect, {
      target: { value: workOrderPart.id },
    })
    fireEvent.change(screen.getByLabelText(/Cantidad maxima/i), { target: { value: '1.25' } })
    fireEvent.change(screen.getByLabelText(/Motivo administrativo/i), {
      target: { value: 'Autorizacion puntual controlada P8' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Autorizar excepcion/i }))

    expect(await screen.findByText(/Excepcion puntual autorizada/i)).toBeInTheDocument()
    expect(await screen.findByText(/REP-001 - max\. 1\.25 - VIGENTE/i)).toBeInTheDocument()
    const authorizationCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        getPath(input) === '/ordenes-trabajo/order-rf04-1/excepciones-consumo' &&
        init?.method === 'POST',
    )
    expect(authorizationCall).toBeTruthy()
    expect(String(authorizationCall?.[1]?.body)).not.toContain('autorizadoPor')

    fireEvent.click(screen.getByRole('button', { name: /^Revocar$/i }))
    expect(await screen.findByText(/Excepcion revocada/i)).toBeInTheDocument()
    expect(await screen.findByText(/REP-001 - max\. 1\.25 - REVOCADA/i)).toBeInTheDocument()
  })

  it('lets the assigned mechanic execute, consume stock and complete technically', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo')
    const fetchMock = mockApi(workOrderHandler('MECANICO', { initialStatus: 'ASIGNADA' }))

    render(<App />)

    expect((await screen.findAllByText('OT-RF04-001')).length).toBeGreaterThan(0)
    fireEvent.click((await screen.findAllByRole('button', { name: /Detalle/i }))[0])
    expect(await screen.findByText(/Ejecucion tecnica/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^Fecha del evento$/i), {
      target: { value: '2026-08-28T12:06' },
    })
    fireEvent.change(screen.getByLabelText(/^Kilometraje$/i), {
      target: { value: '45201' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Registrar lectura/i }))
    expect(await screen.findByText(/Lectura tecnica registrada/i)).toBeInTheDocument()
    expect(await screen.findByText(/45\.201 km/i)).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /^Iniciar$/i }))
    expect(await screen.findByText(/Ejecucion iniciada/i)).toBeInTheDocument()

    fireEvent.change(await screen.findByLabelText(/^Diagnostico$/i), {
      target: { value: 'Diagnostico correctivo desde frontend.' },
    })
    fireEvent.change(screen.getByLabelText(/Observaciones tecnicas/i), {
      target: { value: 'Observaciones tecnicas desde frontend.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar tecnica/i }))
    expect(await screen.findByText(/Intervencion actualizada/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Actividad realizada/i), {
      target: { value: 'Revision y ajuste de frenos' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Registrar actividad/i }))
    expect(await screen.findByText(/Actividad registrada/i)).toBeInTheDocument()

    expect(await screen.findByText(/Pastilla de freno/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Repuesto$/i), { target: { value: 'rep-1' } })
    fireEvent.change(screen.getByLabelText(/^Cantidad$/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /Registrar consumo/i }))
    expect(await screen.findByText(/Consumo registrado/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Completar$/i }))
    const completeDialog = await screen.findByRole('dialog', { name: /Completar orden/i })
    fireEvent.click(within(completeDialog).getByRole('button', { name: /Confirmar completado/i }))
    expect(await screen.findByText(/Orden completada tecnicamente/i)).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ordenes-trabajo/order-rf04-1/iniciar'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ordenes-trabajo/order-rf04-1/consumos'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('lets administrators return completed orders for correction', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo')
    mockApi(workOrderHandler('ADMINISTRADOR', { initialStatus: 'COMPLETADA_TECNICO' }))

    render(<App />)

    fireEvent.click((await screen.findAllByRole('button', { name: /Detalle/i }))[0])
    fireEvent.click(await screen.findByRole('button', { name: /^Devolver$/i }))
    const returnDialog = await screen.findByRole('dialog', { name: /Devolver orden/i })

    fireEvent.click(within(returnDialog).getByRole('button', { name: /^Devolver$/i }))
    expect(await screen.findByText(/El motivo de devolucion es obligatorio/i)).toBeInTheDocument()
    fireEvent.change(within(returnDialog).getByLabelText(/Motivo de devolucion/i), {
      target: { value: 'Corregir evidencia tecnica' },
    })
    fireEvent.click(within(returnDialog).getByRole('button', { name: /^Devolver$/i }))

    expect(await screen.findByText(/Orden devuelta para correccion/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/Devuelta a correccion/i)).length).toBeGreaterThan(0)
  })

  it('closes completed orders only after confirmation', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo')
    mockApi(workOrderHandler('ADMINISTRADOR', { initialStatus: 'COMPLETADA_TECNICO' }))

    render(<App />)

    fireEvent.click((await screen.findAllByRole('button', { name: /Detalle/i }))[0])
    fireEvent.click(await screen.findByRole('button', { name: /^Cerrar$/i }))
    const closeDialog = await screen.findByRole('dialog', { name: /Cerrar orden/i })

    fireEvent.click(within(closeDialog).getByRole('button', { name: /Cerrar orden/i }))
    expect(await screen.findByText(/Confirme el cierre administrativo/i)).toBeInTheDocument()
    fireEvent.click(within(closeDialog).getByRole('checkbox'))
    fireEvent.change(within(closeDialog).getByLabelText(/Observacion de cierre/i), {
      target: { value: 'Cierre validado' },
    })
    fireEvent.click(within(closeDialog).getByRole('button', { name: /Cerrar orden/i }))

    expect(await screen.findByText(/Orden cerrada/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/^Cerrada$/i)).length).toBeGreaterThan(0)
  })

  it('denies drivers access to internal work-order tracking', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo')
    mockApi(workOrderHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
    expect(screen.queryByText(/Ejecucion tecnica/i)).not.toBeInTheDocument()
  })
})
