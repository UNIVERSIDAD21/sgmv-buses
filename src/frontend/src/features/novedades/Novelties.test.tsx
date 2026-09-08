// Operational novelties module regression
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPath, mockApi, noveltyHandler } from '../../test/app-test-helpers'
import App from '../../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RF-02 novelty frontend', () => {
  it('lets a driver register a novelty from the journey context without free IDs', async () => {
    window.history.pushState({}, '', '/novedades')
    const fetchMock = mockApi(noveltyHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Mis novedades operativas/i)).toBeInTheDocument()
    expect(await screen.findByText(/BUS-JORNADA-01 - JOR001/i)).toBeInTheDocument()
    expect(screen.getByText(/No use este dispositivo.*mientras conduce/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Kilometraje observado/i), {
      target: { value: '45010' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar novedad/i }))
    expect(await screen.findByText(/El tipo debe tener al menos 3 caracteres/i)).toBeInTheDocument()
    expect(
      screen.getByText(/La descripcion debe tener al menos 10 caracteres/i),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Tipo de novedad/i), {
      target: { value: 'Ruido en frenos' },
    })
    fireEvent.change(screen.getByLabelText(/Descripcion/i), {
      target: { value: 'Se escucha ruido al frenar en pendientes durante la ruta.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar novedad/i }))
    fireEvent.click(screen.getByRole('button', { name: /Enviar novedad/i }))

    expect(
      await screen.findByText(/Novedad registrada y vinculada a la jornada/i),
    ).toBeInTheDocument()

    const createCalls = fetchMock.mock.calls.filter(
      ([input, init]) => String(input).includes('/novedades') && init?.method === 'POST',
    )
    expect(createCalls).toHaveLength(1)
    expect(String(createCalls[0][1]?.body)).toContain('Ruido en frenos')
    expect(String(createCalls[0][1]?.body)).toContain('fechaOcurrencia')
    expect(String(createCalls[0][1]?.body)).toContain('45010')
    expect(String(createCalls[0][1]?.body)).not.toContain('busId')
    expect(String(createCalls[0][1]?.body)).not.toContain('conductorId')
  })

  it('allows a safe late report when the driver has no journey currently in progress', async () => {
    window.history.pushState({}, '', '/novedades')
    mockApi(noveltyHandler('CONDUCTOR', { noBus: true }))

    render(<App />)

    expect(await screen.findByText(/Sin jornada en curso/i)).toBeInTheDocument()
    expect(screen.getByText(/Puede reportar una novedad tardia/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar novedad/i })).toBeInTheDocument()
  })

  it('loads own novelty list and authorized detail for a driver', async () => {
    window.history.pushState({}, '', '/novedades')
    mockApi(noveltyHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Ruido en frenos/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Detalle/i }))

    expect(await screen.findByText(/Detalle de novedad/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Se escucha ruido al frenar/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Acciones administrativas/i)).not.toBeInTheDocument()
  })

  it('loads the administrative list with search, status, priority and pagination', async () => {
    window.history.pushState({}, '', '/novedades')
    const fetchMock = mockApi(noveltyHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^Control de novedades operativas$/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Pendientes/i).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText(/Buscar por tipo/i), {
      target: { value: 'frenos' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('busqueda=frenos'),
        expect.any(Object),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /Pendiente de revisi.n/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('estado=PENDIENTE_REVISION'),
        expect.any(Object),
      )
    })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ALTA' } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('prioridad=ALTA'),
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

  it('reviews a novelty and converts it into a corrective order with confirmation dialog', async () => {
    window.history.pushState({}, '', '/novedades')
    const fetchMock = mockApi(noveltyHandler('ADMINISTRADOR'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Detalle/i }))
    expect(await screen.findByText(/Acciones administrativas/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Clasificar/i }))
    const classifyDialog = screen.getByRole('dialog', { name: /Clasificar novedad/i })
    fireEvent.change(within(classifyDialog).getByLabelText(/Clasificacion/i), {
      target: { value: 'Falla mecanica' },
    })
    fireEvent.change(within(classifyDialog).getByLabelText(/Criticidad/i), {
      target: { value: 'CRITICA' },
    })
    fireEvent.click(within(classifyDialog).getByRole('button', { name: /Guardar clasificacion/i }))
    expect(await screen.findByText(/Novedad actualizada/i)).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Generar orden/i }))
    const convertDialog = await screen.findByRole('dialog', { name: /Generar orden correctiva/i })
    expect(within(convertDialog).getByText(/Se creara una orden correctiva/i)).toBeInTheDocument()
    fireEvent.change(within(convertDialog).getByLabelText(/Prioridad de la orden/i), {
      target: { value: 'MEDIA' },
    })
    fireEvent.change(within(convertDialog).getByLabelText(/Observacion/i), {
      target: { value: 'Requiere orden correctiva.' },
    })
    fireEvent.click(within(convertDialog).getByRole('button', { name: /Crear orden/i }))

    expect(
      await screen.findByText(/Orden OT-NOV-001 generada en estado pendiente de asignacion/i),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Orden generada/i)).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/novedades/nov-1/revision'),
      expect.objectContaining({ method: 'POST' }),
    )
    const reviewCall = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/novedades/nov-1/revision' && init?.method === 'POST',
    )
    expect(JSON.parse(String(reviewCall?.[1]?.body))).toMatchObject({
      afectaOperacion: true,
      bloqueaDisponibilidad: true,
      criticidad: 'CRITICA',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/novedades/nov-1/convertir-orden'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows administrative empty and error states', async () => {
    window.history.pushState({}, '', '/novedades')
    mockApi(noveltyHandler('ADMINISTRADOR', { empty: true }))

    render(<App />)

    expect(await screen.findByText(/Sin resultados/i)).toBeInTheDocument()

    vi.restoreAllMocks()
    window.history.pushState({}, '', '/novedades')
    mockApi(noveltyHandler('ADMINISTRADOR', { failList: true }))

    render(<App />)

    expect(await screen.findByText(/Fallo controlado/i)).toBeInTheDocument()
  })

  it('denies mechanic access to RF-02', async () => {
    window.history.pushState({}, '', '/novedades')
    mockApi(noveltyHandler('MECANICO'))

    render(<App />)

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
  })
})
