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
    expect(screen.getAllByText(/RF-06/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/RF-05/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Central de repuestos/i })).not.toBeInTheDocument()
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

const preventiveOrder = {
  codigo: 'OT-PREV-001',
  descripcion: 'Orden preventiva generada desde programacion',
  estado: 'PENDIENTE_ASIGNACION',
  fechaCreacion: '2026-08-27T13:00:00.000Z',
  fechaObjetivoPreventivo: null,
  id: 'order-prev-1',
  kilometrajeObjetivoPreventivo: 11500,
  origen: 'PREVENTIVO',
  prioridad: 'MEDIA',
  tipo: 'PREVENTIVA',
}

const preventiveOne = {
  activa: true,
  actividad: 'Revision preventiva de frenos y suspension.',
  bus: fleetBus,
  clasificacion: {
    criterios: {
      fecha: null,
      kilometraje: {
        estado: 'PROXIMO',
        restante: 500,
      },
    },
    diasRestantes: null,
    estado: 'PROXIMO',
    kilometrosRestantes: 500,
  },
  creadaPor: {
    email: 'admin@sgmv.local',
    id: 'admin-1',
    nombre: 'Administrador Uno',
  },
  createdAt: '2026-08-27T12:00:00.000Z',
  criterio: 'KILOMETRAJE',
  fechaProgramada: null,
  id: 'prev-1',
  kilometrajeObjetivo: 11500,
  ordenActiva: null,
  tipo: 'Revision preventiva',
  updatedAt: '2026-08-27T12:00:00.000Z',
}

const preventiveVigente = {
  ...preventiveOne,
  actividad: 'Revision vigente de carroceria y luces.',
  clasificacion: {
    criterios: {
      fecha: {
        estado: 'VIGENTE',
        restante: 8,
      },
      kilometraje: null,
    },
    diasRestantes: 8,
    estado: 'VIGENTE',
    kilometrosRestantes: null,
  },
  criterio: 'FECHA',
  fechaProgramada: '2026-09-04',
  id: 'prev-2',
  kilometrajeObjetivo: null,
  tipo: 'Carroceria',
}

const preventiveVencida = {
  ...preventiveOne,
  actividad: 'Revision vencida por kilometraje superado.',
  clasificacion: {
    criterios: {
      fecha: null,
      kilometraje: {
        estado: 'VENCIDO',
        restante: -100,
      },
    },
    diasRestantes: null,
    estado: 'VENCIDO',
    kilometrosRestantes: -100,
  },
  id: 'prev-3',
  kilometrajeObjetivo: 10900,
  tipo: 'Sistema electrico',
}

const preventiveWithOrder = {
  ...preventiveOne,
  ordenActiva: preventiveOrder,
}

const preventiveUpdated = {
  ...preventiveOne,
  actividad: 'Revision preventiva reprogramada.',
  kilometrajeObjetivo: 11600,
}

function preventiveSummary() {
  return {
    activas: 3,
    elegiblesParaOrden: 2,
    estados: {
      PROXIMO: 1,
      VENCIDO: 1,
      VIGENTE: 1,
    },
    inactivas: 0,
    ordenesActivas: 0,
    total: 3,
    umbrales: {
      dias: 7,
      kilometros: 500,
    },
  }
}

function preventiveList(
  programaciones: unknown[] = [preventiveOne, preventiveVigente, preventiveVencida],
  totalPaginas = 2,
) {
  return {
    paginacion: {
      limite: 8,
      pagina: 1,
      total: programaciones.length,
      totalPaginas,
    },
    programaciones,
  }
}

const workOrderAdmin = {
  email: 'admin@sgmv.local',
  id: 'user-administrador',
  nombre: 'Administrador',
  telefono: null,
}

const workOrderMechanic = {
  email: 'mecanico@sgmv.local',
  id: 'user-mecanico',
  nombre: 'Mecanico Uno',
  telefono: null,
}

const workOrderMechanicAlt = {
  email: 'mecanico-alt@sgmv.local',
  id: 'user-mecanico-alt',
  nombre: 'Mecanico Dos',
  telefono: null,
}

const workOrderPart = {
  categoria: 'Frenos',
  codigo: 'REP-001',
  costoUnitario: '120000.00',
  estado: 'ACTIVO',
  id: 'rep-1',
  nombre: 'Pastilla de freno',
  stockActual: '3.00',
  stockMinimo: '1.00',
  unidadMedida: 'unidad',
}

function workOrderSummary() {
  return {
    activas: 4,
    pendientesAsignacion: 1,
    pendientesRevision: 1,
    porEstado: {
      ASIGNADA: 1,
      CERRADA: 1,
      COMPLETADA_TECNICO: 1,
      DEVUELTA_CORRECCION: 1,
      EN_EJECUCION: 1,
      PENDIENTE_ASIGNACION: 1,
    },
    porOrigen: {
      CORRECTIVO_DIRECTO: 1,
      NOVEDAD: 1,
      PREVENTIVO: 1,
    },
    porTipo: {
      CORRECTIVA: 2,
      PREVENTIVA: 1,
    },
    total: 6,
  }
}

function workOrderStateHistory(estadoNuevo: string, estadoAnterior: string | null = null) {
  return {
    cambiadoPor: workOrderAdmin,
    estadoAnterior,
    estadoNuevo,
    fechaCambio: '2026-08-28T12:00:00.000Z',
    id: `history-${estadoNuevo}-${estadoAnterior ?? 'inicio'}`,
    observacion: estadoAnterior ? 'Transicion RF-04' : 'Orden creada',
  }
}

function workOrderActions(order: { estado: string; tecnicoAsignado: unknown }, role: RoleCode) {
  const isAdmin = role === 'ADMINISTRADOR'
  const isMechanic = role === 'MECANICO'
  const assigned = Boolean(order.tecnicoAsignado)

  return {
    puedeAsignar: isAdmin && order.estado === 'PENDIENTE_ASIGNACION',
    puedeCerrar: isAdmin && order.estado === 'COMPLETADA_TECNICO',
    puedeCompletar: isMechanic && order.estado === 'EN_EJECUCION' && assigned,
    puedeDevolver: isAdmin && order.estado === 'COMPLETADA_TECNICO',
    puedeIniciar: isMechanic && order.estado === 'ASIGNADA' && assigned,
    puedeReanudar: isMechanic && order.estado === 'DEVUELTA_CORRECCION' && assigned,
    puedeReasignar:
      isAdmin &&
      ['ASIGNADA', 'EN_EJECUCION', 'DEVUELTA_CORRECCION'].includes(order.estado) &&
      assigned,
    puedeRegistrarTecnica: isMechanic && order.estado === 'EN_EJECUCION' && assigned,
  }
}

function createWorkOrderDetail(status = 'PENDIENTE_ASIGNACION') {
  const tecnicoAsignado = status === 'PENDIENTE_ASIGNACION' ? null : { ...workOrderMechanic }
  const fechaAsignacion = status === 'PENDIENTE_ASIGNACION' ? null : '2026-08-28T12:05:00.000Z'
  const fechaInicioEjecucion = [
    'EN_EJECUCION',
    'COMPLETADA_TECNICO',
    'DEVUELTA_CORRECCION',
    'CERRADA',
  ].includes(status)
    ? '2026-08-28T12:10:00.000Z'
    : null
  const fechaCompletadaTecnico = ['COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION', 'CERRADA'].includes(
    status,
  )
    ? '2026-08-28T12:40:00.000Z'
    : null
  const fechaCierre = status === 'CERRADA' ? '2026-08-28T12:50:00.000Z' : null
  const interventions =
    status === 'PENDIENTE_ASIGNACION' || status === 'ASIGNADA'
      ? []
      : [
          {
            actividades:
              status === 'EN_EJECUCION'
                ? []
                : [
                    {
                      descripcion: 'Revision y ajuste tecnico',
                      fechaRegistro: '2026-08-28T12:20:00.000Z',
                      id: 'activity-1',
                      registradaPor: workOrderMechanic,
                    },
                  ],
            diagnostico:
              status === 'EN_EJECUCION' ? null : 'Desgaste en sistema de frenos confirmado',
            fechaFin:
              status === 'COMPLETADA_TECNICO' ||
              status === 'DEVUELTA_CORRECCION' ||
              status === 'CERRADA'
                ? '2026-08-28T12:40:00.000Z'
                : null,
            fechaInicio: '2026-08-28T12:10:00.000Z',
            id: 'intervention-1',
            observaciones: 'Prueba funcional pendiente de cierre',
            tecnico: workOrderMechanic,
          },
        ]

  return {
    acciones: {},
    bus: {
      anio: fleetBus.anio,
      codigoInterno: fleetBus.codigoInterno,
      estadoOperativo: fleetBus.estadoOperativo,
      id: fleetBus.id,
      kilometrajeActual: fleetBus.kilometrajeActual,
      marca: fleetBus.marca,
      modelo: fleetBus.modelo,
      placa: fleetBus.placa,
    },
    cerradaPor: status === 'CERRADA' ? workOrderAdmin : null,
    codigo: 'OT-RF04-001',
    consumosRepuesto: [],
    costoTotal: '0.00',
    creadaPor: workOrderAdmin,
    descripcion: 'Orden correctiva para seguimiento RF-04',
    estado: status,
    fechaAsignacion,
    fechaCierre,
    fechaCompletadaTecnico,
    fechaCreacion: '2026-08-28T12:00:00.000Z',
    fechaInicioEjecucion,
    fechaObjetivoPreventivo: null,
    historialEstados: [workOrderStateHistory('PENDIENTE_ASIGNACION')],
    historialTecnicoBus: [],
    id: 'order-rf04-1',
    intervenciones: interventions,
    kilometrajeObjetivoPreventivo: null,
    motivoDevolucionActual: status === 'DEVUELTA_CORRECCION' ? 'Corregir evidencia tecnica' : null,
    novedad: {
      clasificacion: 'Falla mecanica',
      conductor: {
        email: 'driver@sgmv.local',
        id: 'driver-1',
        nombre: 'Conductor Uno',
        telefono: null,
      },
      descripcion: 'Novedad que origino la orden',
      estado: 'CONVERTIDA_A_ORDEN',
      fechaReporte: '2026-08-28T11:30:00.000Z',
      id: 'nov-1',
      tipo: 'Ruido en frenos',
    },
    origen: 'NOVEDAD',
    prioridad: 'MEDIA',
    programacionMantenimiento: null,
    reasignaciones: [],
    tecnicoAsignado,
    tipo: 'CORRECTIVA',
  }
}

function workOrderList(order: ReturnType<typeof createWorkOrderDetail>) {
  return {
    ordenes: [order],
    paginacion: {
      limite: 8,
      pagina: 1,
      total: 1,
      totalPaginas: 2,
    },
  }
}

function workOrderHandler(
  role: RoleCode = 'ADMINISTRADOR',
  options: Partial<{ empty: boolean; failList: boolean; initialStatus: string }> = {},
) {
  let order = createWorkOrderDetail(options.initialStatus ?? 'PENDIENTE_ASIGNACION')

  function decoratedOrder() {
    return {
      ...order,
      acciones: workOrderActions(order, role),
    }
  }

  function appendHistory(estadoAnterior: string, estadoNuevo: string) {
    order = {
      ...order,
      historialEstados: [
        ...order.historialEstados,
        workOrderStateHistory(estadoNuevo, estadoAnterior),
      ],
    }
  }

  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/flota/buses' && !init?.method) {
      return ok(fleetList())
    }

    if (path === '/ordenes-trabajo/resumen') {
      return ok(workOrderSummary())
    }

    if (path === '/ordenes-trabajo/mecanicos-disponibles') {
      return ok({ mecanicos: [workOrderMechanic, workOrderMechanicAlt] })
    }

    if ((path === '/ordenes-trabajo' || path === '/ordenes-trabajo/mis-ordenes') && !init?.method) {
      if (options.failList) {
        return apiError(500, 'INTERNAL_ERROR', 'Fallo RF-04 controlado')
      }

      if (options.empty) {
        return ok({
          ordenes: [],
          paginacion: {
            limite: 8,
            pagina: 1,
            total: 0,
            totalPaginas: 1,
          },
        })
      }

      return ok(workOrderList(decoratedOrder()))
    }

    if (path === '/ordenes-trabajo' && init?.method === 'POST') {
      order = {
        ...createWorkOrderDetail('PENDIENTE_ASIGNACION'),
        codigo: 'OT-DIR-001',
        descripcion: 'Orden correctiva directa creada desde frontend',
        id: 'order-rf04-created',
        novedad: null,
        origen: 'CORRECTIVO_DIRECTO',
      }

      return ok({ orden: decoratedOrder() })
    }

    if (
      path === '/ordenes-trabajo/order-rf04-1' ||
      path === '/ordenes-trabajo/order-rf04-created'
    ) {
      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/asignar') && init?.method === 'POST') {
      order = {
        ...order,
        estado: 'ASIGNADA',
        fechaAsignacion: '2026-08-28T12:05:00.000Z',
        tecnicoAsignado: workOrderMechanic,
      }
      appendHistory('PENDIENTE_ASIGNACION', 'ASIGNADA')

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/reasignar') && init?.method === 'POST') {
      order = {
        ...order,
        reasignaciones: [
          ...order.reasignaciones,
          {
            fechaReasignacion: '2026-08-28T12:08:00.000Z',
            id: 'reassign-1',
            motivo: 'Balance de carga',
            reasignadoPor: workOrderAdmin,
            tecnicoAnterior: workOrderMechanic,
            tecnicoNuevo: workOrderMechanicAlt,
          },
        ],
        tecnicoAsignado: workOrderMechanicAlt,
      }

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/iniciar') && init?.method === 'POST') {
      order = {
        ...order,
        estado: 'EN_EJECUCION',
        fechaInicioEjecucion: '2026-08-28T12:10:00.000Z',
        intervenciones: [
          {
            actividades: [],
            diagnostico: null,
            fechaFin: null,
            fechaInicio: '2026-08-28T12:10:00.000Z',
            id: 'intervention-1',
            observaciones: null,
            tecnico: workOrderMechanic,
          },
        ],
      }
      appendHistory('ASIGNADA', 'EN_EJECUCION')

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/reanudar') && init?.method === 'POST') {
      order = {
        ...order,
        estado: 'EN_EJECUCION',
        fechaCompletadaTecnico: null,
        intervenciones: [
          ...order.intervenciones,
          {
            actividades: [],
            diagnostico: null,
            fechaFin: null,
            fechaInicio: '2026-08-28T12:45:00.000Z',
            id: 'intervention-2',
            observaciones: null,
            tecnico: workOrderMechanic,
          },
        ],
        motivoDevolucionActual: null,
      }
      appendHistory('DEVUELTA_CORRECCION', 'EN_EJECUCION')

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/intervencion') && init?.method === 'PATCH') {
      const payload = JSON.parse(String(init.body ?? '{}')) as {
        diagnostico?: string
        observaciones?: string
      }

      order = {
        ...order,
        intervenciones: order.intervenciones.map((intervention) =>
          intervention.fechaFin
            ? intervention
            : {
                ...intervention,
                diagnostico: payload.diagnostico ?? intervention.diagnostico,
                observaciones: payload.observaciones ?? intervention.observaciones,
              },
        ),
      }

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/actividades') && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body ?? '{}')) as { descripcion?: string }

      order = {
        ...order,
        intervenciones: order.intervenciones.map((intervention) =>
          intervention.fechaFin
            ? intervention
            : {
                ...intervention,
                actividades: [
                  ...intervention.actividades,
                  {
                    descripcion: payload.descripcion ?? 'Actividad registrada',
                    fechaRegistro: '2026-08-28T12:20:00.000Z',
                    id: `activity-${intervention.actividades.length + 1}`,
                    registradaPor: workOrderMechanic,
                  },
                ],
              },
        ),
      }

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/repuestos-disponibles')) {
      return ok({ repuestos: [workOrderPart] })
    }

    if (path.endsWith('/consumos') && init?.method === 'POST') {
      order = {
        ...order,
        consumosRepuesto: [
          ...order.consumosRepuesto,
          {
            cantidad: '1.00',
            costoUnitario: '120000.00',
            fechaConsumo: '2026-08-28T12:25:00.000Z',
            id: 'consumption-1',
            movimientoInventario: {
              cantidad: '1.00',
              costoUnitario: '120000.00',
              fechaMovimiento: '2026-08-28T12:25:00.000Z',
              id: 'movement-1',
              motivo: 'Consumo asociado a orden OT-RF04-001',
              tipo: 'CONSUMO',
            },
            repuesto: workOrderPart,
            subtotal: '120000.00',
          },
        ],
        costoTotal: '120000.00',
      }

      return ok({ consumo: order.consumosRepuesto[0], orden: decoratedOrder(), yaExistia: false })
    }

    if (path.endsWith('/completar') && init?.method === 'POST') {
      order = {
        ...order,
        estado: 'COMPLETADA_TECNICO',
        fechaCompletadaTecnico: '2026-08-28T12:40:00.000Z',
        intervenciones: order.intervenciones.map((intervention) =>
          intervention.fechaFin
            ? intervention
            : { ...intervention, fechaFin: '2026-08-28T12:40:00.000Z' },
        ),
      }
      appendHistory('EN_EJECUCION', 'COMPLETADA_TECNICO')

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/devolver') && init?.method === 'POST') {
      order = {
        ...order,
        estado: 'DEVUELTA_CORRECCION',
        motivoDevolucionActual: 'Corregir evidencia tecnica',
      }
      appendHistory('COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION')

      return ok({ orden: decoratedOrder() })
    }

    if (path.endsWith('/cerrar') && init?.method === 'POST') {
      order = {
        ...order,
        cerradaPor: workOrderAdmin,
        estado: 'CERRADA',
        fechaCierre: '2026-08-28T12:50:00.000Z',
      }
      appendHistory('COMPLETADA_TECNICO', 'CERRADA')

      return ok({ orden: decoratedOrder() })
    }

    return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
  }
}

type TestSparePart = {
  categoria: string | null
  codigo: string
  costoUnitario: string
  createdAt: string
  disponibilidad: 'AGOTADO' | 'BAJO' | 'DISPONIBLE' | 'INACTIVO'
  estado: 'ACTIVO' | 'INACTIVO'
  id: string
  nombre: string
  stockActual: string
  stockMinimo: string
  unidadMedida: string
  updatedAt: string
  valorActual: string
}

type TestMovement = {
  cantidad: string
  consumo: {
    id: string
    orden: {
      codigo: string
      estado: string
      id: string
      origen: string
      tipo: string
    }
  } | null
  costoUnitario: string | null
  direccion: 'ENTRADA' | 'SALIDA'
  fechaMovimiento: string
  id: string
  motivo: string | null
  repuesto: Omit<TestSparePart, 'createdAt' | 'updatedAt'>
  responsable: {
    email: string
    id: string
    nombre: string
    telefono: string | null
  }
  tipo: 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' | 'CONSUMO' | 'ENTRADA'
}

function fixedDecimal(value: number) {
  return value.toFixed(2)
}

function sparePartAvailability(
  part: Pick<TestSparePart, 'estado' | 'stockActual' | 'stockMinimo'>,
) {
  const stock = Number(part.stockActual)
  const minimum = Number(part.stockMinimo)

  if (part.estado === 'INACTIVO') {
    return 'INACTIVO' as const
  }

  if (stock === 0) {
    return 'AGOTADO' as const
  }

  if (stock <= minimum) {
    return 'BAJO' as const
  }

  return 'DISPONIBLE' as const
}

function decorateSparePart(part: Omit<TestSparePart, 'disponibilidad' | 'valorActual'>) {
  const stock = Number(part.stockActual)
  const cost = Number(part.costoUnitario)

  return {
    ...part,
    disponibilidad: sparePartAvailability(part),
    valorActual: fixedDecimal(stock * cost),
  }
}

function movementPart(part: TestSparePart): TestMovement['repuesto'] {
  return {
    categoria: part.categoria,
    codigo: part.codigo,
    costoUnitario: part.costoUnitario,
    descripcion: part.descripcion,
    disponibilidad: part.disponibilidad,
    estado: part.estado,
    id: part.id,
    nombre: part.nombre,
    stockActual: part.stockActual,
    stockMinimo: part.stockMinimo,
    unidadMedida: part.unidadMedida,
    valorActual: part.valorActual,
  }
}

function sparePartFixture(
  overrides: Partial<Omit<TestSparePart, 'disponibilidad' | 'valorActual'>> = {},
) {
  return decorateSparePart({
    categoria: 'Frenos',
    codigo: 'REP-FILTRO-001',
    costoUnitario: '45000.00',
    createdAt: '2026-08-29T09:00:00.000Z',
    estado: 'ACTIVO',
    id: 'part-low',
    nombre: 'Filtro de aceite',
    stockActual: '1.00',
    stockMinimo: '2.00',
    unidadMedida: 'unidad',
    updatedAt: '2026-08-29T09:10:00.000Z',
    ...overrides,
  })
}

function sparePartMovement(part: TestSparePart, overrides: Partial<TestMovement> = {}) {
  return {
    cantidad: '1.00',
    consumo: null,
    costoUnitario: part.costoUnitario,
    direccion: 'ENTRADA',
    fechaMovimiento: '2026-08-29T09:12:00.000Z',
    id: `mov-${part.id}`,
    motivo: 'Entrada inicial RF-05',
    repuesto: movementPart(part),
    responsable: workOrderAdmin,
    tipo: 'ENTRADA',
    ...overrides,
  } satisfies TestMovement
}

function sparePartPage(repuestos: TestSparePart[], pagina = 1, limite = 8) {
  return {
    paginacion: {
      limite,
      pagina,
      total: repuestos.length,
      totalPaginas: Math.max(1, Math.ceil(repuestos.length / limite)),
    },
    repuestos,
  }
}

function movementPage(movimientos: TestMovement[], pagina = 1, limite = 6) {
  return {
    movimientos,
    paginacion: {
      limite,
      pagina,
      total: movimientos.length,
      totalPaginas: Math.max(1, Math.ceil(movimientos.length / limite)),
    },
  }
}

function parseRequestBody<T>(init?: RequestInit) {
  return JSON.parse(String(init?.body ?? '{}')) as T
}

function sparePartHandler(
  role: RoleCode = 'ADMINISTRADOR',
  options: Partial<{ empty: boolean; failList: boolean; slowCreate: boolean }> = {},
) {
  const available = sparePartFixture({
    codigo: 'REP-FRENO-001',
    costoUnitario: '120000.00',
    id: 'part-available',
    nombre: 'Pastilla de freno',
    stockActual: '8.00',
    stockMinimo: '2.00',
  })
  const low = sparePartFixture()
  const empty = sparePartFixture({
    categoria: 'Lubricantes',
    codigo: 'REP-ACEITE-001',
    id: 'part-empty',
    nombre: 'Aceite motor',
    stockActual: '0.00',
    stockMinimo: '3.00',
  })
  const inactive = sparePartFixture({
    categoria: 'Transmision',
    codigo: 'REP-BANDA-001',
    estado: 'INACTIVO',
    id: 'part-inactive',
    nombre: 'Banda auxiliar',
    stockActual: '3.00',
    stockMinimo: '1.00',
  })

  let parts = options.empty ? [] : [available, low, empty, inactive]
  let movements = options.empty
    ? []
    : [
        sparePartMovement(available, {
          cantidad: '2.00',
          consumo: {
            id: 'consumo-rf04-1',
            orden: {
              codigo: 'OT-RF04-001',
              estado: 'EN_EJECUCION',
              id: 'order-rf04-1',
              origen: 'NOVEDAD',
              tipo: 'CORRECTIVA',
            },
          },
          direccion: 'SALIDA',
          fechaMovimiento: '2026-08-29T10:00:00.000Z',
          id: 'mov-consumo-rf04-1',
          motivo: 'Consumo registrado desde RF-04',
          tipo: 'CONSUMO',
        }),
        sparePartMovement(low, {
          cantidad: '1.00',
          direccion: 'SALIDA',
          id: 'mov-ajuste-low',
          motivo: 'Ajuste por conteo fisico',
          tipo: 'AJUSTE_SALIDA',
        }),
        sparePartMovement(inactive, {
          cantidad: '3.00',
          id: 'mov-inactive-entry',
          motivo: 'Entrada antes de desactivacion',
        }),
      ]

  function refreshPart(part: TestSparePart) {
    return decorateSparePart({
      categoria: part.categoria,
      codigo: part.codigo,
      costoUnitario: part.costoUnitario,
      createdAt: part.createdAt,
      estado: part.estado,
      id: part.id,
      nombre: part.nombre,
      stockActual: part.stockActual,
      stockMinimo: part.stockMinimo,
      unidadMedida: part.unidadMedida,
      updatedAt: '2026-08-29T10:30:00.000Z',
    })
  }

  function replacePart(next: TestSparePart) {
    parts = parts.map((part) => (part.id === next.id ? next : part))
    movements = movements.map((movement) =>
      movement.repuesto.id === next.id ? { ...movement, repuesto: movementPart(next) } : movement,
    )

    return next
  }

  function findPart(partId: string) {
    return parts.find((part) => part.id === partId)
  }

  function summary() {
    return {
      agotados: parts.filter((part) => part.disponibilidad === 'AGOTADO').length,
      bajoStock: parts.filter((part) => part.disponibilidad === 'BAJO').length,
      disponibles: parts.filter((part) => part.disponibilidad === 'DISPONIBLE').length,
      inactivos: parts.filter((part) => part.disponibilidad === 'INACTIVO').length,
      movimientosRecientes: movements.slice(0, 5),
      totalActivos: parts.filter((part) => part.estado === 'ACTIVO').length,
      totalRepuestos: parts.length,
      valorInventario: fixedDecimal(
        parts.reduce(
          (total, part) => total + Number(part.stockActual) * Number(part.costoUnitario),
          0,
        ),
      ),
    }
  }

  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/repuestos/resumen') {
      return ok(summary())
    }

    if (path === '/repuestos' && !init?.method) {
      if (options.failList) {
        return apiError(500, 'INTERNAL_ERROR', 'Fallo RF-05 controlado')
      }

      return ok(sparePartPage(parts))
    }

    if (path === '/inventario/movimientos' && !init?.method) {
      return ok(movementPage(movements))
    }

    if (path === '/repuestos' && init?.method === 'POST') {
      if (options.slowCreate) {
        await new Promise((resolve) => setTimeout(resolve, 40))
      }

      const body = parseRequestBody<{
        categoria?: string
        codigo: string
        costoUnitario: string
        nombre: string
        stockInicial: string
        stockMinimo: string
        unidadMedida: string
      }>(init)
      const code = body.codigo.trim().toUpperCase()

      if (parts.some((part) => part.codigo === code)) {
        return apiError(409, 'DUPLICATE_SPARE_PART_CODE', 'El codigo ya existe')
      }

      const part = decorateSparePart({
        categoria: body.categoria ?? null,
        codigo: code,
        costoUnitario: fixedDecimal(Number(body.costoUnitario)),
        createdAt: '2026-08-29T10:40:00.000Z',
        estado: 'ACTIVO',
        id: 'part-created',
        nombre: body.nombre.trim(),
        stockActual: fixedDecimal(Number(body.stockInicial)),
        stockMinimo: fixedDecimal(Number(body.stockMinimo)),
        unidadMedida: body.unidadMedida.trim(),
        updatedAt: '2026-08-29T10:40:00.000Z',
      })
      parts = [part, ...parts]

      const movement =
        Number(part.stockActual) > 0
          ? sparePartMovement(part, {
              cantidad: part.stockActual,
              id: 'mov-created-initial',
              motivo: 'Existencia inicial autorizada',
            })
          : null

      if (movement) {
        movements = [movement, ...movements]
      }

      return ok({ movimientoInicial: movement, repuesto: part, yaExistia: false })
    }

    const partIdMatch = path.match(/^\/repuestos\/([^/]+)(?:\/([^/]+))?$/)

    if (partIdMatch) {
      const [, partId, action] = partIdMatch
      const part = findPart(partId)

      if (!part) {
        return apiError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
      }

      if (!action && !init?.method) {
        return ok({ repuesto: part })
      }

      if (action === 'movimientos' && !init?.method) {
        return ok(movementPage(movements.filter((movement) => movement.repuesto.id === partId)))
      }

      if (!action && init?.method === 'PATCH') {
        const body = parseRequestBody<{
          categoria?: string
          codigo?: string
          costoUnitario?: string
          nombre?: string
          stockMinimo?: string
          unidadMedida?: string
        }>(init)
        const next = replacePart(
          refreshPart({
            ...part,
            categoria: body.categoria ?? part.categoria,
            codigo: body.codigo ? body.codigo.trim().toUpperCase() : part.codigo,
            costoUnitario: body.costoUnitario
              ? fixedDecimal(Number(body.costoUnitario))
              : part.costoUnitario,
            nombre: body.nombre ?? part.nombre,
            stockMinimo: body.stockMinimo
              ? fixedDecimal(Number(body.stockMinimo))
              : part.stockMinimo,
            unidadMedida: body.unidadMedida ?? part.unidadMedida,
          }),
        )

        return ok({ repuesto: next })
      }

      if (action === 'activar' && init?.method === 'POST') {
        const next = replacePart(refreshPart({ ...part, estado: 'ACTIVO' }))

        return ok({ repuesto: next, yaExistia: part.estado === 'ACTIVO' })
      }

      if (action === 'desactivar' && init?.method === 'POST') {
        const next = replacePart(refreshPart({ ...part, estado: 'INACTIVO' }))

        return ok({ repuesto: next, yaExistia: part.estado === 'INACTIVO' })
      }

      if (action === 'entradas' && init?.method === 'POST') {
        const body = parseRequestBody<{ cantidad: string; costoUnitario?: string; motivo: string }>(
          init,
        )
        const quantity = Number(body.cantidad)
        const previous = Number(part.stockActual)
        const next = replacePart(
          refreshPart({
            ...part,
            costoUnitario: body.costoUnitario
              ? fixedDecimal(Number(body.costoUnitario))
              : part.costoUnitario,
            stockActual: fixedDecimal(previous + quantity),
          }),
        )
        const movement = sparePartMovement(next, {
          cantidad: fixedDecimal(quantity),
          costoUnitario: next.costoUnitario,
          id: 'mov-entry-ui',
          motivo: body.motivo,
        })
        movements = [movement, ...movements]

        return ok({
          cantidadAplicada: movement.cantidad,
          movimiento: movement,
          repuesto: next,
          stockAnterior: fixedDecimal(previous),
          stockResultante: next.stockActual,
          yaExistia: false,
        })
      }

      if (action === 'ajustes' && init?.method === 'POST') {
        const body = parseRequestBody<{
          cantidad: string
          direccion: 'DISMINUCION' | 'INCREMENTO'
          motivo: string
        }>(init)
        const quantity = Number(body.cantidad)
        const previous = Number(part.stockActual)

        if (body.direccion === 'DISMINUCION' && quantity > previous) {
          return apiError(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente para aplicar el ajuste')
        }

        const result = body.direccion === 'INCREMENTO' ? previous + quantity : previous - quantity
        const next = replacePart(refreshPart({ ...part, stockActual: fixedDecimal(result) }))
        const movement = sparePartMovement(next, {
          cantidad: fixedDecimal(quantity),
          direccion: body.direccion === 'INCREMENTO' ? 'ENTRADA' : 'SALIDA',
          id: body.direccion === 'INCREMENTO' ? 'mov-adjust-in' : 'mov-adjust-out',
          motivo: body.motivo,
          tipo: body.direccion === 'INCREMENTO' ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
        })
        movements = [movement, ...movements]

        return ok({
          cantidadAplicada: movement.cantidad,
          movimiento: movement,
          repuesto: next,
          stockAnterior: fixedDecimal(previous),
          stockResultante: next.stockActual,
          yaExistia: false,
        })
      }
    }

    return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
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

    if (path === '/mantenimiento-preventivo/resumen') {
      return ok(preventiveSummary())
    }

    if (path === '/ordenes-trabajo/resumen') {
      return ok(workOrderSummary())
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

function preventiveHandler(
  role: RoleCode = 'ADMINISTRADOR',
  options: Partial<{ empty: boolean; failList: boolean; orderAlreadyExists: boolean }> = {},
) {
  let generated = false
  let updated = false

  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/flota/resumen') {
      return ok(fleetSummary())
    }

    if (path === '/flota/buses' && !init?.method) {
      return ok(fleetList())
    }

    if (path === '/novedades/resumen') {
      return ok(noveltySummary())
    }

    if (path === '/mantenimiento-preventivo/resumen') {
      return ok({
        ...preventiveSummary(),
        ordenesActivas: generated ? 1 : 0,
      })
    }

    if (path === '/ordenes-trabajo/resumen') {
      return ok(workOrderSummary())
    }

    if (path === '/mantenimiento-preventivo/programaciones' && !init?.method) {
      if (options.failList) {
        return apiError(500, 'INTERNAL_ERROR', 'Fallo preventivo controlado')
      }

      if (options.empty) {
        return ok(preventiveList([], 1))
      }

      return ok(
        preventiveList([
          generated ? preventiveWithOrder : updated ? preventiveUpdated : preventiveOne,
          preventiveVigente,
          preventiveVencida,
        ]),
      )
    }

    if (path === '/mantenimiento-preventivo/programaciones' && init?.method === 'POST') {
      return ok({ programacion: preventiveVigente })
    }

    if (path === '/mantenimiento-preventivo/programaciones/prev-1' && !init?.method) {
      return ok({
        programacion: generated ? preventiveWithOrder : updated ? preventiveUpdated : preventiveOne,
      })
    }

    if (path === '/mantenimiento-preventivo/programaciones/prev-1' && init?.method === 'PATCH') {
      updated = true
      return ok({ programacion: preventiveUpdated })
    }

    if (
      path === '/mantenimiento-preventivo/programaciones/prev-1/generar-orden' &&
      init?.method === 'POST'
    ) {
      generated = true
      return ok({
        orden: preventiveOrder,
        programacion: preventiveWithOrder,
        yaExistia: Boolean(options.orderAlreadyExists),
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

    fireEvent.click(screen.getAllByRole('button', { name: /Siguiente/i })[0])

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

describe('RF-03 preventive maintenance frontend', () => {
  it('loads the administrative preventive list with summary, filters and pagination', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    const fetchMock = mockApi(preventiveHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: /^Administracion del mantenimiento preventivo$/i,
      }),
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
})

describe('RF-04 work order frontend', () => {
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

  it('lets the assigned mechanic execute, consume stock and complete technically', async () => {
    window.history.pushState({}, '', '/ordenes-trabajo')
    const fetchMock = mockApi(workOrderHandler('MECANICO', { initialStatus: 'ASIGNADA' }))

    render(<App />)

    expect((await screen.findAllByText('OT-RF04-001')).length).toBeGreaterThan(0)
    fireEvent.click((await screen.findAllByRole('button', { name: /Detalle/i }))[0])
    expect(await screen.findByText(/Ejecucion tecnica/i)).toBeInTheDocument()

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
    expect(adjustmentBody.direccion).toBe('INCREMENTO')
  })
})

const historyBus = {
  anio: 2024,
  codigoInterno: 'BUS-RF06-001',
  costoAcumulado: '185000.00',
  estadoOperativo: 'OPERATIVO',
  id: 'history-bus-1',
  kilometrajeActual: 48000,
  marca: 'Mercedes-Benz',
  modelo: 'O500',
  placa: 'RF6001',
  totalOrdenes: 1,
  ultimoMantenimiento: '2026-08-12T18:00:00.000Z',
}

function historySummary(role: RoleCode) {
  return {
    alcance:
      role === 'ADMINISTRADOR'
        ? 'Toda la flota y los informes administrativos'
        : role === 'MECANICO'
          ? 'Buses con órdenes asignadas o intervenciones propias'
          : 'Bus asignado actualmente y novedades propias',
    ...(role === 'ADMINISTRADOR' ? { costoTotal: '185000.00' } : {}),
    indicadores: {
      buses: 1,
      mantenimientosProgramados: 1,
      novedades: 1,
      ordenes: 1,
      ordenesCerradas: 1,
    },
    rol: role,
  }
}

function historyDetail(role: RoleCode) {
  const isAdmin = role === 'ADMINISTRADOR'
  const isDriver = role === 'CONDUCTOR'

  return {
    asignaciones: isAdmin
      ? [
          {
            activa: true,
            asignadoPor: 'Administrador Uno',
            conductor: 'Conductor Uno',
            fechaFin: null,
            fechaInicio: '2026-08-01T10:00:00.000Z',
            id: 'history-assignment-1',
            motivo: 'Ruta principal',
          },
        ]
      : [],
    bus: {
      anio: historyBus.anio,
      codigoInterno: historyBus.codigoInterno,
      estadoOperativo: historyBus.estadoOperativo,
      id: historyBus.id,
      kilometrajeActual: historyBus.kilometrajeActual,
      marca: historyBus.marca,
      modelo: historyBus.modelo,
      placa: historyBus.placa,
    },
    estados: isDriver
      ? []
      : [
          {
            cambiadoPor: 'Administrador Uno',
            estadoAnterior: 'EN_MANTENIMIENTO',
            estadoNuevo: 'OPERATIVO',
            fechaCambio: '2026-08-12T18:00:00.000Z',
            id: 'history-state-1',
            motivo: 'Mantenimiento finalizado',
          },
        ],
    kilometrajes: isAdmin
      ? [
          {
            fechaRegistro: '2026-08-12T18:00:00.000Z',
            id: 'history-mileage-1',
            kilometrajeAnterior: 47500,
            kilometrajeNuevo: 48000,
            motivo: 'Cierre de ruta',
            registradoPor: 'Administrador Uno',
          },
        ]
      : [],
    mantenimientos: [
      {
        activa: true,
        actividad: 'Cambio de aceite y revisión de filtros',
        criterio: 'FECHA_KILOMETRAJE',
        fechaProgramada: '2026-09-15T00:00:00.000Z',
        id: 'history-schedule-1',
        kilometrajeObjetivo: 50000,
        tipo: 'Revisión 50.000 km',
      },
    ],
    novedades:
      isDriver || isAdmin
        ? [
            {
              clasificacion: 'Falla mecánica',
              descripcion: 'Vibración leve al frenar',
              estado: 'CONVERTIDA_A_ORDEN',
              fechaReporte: '2026-08-10T09:00:00.000Z',
              id: 'history-novelty-1',
              ...(isAdmin ? { reportadaPor: 'Conductor Uno' } : {}),
              tipo: 'Frenos',
            },
          ]
        : [],
    ordenes: [
      {
        codigo: 'OT-RF06-001',
        ...(isAdmin ? { costoTotal: '185000.00' } : {}),
        descripcion: 'Revisión correctiva del sistema de frenos',
        ...(!isDriver
          ? {
              diagnosticos: [
                {
                  actividades: ['Cambio de pastillas y limpieza'],
                  diagnostico: 'Desgaste de pastillas delanteras',
                  fechaFin: '2026-08-12T17:00:00.000Z',
                  fechaInicio: '2026-08-11T08:00:00.000Z',
                  observaciones: 'Prueba de frenado satisfactoria',
                  tecnico: 'Mecánico Uno',
                },
              ],
              repuestos: [
                {
                  cantidad: '2.00',
                  codigo: 'REP-RF06-001',
                  ...(isAdmin ? { costoUnitario: '92500.00', subtotal: '185000.00' } : {}),
                  nombre: 'Pastilla de freno',
                  unidadMedida: 'unidad',
                },
              ],
            }
          : {}),
        estado: 'CERRADA',
        fechaCierre: '2026-08-12T18:00:00.000Z',
        fechaCreacion: '2026-08-10T10:00:00.000Z',
        id: 'history-order-1',
        origen: 'NOVEDAD',
        tecnico: 'Mecánico Uno',
        tipo: 'CORRECTIVA',
      },
    ],
  }
}

function historyHandler(role: RoleCode, options: { noAssignment?: boolean } = {}) {
  return async (path: string): Promise<Response> => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/historial/resumen') {
      return ok(historySummary(role))
    }

    if (path === '/historial/mi-bus') {
      return ok(
        options.noAssignment
          ? { asignacion: null, historial: null }
          : {
              asignacion: {
                fechaInicio: '2026-08-01T10:00:00.000Z',
                id: 'history-assignment-1',
              },
              historial: historyDetail(role),
            },
      )
    }

    if (path === '/historial/buses') {
      return ok({
        buses: [
          role === 'ADMINISTRADOR'
            ? historyBus
            : Object.fromEntries(
                Object.entries(historyBus).filter(([key]) => key !== 'costoAcumulado'),
              ),
        ],
        paginacion: { limite: 10, pagina: 1, total: 1, totalPaginas: 1 },
      })
    }

    if (path === `/historial/buses/${historyBus.id}`) {
      return ok(historyDetail(role))
    }

    if (path === '/historial/informes/mantenimiento') {
      return ok({
        costoTotal: '185000.00',
        paginacion: { limite: 10, pagina: 1, total: 1, totalPaginas: 1 },
        registros: [
          {
            bus: 'BUS-RF06-001 · RF6001',
            codigo: 'OT-RF06-001',
            costoTotal: '185000.00',
            estado: 'CERRADA',
            fechaCierre: '2026-08-12T18:00:00.000Z',
            fechaCreacion: '2026-08-10T10:00:00.000Z',
            id: 'history-order-1',
            intervenciones: 1,
            origen: 'NOVEDAD',
            repuestosConsumidos: 1,
            tecnico: 'Mecánico Uno',
            tipo: 'CORRECTIVA',
          },
        ],
      })
    }

    if (path === '/historial/informes/repuestos') {
      return ok({
        costoTotal: '185000.00',
        paginacion: { limite: 10, pagina: 1, total: 1, totalPaginas: 1 },
        registros: [
          {
            cantidad: '2.00',
            categoria: 'Frenos',
            codigo: 'REP-RF06-001',
            costoTotal: '185000.00',
            id: 'history-part-1',
            nombre: 'Pastilla de freno',
            ordenes: 1,
            unidadMedida: 'unidad',
          },
        ],
      })
    }

    if (path === '/historial/informes/costos') {
      return ok({
        costoTotal: '185000.00',
        paginacion: { limite: 10, pagina: 1, total: 1, totalPaginas: 1 },
        registros: [
          {
            bus: 'BUS-RF06-001 · RF6001',
            busId: historyBus.id,
            cerradas: 1,
            costoPromedio: '185000.00',
            costoTotal: '185000.00',
            ordenes: 1,
          },
        ],
      })
    }

    return apiError(404, 'NOT_FOUND', 'Ruta RF-06 no encontrada')
  }
}

describe('RF-06 history and reports frontend', () => {
  it('loads the administrative history, filters, detail and three derived reports', async () => {
    window.history.pushState({}, '', '/historial')
    const fetchMock = mockApi(historyHandler('ADMINISTRADOR'))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /Historial e informes/i }),
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
