import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoleCode } from './domain/labels'
import App from './App'

const roleNames: Record<RoleCode, string> = {
  ADMINISTRADOR: 'Administrador',
  CONDUCTOR: 'Conductor',
  MECANICO: 'Mecánico',
}

function userForRole(role: RoleCode) {
  return {
    email: `${role.toLowerCase()}@sgmv.local`,
    estado: 'ACTIVO' as const,
    id: `user-${role.toLowerCase()}`,
    nombre: roleNames[role],
    rol: {
      codigo: role,
      nombre: roleNames[role],
    },
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function ok(data: unknown) {
  return jsonResponse({ data })
}

function apiError(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, status)
}

function getPath(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return new URL(input).pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  return new URL(input.url).pathname
}

function mockApi(handler: (path: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handler(getPath(input), init),
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App authentication and role navigation', () => {
  it('shows a loading state while the session is being recovered', async () => {
    window.history.pushState({}, '', '/inicio')
    const admin = userForRole('ADMINISTRADOR')
    let resolveSession!: (response: Response) => void

    mockApi(async (path) => {
      if (path === '/auth/me') {
        return new Promise<Response>((resolve) => {
          resolveSession = resolve
        })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Cargando sesi.n/i)).toBeInTheDocument()
    resolveSession(ok({ user: admin }))
    expect((await screen.findAllByText(/^Administrador$/i)).length).toBeGreaterThan(0)
    expect(
      screen.queryByText(/Administrador\s*\/|Conductor\s*\/|Personal T[eé]cnico/i),
    ).not.toBeInTheDocument()
  })

  it('protects private routes when there is no active session', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Iniciar sesi.n/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('treats an expired session as unauthenticated during recovery', async () => {
    window.history.pushState({}, '', '/historial')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Iniciar sesi.n/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('redirects unknown authenticated routes to the start page', async () => {
    window.history.pushState({}, '', '/ruta-inexistente')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/inicio')
    })
    expect(await screen.findByRole('heading', { name: /Inicio/i })).toBeInTheDocument()
  })

  it('starts a real session through POST /auth/login', async () => {
    window.history.pushState({}, '', '/login')
    const admin = userForRole('ADMINISTRADOR')
    const fetchMock = mockApi(async (path, init) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      if (path === '/auth/login' && init?.method === 'POST') {
        return ok({ user: admin })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/Correo/i), {
      target: { value: admin.email },
    })
    fireEvent.change(screen.getByLabelText(/Contrase/i), {
      target: { value: 'Clave-segura-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }))

    expect((await screen.findAllByText(/^Administrador$/i)).length).toBeGreaterThan(0)
    expect(
      screen.queryByText(/Administrador\s*\/|Conductor\s*\/|Personal T[eé]cnico/i),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText(/RF-03/i).length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
  })

  it('shows a safe error when login credentials are rejected', async () => {
    window.history.pushState({}, '', '/login')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      if (path === '/auth/login') {
        return apiError(401, 'UNAUTHORIZED', 'Credenciales invalidas')
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/Correo/i), {
      target: { value: 'usuario@sgmv.local' },
    })
    fireEvent.change(screen.getByLabelText(/Contrase/i), {
      target: { value: 'incorrecta' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }))

    expect(
      await screen.findByText(/No fue posible iniciar sesi.n con esas credenciales/i),
    ).toBeInTheDocument()
  })

  it('recovers an existing mechanic session and limits the menu by role', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('MECANICO') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Panel t.cnico/i)).toBeInTheDocument()
    expect(screen.getAllByText(/RF-04/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/RF-05/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/RF-06/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/RF-01/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-02/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-03/i)).not.toBeInTheDocument()
  })

  it('limits the driver menu to assigned modules', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('CONDUCTOR') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Panel del conductor/i)).toBeInTheDocument()
    expect(screen.getAllByText(/RF-01/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/RF-02/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/RF-06/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/RF-03/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-04/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-05/i)).not.toBeInTheDocument()
  })

  it('redirects unauthorized roles to the access denied screen', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('CONDUCTOR') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
  })

  it('closes the active session through POST /auth/logout', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      if (path === '/auth/logout') {
        return ok({ ok: true })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Cerrar sesi.n/i }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
    })
    expect(await screen.findByRole('heading', { name: /Iniciar sesi.n/i })).toBeInTheDocument()
  })
})

const fleetBus = {
  anio: 2022,
  asignacionesHistorial: [
    {
      activa: true,
      asignadoPor: {
        email: 'admin@sgmv.local',
        id: 'admin-1',
        nombre: 'Administrador Uno',
        telefono: null,
      },
      conductor: {
        email: 'driver@sgmv.local',
        id: 'driver-1',
        nombre: 'Conductor Uno',
        telefono: null,
      },
      fechaFin: null,
      fechaInicio: '2026-08-27T10:00:00.000Z',
      id: 'assign-1',
      motivo: 'Asignacion de prueba',
    },
  ],
  codigoInterno: 'BUS-001',
  conductorAsignado: {
    email: 'driver@sgmv.local',
    id: 'driver-1',
    nombre: 'Conductor Uno',
    telefono: null,
  },
  estadoOperativo: 'OPERATIVO',
  estadosHistorial: [
    {
      cambiadoPor: {
        email: 'admin@sgmv.local',
        id: 'admin-1',
        nombre: 'Administrador Uno',
        telefono: null,
      },
      estadoAnterior: null,
      estadoNuevo: 'OPERATIVO',
      fechaCambio: '2026-08-27T09:00:00.000Z',
      id: 'state-1',
      motivo: 'Registro inicial',
    },
  ],
  id: 'bus-1',
  kilometrajeActual: 11000,
  lecturasKilometraje: [
    {
      fechaRegistro: '2026-08-27T11:00:00.000Z',
      id: 'km-1',
      kilometrajeAnterior: 10000,
      kilometrajeNuevo: 11000,
      motivo: 'Lectura de prueba',
      registradoPor: {
        email: 'admin@sgmv.local',
        id: 'admin-1',
        nombre: 'Administrador Uno',
        telefono: null,
      },
    },
  ],
  marca: 'Mercedes',
  modelo: 'Padron',
  placa: 'ABC123',
  updatedAt: '2026-08-27T11:00:00.000Z',
}

function fleetSummary() {
  return {
    asignacionesActivas: 1,
    porEstado: {
      EN_MANTENIMIENTO: 0,
      FUERA_DE_SERVICIO: 0,
      INACTIVO: 0,
      OPERATIVO: 1,
    },
    sinConductor: 0,
    totalBuses: 1,
  }
}

function fleetList(overrides: Partial<{ buses: unknown[]; totalPaginas: number }> = {}) {
  const buses = overrides.buses ?? [fleetBus]

  return {
    buses,
    paginacion: {
      limite: 8,
      pagina: 1,
      total: buses.length,
      totalPaginas: overrides.totalPaginas ?? 1,
    },
  }
}

const noveltyOrder = {
  codigo: 'OT-NOV-001',
  descripcion: 'Orden correctiva generada desde novedad',
  estado: 'PENDIENTE_ASIGNACION',
  fechaCreacion: '2026-08-27T12:30:00.000Z',
  id: 'order-1',
  origen: 'NOVEDAD',
  prioridad: 'MEDIA',
  tipo: 'CORRECTIVA',
}

const noveltyOne = {
  bus: {
    codigoInterno: fleetBus.codigoInterno,
    estadoOperativo: fleetBus.estadoOperativo,
    id: fleetBus.id,
    placa: fleetBus.placa,
  },
  clasificacion: null,
  conductor: {
    id: 'driver-1',
    nombre: 'Conductor Uno',
  },
  descripcion: 'Se escucha ruido al frenar en pendientes durante la ruta.',
  estado: 'PENDIENTE_REVISION',
  fechaReporte: '2026-08-27T12:00:00.000Z',
  fechaRevision: null,
  id: 'nov-1',
  observacionRevision: null,
  ordenTrabajo: null,
  revisadaPor: null,
  tipo: 'Ruido en frenos',
  updatedAt: '2026-08-27T12:00:00.000Z',
}

const reviewedNovelty = {
  ...noveltyOne,
  clasificacion: 'Falla mecanica',
  fechaRevision: '2026-08-27T12:10:00.000Z',
  observacionRevision: 'Revisada por administrador',
  revisadaPor: {
    id: 'admin-1',
    nombre: 'Administrador Uno',
  },
}

const convertedNovelty = {
  ...reviewedNovelty,
  estado: 'CONVERTIDA_A_ORDEN',
  ordenTrabajo: noveltyOrder,
}

function noveltySummary() {
  return {
    estados: {
      CONVERTIDA_A_ORDEN: 0,
      DESCARTADA: 0,
      PENDIENTE_REVISION: 1,
      RESUELTA_SIN_ORDEN: 0,
    },
    ordenesGeneradas: 0,
    pendientes: 1,
    total: 1,
  }
}

function noveltyList(novedades: unknown[] = [noveltyOne], totalPaginas = 2) {
  return {
    novedades,
    paginacion: {
      limite: 8,
      pagina: 1,
      total: novedades.length,
      totalPaginas,
    },
  }
}

function fleetHandler(role: RoleCode = 'ADMINISTRADOR') {
  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/flota/resumen') {
      return ok(fleetSummary())
    }

    if (path === '/flota/mi-bus') {
      return ok({
        asignacion: fleetBus.asignacionesHistorial[0],
        bus: fleetBus,
      })
    }

    if (path === '/flota/buses' && !init?.method) {
      return ok(fleetList({ totalPaginas: 2 }))
    }

    if (path === '/flota/buses' && init?.method === 'POST') {
      return ok({ bus: fleetBus })
    }

    if (path === '/flota/buses/bus-1') {
      if (init?.method === 'PATCH') {
        return ok({ bus: { ...fleetBus, marca: 'Volvo' } })
      }

      return ok({ bus: fleetBus })
    }

    if (path === '/flota/buses/bus-1/kilometraje') {
      return ok({ ok: true })
    }

    if (path === '/flota/buses/bus-1/estado') {
      return ok({ ok: true })
    }

    if (path === '/flota/buses/bus-1/asignaciones') {
      return ok({ ok: true })
    }

    if (path === '/flota/conductores-disponibles') {
      return ok({
        conductores: [
          {
            asignacionActiva: null,
            email: 'driver-two@sgmv.local',
            id: 'driver-2',
            nombre: 'Conductor Dos',
            telefono: null,
          },
        ],
      })
    }

    if (path === '/novedades/resumen') {
      return ok(noveltySummary())
    }

    if (path === '/novedades/mis-novedades') {
      return ok(noveltyList([noveltyOne], 1))
    }

    return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
  }
}

function noveltyHandler(
  role: RoleCode = 'ADMINISTRADOR',
  options: Partial<{ empty: boolean; failList: boolean; noBus: boolean }> = {},
) {
  let converted = false
  let reviewed = false

  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/flota/mi-bus') {
      return ok({
        asignacion: options.noBus ? null : fleetBus.asignacionesHistorial[0],
        bus: options.noBus ? null : fleetBus,
      })
    }

    if (path === '/novedades/resumen') {
      return ok(noveltySummary())
    }

    if (path === '/novedades/mis-novedades' && !init?.method) {
      return ok(noveltyList(options.empty ? [] : [converted ? convertedNovelty : noveltyOne], 2))
    }

    if (path === '/novedades/mis-novedades/nov-1') {
      return ok({ novedad: converted ? convertedNovelty : noveltyOne })
    }

    if (path === '/novedades' && init?.method === 'POST') {
      return ok({ novedad: noveltyOne })
    }

    if (path === '/novedades' && !init?.method) {
      if (options.failList) {
        return apiError(500, 'INTERNAL_ERROR', 'Fallo controlado')
      }

      return ok(noveltyList(options.empty ? [] : [converted ? convertedNovelty : noveltyOne], 2))
    }

    if (path === '/novedades/nov-1' && !init?.method) {
      return ok({ novedad: converted ? convertedNovelty : reviewed ? reviewedNovelty : noveltyOne })
    }

    if (path === '/novedades/nov-1/revision' && init?.method === 'POST') {
      reviewed = true
      return ok({ novedad: reviewedNovelty })
    }

    if (path === '/novedades/nov-1/convertir-orden' && init?.method === 'POST') {
      converted = true
      return ok({ novedad: convertedNovelty, orden: noveltyOrder, yaExistia: false })
    }

    return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
  }
}

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

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('pagina=2'),
        expect.any(Object),
      )
    })
  })

  it('opens bus detail and completes mileage, state and assignment actions', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Asignar/i }))
    fireEvent.change(await screen.findByLabelText(/^Conductor$/i), {
      target: { value: 'driver-2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
    expect(await screen.findByText(/Asignacion actualizada/i)).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/buses/bus-1/kilometraje'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/buses/bus-1/estado'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/buses/bus-1/asignaciones'),
      expect.objectContaining({ method: 'POST' }),
    )
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
    mockApi(async (path, init) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      if (path === '/flota/resumen') {
        return ok(fleetSummary())
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
    fireEvent.change(screen.getByLabelText(/Marca/i), { target: { value: 'Mercedes' } })
    fireEvent.change(screen.getByLabelText(/Modelo/i), { target: { value: 'Padron' } })
    fireEvent.change(screen.getByLabelText(/Anio/i), { target: { value: '2022' } })
    fireEvent.change(screen.getByLabelText(/Kilometraje actual/i), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    expect(await screen.findByText(/Bus registrado/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))
    expect(await screen.findByText(/La placa ya esta registrada/i)).toBeInTheDocument()
  })

  it('edits a bus through the real PATCH endpoint', async () => {
    window.history.pushState({}, '', '/flota/bus-1/editar')
    const fetchMock = mockApi(fleetHandler())

    render(<App />)

    expect(await screen.findByDisplayValue('Mercedes')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Marca/i), { target: { value: 'Volvo' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    expect(await screen.findByText(/Bus actualizado/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/flota/buses/bus-1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('limits the driver fleet view to the assigned bus', async () => {
    window.history.pushState({}, '', '/flota')
    mockApi(fleetHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Mi bus asignado/i)).toBeInTheDocument()
    expect(await screen.findByText('BUS-001')).toBeInTheDocument()
    expect(screen.queryByText(/Registrar bus/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Kilometraje/i })).not.toBeInTheDocument()
  })

  it('shows the driver empty state and denies mechanic access to RF-01', async () => {
    window.history.pushState({}, '', '/flota')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('CONDUCTOR') })
      }

      if (path === '/flota/mi-bus') {
        return ok({ asignacion: null, bus: null })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Sin bus asignado/i)).toBeInTheDocument()

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

describe('RF-02 novelty frontend', () => {
  it('lets a driver register a novelty only for the assigned bus', async () => {
    window.history.pushState({}, '', '/novedades')
    const fetchMock = mockApi(noveltyHandler('CONDUCTOR'))

    render(<App />)

    expect(await screen.findByText(/Mis novedades operativas/i)).toBeInTheDocument()
    expect(await screen.findByText(/BUS-001 - ABC123/i)).toBeInTheDocument()

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

    expect(await screen.findByText(/Novedad registrada para el bus asignado/i)).toBeInTheDocument()

    const createCalls = fetchMock.mock.calls.filter(
      ([input, init]) => String(input).includes('/novedades') && init?.method === 'POST',
    )
    expect(createCalls).toHaveLength(1)
    expect(String(createCalls[0][1]?.body)).toContain('Ruido en frenos')
    expect(String(createCalls[0][1]?.body)).not.toContain('busId')
    expect(String(createCalls[0][1]?.body)).not.toContain('conductorId')
  })

  it('shows a clear empty state when a driver has no active bus assignment', async () => {
    window.history.pushState({}, '', '/novedades')
    mockApi(noveltyHandler('CONDUCTOR', { noBus: true }))

    render(<App />)

    expect(await screen.findByText(/Sin bus asignado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Enviar novedad/i })).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }))

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
