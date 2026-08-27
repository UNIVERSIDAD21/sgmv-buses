import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoleCode } from './domain/labels'
import App from './App'

const roleNames: Record<RoleCode, string> = {
  ADMIN_SUPERVISOR: 'Administrador / Supervisor',
  CONDUCTOR_OPERADOR: 'Conductor / Operador',
  MECANICO: 'Personal Tecnico / Mecanico',
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
    const admin = userForRole('ADMIN_SUPERVISOR')
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
    expect((await screen.findAllByText(/Administrador \/ Supervisor/i)).length).toBeGreaterThan(0)
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
        return ok({ user: userForRole('ADMIN_SUPERVISOR') })
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
    const admin = userForRole('ADMIN_SUPERVISOR')
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

    expect((await screen.findAllByText(/Administrador \/ Supervisor/i)).length).toBeGreaterThan(0)
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
        return ok({ user: userForRole('CONDUCTOR_OPERADOR') })
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
        return ok({ user: userForRole('CONDUCTOR_OPERADOR') })
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
        return ok({ user: userForRole('ADMIN_SUPERVISOR') })
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
        nombre: 'Supervisor Uno',
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
        nombre: 'Supervisor Uno',
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
        nombre: 'Supervisor Uno',
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

function fleetHandler(role: RoleCode = 'ADMIN_SUPERVISOR') {
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
        return ok({ user: userForRole('ADMIN_SUPERVISOR') })
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
        return ok({ user: userForRole('ADMIN_SUPERVISOR') })
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
        return ok({ user: userForRole('ADMIN_SUPERVISOR') })
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
    mockApi(fleetHandler('CONDUCTOR_OPERADOR'))

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
        return ok({ user: userForRole('CONDUCTOR_OPERADOR') })
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
