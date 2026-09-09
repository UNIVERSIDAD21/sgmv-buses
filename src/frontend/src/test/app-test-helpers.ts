// Shared isolated fixtures and API factories for module-scoped frontend suites.
import { vi } from 'vitest'

import type { RoleCode } from '../domain/labels'
import type { CompatibilityRuleDto } from '../features/repuestos/spare-part.types'

export const testCsrfToken = 'csrf-token-verificable-de-prueba'

export const roleNames: Record<RoleCode, string> = {
  ADMINISTRADOR: 'Administrador',
  DESPACHADOR: 'Despachador',
  CONDUCTOR: 'Conductor',
  MECANICO: 'Mecánico',
}

export function userForRole(role: RoleCode) {
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

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

export function ok(data: unknown) {
  return jsonResponse({ data })
}

export function apiError(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, status)
}

export function getPath(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return new URL(input).pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  return new URL(input.url).pathname
}

export function mockApi(handler: (path: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = getPath(input)

    if (path === '/auth/csrf') {
      return Promise.resolve(ok({ csrfToken: testCsrfToken }))
    }

    if (path === '/alertas/no-leidas/count') {
      return Promise.resolve(ok({ count: 0 }))
    }

    if (path === '/alertas') {
      return Promise.resolve(ok({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }))
    }

    return handler(path, init)
  })

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

export const fleetBus = {
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
  modeloBus: {
    activo: true,
    id: 'model-1',
    marca: 'Mercedes-Benz',
    nombreModelo: 'OF-1721',
    versionTecnica: 'Euro V',
  },
  placa: 'ABC123',
  updatedAt: '2026-08-27T11:00:00.000Z',
}

export const catalogModel = {
  activo: true,
  busesAsociados: 1,
  createdAt: '2026-09-04T12:00:00.000Z',
  especificaciones: { combustible: 'Diesel' },
  id: 'model-1',
  marca: 'Mercedes-Benz',
  nombreModelo: 'OF-1721',
  updatedAt: '2026-09-04T12:00:00.000Z',
  versionTecnica: 'Euro V',
}

export const catalogRoute = {
  activa: true,
  codigo: 'RUTA-CENTRO-NORTE',
  createdAt: '2026-09-04T12:00:00.000Z',
  destino: 'Terminal Norte',
  id: 'route-1',
  jornadasAsociadas: 0,
  nombre: 'Centro - Norte',
  origen: 'Patio Central',
  updatedAt: '2026-09-04T12:00:00.000Z',
}

export function fleetSummary() {
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

export function fleetList(overrides: Partial<{ buses: unknown[]; totalPaginas: number }> = {}) {
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

export function journeyFixture(
  status: 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' | 'REASIGNADA' = 'PROGRAMADA',
) {
  const inProgress = status === 'EN_CURSO' || status === 'FINALIZADA'
  const finished = status === 'FINALIZADA'
  return {
    acciones: {
      puedeCancelar: status === 'PROGRAMADA' || status === 'EN_CURSO',
      puedeFinalizar: status === 'EN_CURSO',
      puedeIniciar: status === 'PROGRAMADA',
      puedeReasignar: status === 'PROGRAMADA' || status === 'EN_CURSO',
    },
    bus: {
      codigoInterno: 'BUS-JORNADA-01',
      estadoOperativo: 'OPERATIVO',
      id: 'bus-journey-1',
      placa: 'JOR001',
    },
    cambioPor: null,
    causasDisponibilidad: [],
    conductor: { id: 'user-conductor', nombre: 'Conductor', rol: 'CONDUCTOR' },
    estado: status,
    fechaCambio: null,
    finProgramado: '2026-09-06T22:00:00.000Z',
    finReal: finished ? '2026-09-06T21:45:00.000Z' : null,
    finalizadaPor: finished
      ? { id: 'user-conductor', nombre: 'Conductor', rol: 'CONDUCTOR' }
      : null,
    id: 'journey-1',
    iniciadaPor: inProgress
      ? { id: 'user-conductor', nombre: 'Conductor', rol: 'CONDUCTOR' }
      : null,
    inicioProgramado: '2026-09-06T14:00:00.000Z',
    inicioReal: inProgress ? '2026-09-06T14:05:00.000Z' : null,
    jornadaAnteriorId: null,
    jornadaSucesoraId: null,
    lecturaFinal: finished
      ? {
          fechaLectura: '2026-09-06T21:45:00.000Z',
          id: 'reading-end-1',
          kilometraje: 45250,
          kilometrajeAnterior: 45000,
          registradoPor: { id: 'user-conductor', nombre: 'Conductor', rol: 'CONDUCTOR' },
          tipo: 'FIN_JORNADA',
        }
      : null,
    lecturaInicial: inProgress
      ? {
          fechaLectura: '2026-09-06T14:05:00.000Z',
          id: 'reading-start-1',
          kilometraje: 45000,
          kilometrajeAnterior: 44900,
          registradoPor: { id: 'user-conductor', nombre: 'Conductor', rol: 'CONDUCTOR' },
          tipo: 'INICIO_JORNADA',
        }
      : null,
    motivoCambio: null,
    programadaPor: { id: 'user-despachador', nombre: 'Despachador', rol: 'DESPACHADOR' },
    ruta: {
      codigo: 'RUTA-01',
      destino: 'Terminal Norte',
      id: 'route-1',
      nombre: 'Centro - Norte',
      origen: 'Patio Central',
    },
    updatedAt: '2026-09-06T14:05:00.000Z',
  }
}

export function journeyOptions() {
  return {
    buses: [
      {
        codigoInterno: 'BUS-JORNADA-01',
        estadoOperativo: 'OPERATIVO',
        id: 'bus-journey-1',
        kilometrajeActual: 45000,
        placa: 'JOR001',
      },
    ],
    conductores: [{ id: 'user-conductor', nombre: 'Conductor' }],
    rutas: [
      {
        codigo: 'RUTA-01',
        destino: 'Terminal Norte',
        id: 'route-1',
        nombre: 'Centro - Norte',
        origen: 'Patio Central',
      },
    ],
  }
}

export const noveltyOrder = {
  codigo: 'OT-NOV-001',
  descripcion: 'Orden correctiva generada desde novedad',
  estado: 'PENDIENTE_ASIGNACION',
  fechaCreacion: '2026-08-27T12:30:00.000Z',
  id: 'order-1',
  origen: 'NOVEDAD',
  prioridad: 'MEDIA',
  tipo: 'CORRECTIVA',
}

export const noveltyOne = {
  acciones: {
    puedeConvertir: true,
    puedeCoordinarJornada: false,
    puedeRevisar: true,
  },
  afectaOperacion: null,
  bloqueaDisponibilidad: null,
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
  criticidad: null,
  descripcion: 'Se escucha ruido al frenar en pendientes durante la ruta.',
  estado: 'PENDIENTE_REVISION',
  fechaOcurrencia: '2026-08-27T11:55:00.000Z',
  fechaReporte: '2026-08-27T12:00:00.000Z',
  fechaRevision: null,
  id: 'nov-1',
  jornada: {
    estado: 'EN_CURSO',
    finReal: null,
    id: 'journey-1',
    inicioReal: '2026-08-27T10:00:00.000Z',
    ruta: {
      codigo: 'RUTA-01',
      destino: 'Terminal Norte',
      id: 'route-1',
      nombre: 'Centro - Norte',
      origen: 'Patio Central',
    },
  },
  lecturaKilometraje: {
    fechaLectura: '2026-08-27T11:55:00.000Z',
    id: 'reading-novelty-1',
    kilometraje: 45010,
    kilometrajeAnterior: 45000,
    tipo: 'NOVEDAD',
  },
  observacionRevision: null,
  ordenTrabajo: null,
  revisadaPor: null,
  tipo: 'Ruido en frenos',
  updatedAt: '2026-08-27T12:00:00.000Z',
}

export const reviewedNovelty = {
  ...noveltyOne,
  acciones: {
    puedeConvertir: true,
    puedeCoordinarJornada: true,
    puedeRevisar: true,
  },
  afectaOperacion: true,
  bloqueaDisponibilidad: true,
  clasificacion: 'Falla mecanica',
  criticidad: 'CRITICA',
  fechaRevision: '2026-08-27T12:10:00.000Z',
  observacionRevision: 'Revisada por administrador',
  revisadaPor: {
    id: 'admin-1',
    nombre: 'Administrador Uno',
  },
}

export const convertedNovelty = {
  ...reviewedNovelty,
  acciones: {
    puedeConvertir: false,
    puedeCoordinarJornada: true,
    puedeRevisar: false,
  },
  estado: 'CONVERTIDA_A_ORDEN',
  ordenTrabajo: noveltyOrder,
}

export function noveltySummary() {
  return {
    afectanOperacion: 1,
    bloqueantes: 1,
    criticas: 1,
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

export function noveltyList(novedades: unknown[] = [noveltyOne], totalPaginas = 2) {
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

export const preventiveOrder = {
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

export const preventiveOne = {
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
  plan: null,
  prioridad: null,
  fuente: 'INDEPENDIENTE',
  tipo: 'Revision preventiva',
  updatedAt: '2026-08-27T12:00:00.000Z',
}

export const preventiveVigente = {
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

export const preventiveVencida = {
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
  plan: {
    anticipacionDiasEfectiva: 7,
    anticipacionKmEfectiva: 500,
    claveTarea: 'ELECTRICO.001',
    id: 'plan-schedule-1',
    origen: 'MODELO',
    version: 2,
  },
  prioridad: 'ALTA',
  fuente: 'PLAN',
  tipo: 'Sistema electrico',
}

export const preventiveWithOrder = {
  ...preventiveOne,
  ordenActiva: preventiveOrder,
}

export const preventiveUpdated = {
  ...preventiveOne,
  actividad: 'Revision preventiva reprogramada.',
  kilometrajeObjetivo: 11600,
}

export function preventiveSummary() {
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

export function preventiveList(
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

export const workOrderAdmin = {
  email: 'admin@sgmv.local',
  id: 'user-administrador',
  nombre: 'Administrador',
  telefono: null,
}

export const workOrderMechanic = {
  email: 'mecanico@sgmv.local',
  id: 'user-mecanico',
  nombre: 'Mecanico Uno',
  telefono: null,
}

export const workOrderMechanicAlt = {
  email: 'mecanico-alt@sgmv.local',
  id: 'user-mecanico-alt',
  nombre: 'Mecanico Dos',
  telefono: null,
}

export const workOrderPart = {
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

export const workOrderAvailablePart = {
  ...workOrderPart,
  compatibilidad: {
    condicionUso: null,
    reglaId: null,
    resultado: 'SIN_EVIDENCIA',
    version: null,
  },
}

export function workOrderSummary() {
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

export function workOrderStateHistory(estadoNuevo: string, estadoAnterior: string | null = null) {
  return {
    cambiadoPor: workOrderAdmin,
    estadoAnterior,
    estadoNuevo,
    fechaCambio: '2026-08-28T12:00:00.000Z',
    id: `history-${estadoNuevo}-${estadoAnterior ?? 'inicio'}`,
    observacion: estadoAnterior ? 'Transicion RF-04' : 'Orden creada',
  }
}

export function workOrderActions(
  order: { estado: string; tecnicoAsignado: unknown },
  role: RoleCode,
) {
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

export function createWorkOrderDetail(status = 'PENDIENTE_ASIGNACION') {
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
    autorizacionesExcepcion: [],
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
    jornadaOperativa: {
      estado: 'FINALIZADA',
      finProgramado: '2026-08-28T11:30:00.000Z',
      finReal: '2026-08-28T11:25:00.000Z',
      id: 'journey-rf04-1',
      inicioProgramado: '2026-08-28T08:00:00.000Z',
      inicioReal: '2026-08-28T08:05:00.000Z',
      ruta: { codigo: 'R-01', id: 'route-1', nombre: 'Centro Norte' },
    },
    lecturasTecnicas: [],
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
    disponibilidadAlCierre: status === 'CERRADA' ? true : null,
    tecnicoAsignado,
    tipo: 'CORRECTIVA',
  }
}

export function workOrderList(order: ReturnType<typeof createWorkOrderDetail>) {
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

const restrictedEconomicFields = new Set(['costoTotal', 'costoUnitario', 'subtotal'])

function projectWorkOrderForRole<T>(value: T, role: RoleCode): T {
  if (role === 'ADMINISTRADOR') return value

  return JSON.parse(
    JSON.stringify(value, (key, nestedValue) =>
      restrictedEconomicFields.has(key) ? undefined : nestedValue,
    ),
  ) as T
}

export function workOrderHandler(
  role: RoleCode = 'ADMINISTRADOR',
  options: Partial<{ empty: boolean; failList: boolean; initialStatus: string }> = {},
) {
  let order = createWorkOrderDetail(options.initialStatus ?? 'PENDIENTE_ASIGNACION')

  function decoratedOrder() {
    return projectWorkOrderForRole(
      {
        ...order,
        acciones: workOrderActions(order, role),
      },
      role,
    )
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

    if (path === '/ordenes-trabajo/despacho') {
      return ok({
        ordenes: [
          {
            disponibilidad: {
              causaPrincipal: order.estado === 'CERRADA' ? null : 'ORDEN_TRABAJO_ACTIVA',
              causas:
                order.estado === 'CERRADA'
                  ? []
                  : [{ codigo: 'ORDEN_TRABAJO_ACTIVA', mensaje: 'Orden tecnica activa' }],
              disponible: order.estado === 'CERRADA',
              evaluadoAt: '2026-08-28T12:51:00.000Z',
            },
            orden: {
              bus: {
                codigoInterno: order.bus.codigoInterno,
                id: order.bus.id,
                placa: order.bus.placa,
              },
              codigo: order.codigo,
              disponibilidadAlCierre: order.disponibilidadAlCierre,
              estado: order.estado,
              fechaCierre: order.fechaCierre,
              id: order.id,
            },
          },
        ],
      })
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
      return ok({ repuestos: [projectWorkOrderForRole(workOrderAvailablePart, role)] })
    }

    if (path.endsWith('/excepciones-consumo') && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body ?? '{}')) as {
        cantidadMaxima: string
        fechaExpiracion?: string
        intervencionId: string
        motivo: string
        repuestoId: string
      }
      const authorization = {
        autorizadoPor: { id: workOrderAdmin.id, nombre: workOrderAdmin.nombre },
        cantidadMaxima: payload.cantidadMaxima,
        estado: 'VIGENTE',
        fechaAutorizacion: '2026-08-28T12:15:00.000Z',
        fechaExpiracion: payload.fechaExpiracion ?? null,
        id: 'authorization-p8-1',
        intervencionId: payload.intervencionId,
        motivo: payload.motivo,
        repuesto: workOrderPart,
      }
      order = {
        ...order,
        autorizacionesExcepcion: [authorization],
      }

      return ok({ autorizacion: authorization })
    }

    if (path.endsWith('/excepciones-consumo/authorization-p8-1/revocar')) {
      const authorization = {
        ...order.autorizacionesExcepcion[0],
        estado: 'REVOCADA',
      }
      order = { ...order, autorizacionesExcepcion: [authorization] }

      return ok({ autorizacion: authorization })
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

      return ok({
        consumo: projectWorkOrderForRole(order.consumosRepuesto[0], role),
        orden: decoratedOrder(),
        yaExistia: false,
      })
    }

    if (path.endsWith('/lecturas') && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body ?? '{}')) as {
        fechaEvento: string
        kilometraje: number
        motivo?: string
        tipo: 'INGRESO_TALLER' | 'REVISION_TECNICA' | 'CIERRE_MANTENIMIENTO'
      }
      order = {
        ...order,
        lecturasTecnicas: [
          ...order.lecturasTecnicas,
          {
            fechaLectura: payload.fechaEvento,
            id: `technical-reading-${order.lecturasTecnicas.length + 1}`,
            intervencionId: payload.tipo === 'REVISION_TECNICA' ? 'intervention-1' : null,
            kilometraje: payload.kilometraje,
            kilometrajeAnterior: fleetBus.kilometrajeActual,
            motivo: payload.motivo ?? null,
            registradoPor: role === 'MECANICO' ? workOrderMechanic : workOrderAdmin,
            tipo: payload.tipo,
          },
        ],
      }

      return ok({ orden: decoratedOrder() })
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
        disponibilidadAlCierre: true,
        fechaCierre: '2026-08-28T12:50:00.000Z',
      }
      appendHistory('COMPLETADA_TECNICO', 'CERRADA')

      return ok({ orden: decoratedOrder() })
    }

    return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
  }
}

export type TestSparePart = {
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

export type TestMovement = {
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

export function fixedDecimal(value: number) {
  return value.toFixed(2)
}

export function sparePartAvailability(
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

export function decorateSparePart(part: Omit<TestSparePart, 'disponibilidad' | 'valorActual'>) {
  const stock = Number(part.stockActual)
  const cost = Number(part.costoUnitario)

  return {
    ...part,
    disponibilidad: sparePartAvailability(part),
    valorActual: fixedDecimal(stock * cost),
  }
}

export function movementPart(part: TestSparePart): TestMovement['repuesto'] {
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

export function sparePartFixture(
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

export function sparePartMovement(part: TestSparePart, overrides: Partial<TestMovement> = {}) {
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

export function sparePartPage(repuestos: TestSparePart[], pagina = 1, limite = 8) {
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

export function movementPage(movimientos: TestMovement[], pagina = 1, limite = 6) {
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

export function parseRequestBody<T>(init?: RequestInit) {
  return JSON.parse(String(init?.body ?? '{}')) as T
}

export function sparePartHandler(
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
  let compatibilityRules: CompatibilityRuleDto[] = []
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

    if (path === '/flota/buses' && !init?.method) {
      return ok(fleetList())
    }

    if (path === '/flota/modelos-bus' && !init?.method) {
      return ok({ modelosBus: [catalogModel] })
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

    const compatibilityMatch = path.match(
      /^\/repuestos\/([^/]+)\/compatibilidades(?:\/([^/]+)\/inactivar)?$/,
    )

    if (compatibilityMatch) {
      const [, partId, compatibilityId] = compatibilityMatch
      const part = findPart(partId)

      if (!part) {
        return apiError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
      }

      if (!compatibilityId && !init?.method) {
        return ok({ compatibilidades: compatibilityRules })
      }

      if (!compatibilityId && init?.method === 'POST') {
        const body = parseRequestBody<{
          busId?: string
          condicionUso?: string
          especificacionesValidadas: Record<string, unknown>
          modeloBusId?: string
          permitido: boolean
        }>(init)
        const targetRules = compatibilityRules.filter(
          (rule) =>
            rule.busId === (body.busId ?? null) && rule.modeloBusId === (body.modeloBusId ?? null),
        )
        compatibilityRules = compatibilityRules.map((rule) =>
          targetRules.some((target) => target.id === rule.id) ? { ...rule, vigente: false } : rule,
        )
        const rule: CompatibilityRuleDto = {
          bus: body.busId ? { codigoInterno: fleetBus.codigoInterno, id: fleetBus.id } : null,
          busId: body.busId ?? null,
          condicionUso: body.condicionUso ?? null,
          definidaPor: { id: 'user-administrador', nombre: 'Administrador' },
          especificacionesValidadas: body.especificacionesValidadas,
          fechaDefinicion: '2026-09-07T16:00:00.000Z',
          id: `compatibility-${compatibilityRules.length + 1}`,
          modeloBus: body.modeloBusId
            ? {
                id: catalogModel.id,
                marca: catalogModel.marca,
                nombreModelo: catalogModel.nombreModelo,
              }
            : null,
          modeloBusId: body.modeloBusId ?? null,
          permitido: body.permitido,
          version: targetRules.length + 1,
          vigente: true,
        }
        compatibilityRules = [rule, ...compatibilityRules]

        return ok({ compatibilidad: rule })
      }

      if (compatibilityId && init?.method === 'POST') {
        const current = compatibilityRules.find((rule) => rule.id === compatibilityId)
        if (!current) {
          return apiError(404, 'COMPATIBILITY_RULE_NOT_FOUND', 'Regla no encontrada')
        }
        const compatibility = { ...current, vigente: false }
        compatibilityRules = compatibilityRules.map((rule) =>
          rule.id === compatibilityId ? compatibility : rule,
        )

        return ok({ compatibilidad: compatibility })
      }
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

export function fleetHandler(role: RoleCode = 'ADMINISTRADOR') {
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

    if (path === '/flota/modelos-bus' && !init?.method) {
      return ok({ modelosBus: [catalogModel] })
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

export function journeyHandler(
  role: RoleCode = 'DESPACHADOR',
  options: { empty?: boolean; fail?: boolean } = {},
) {
  let currentStatus: 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' = 'PROGRAMADA'

  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }
    if (path === '/jornadas/opciones') {
      return options.fail
        ? apiError(500, 'INTERNAL_ERROR', 'Fallo controlado de jornadas')
        : ok(journeyOptions())
    }
    if (path === '/jornadas/mi-jornada') {
      if (options.fail) return apiError(500, 'INTERNAL_ERROR', 'Fallo controlado de jornadas')
      const journey = options.empty ? null : journeyFixture(currentStatus)
      return ok({
        jornadaActual: currentStatus === 'EN_CURSO' ? journey : null,
        proximaJornada: currentStatus === 'PROGRAMADA' ? journey : null,
      })
    }
    if (path === '/jornadas' && !init?.method) {
      if (options.fail) return apiError(500, 'INTERNAL_ERROR', 'Fallo controlado de jornadas')
      const jornadas = options.empty ? [] : [journeyFixture(currentStatus)]
      return ok({
        jornadas,
        paginacion: { limite: 12, pagina: 1, paginas: 1, total: jornadas.length },
      })
    }
    if (path === '/jornadas' && init?.method === 'POST') {
      return ok({ jornada: journeyFixture('PROGRAMADA') })
    }
    if (path === '/jornadas/journey-1/iniciar' && init?.method === 'POST') {
      currentStatus = 'EN_CURSO'
      return ok({ jornada: journeyFixture(currentStatus) })
    }
    if (path === '/jornadas/journey-1/finalizar' && init?.method === 'POST') {
      currentStatus = 'FINALIZADA'
      return ok({ jornada: journeyFixture(currentStatus) })
    }
    if (path === '/jornadas/journey-1/cancelar' && init?.method === 'POST') {
      return ok({
        jornada: {
          ...journeyFixture('CANCELADA'),
          acciones: {
            puedeCancelar: false,
            puedeFinalizar: false,
            puedeIniciar: false,
            puedeReasignar: false,
          },
        },
      })
    }
    if (path === '/jornadas/journey-1/reasignar' && init?.method === 'POST') {
      return ok({
        jornadaAnterior: journeyFixture('REASIGNADA'),
        jornadaSucesora: {
          ...journeyFixture('PROGRAMADA'),
          id: 'journey-2',
          jornadaAnteriorId: 'journey-1',
        },
      })
    }
    if (path === '/novedades/mis-novedades') {
      return ok(noveltyList([noveltyOne], 1))
    }

    return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
  }
}

export function noveltyHandler(
  role: RoleCode = 'ADMINISTRADOR',
  options: Partial<{ empty: boolean; failList: boolean; noBus: boolean }> = {},
) {
  let converted = false
  let reviewed = false

  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/jornadas/mi-jornada') {
      return ok({
        jornadaActual: options.noBus ? null : journeyFixture('EN_CURSO'),
        proximaJornada: null,
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

export function preventiveHandler(
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

    if (path === '/flota/modelos-bus' && !init?.method) {
      return ok({
        modelosBus: [
          {
            activo: true,
            busesAsociados: 1,
            id: 'model-1',
            marca: 'Volvo',
            nombreModelo: 'B340',
            updatedAt: '2026-09-01T00:00:00.000Z',
            versionTecnica: null,
          },
        ],
      })
    }
    if (path === '/mantenimiento-preventivo/planes' && !init?.method) {
      return ok({
        planes: [
          {
            activa: true,
            actividad: 'Revision preventiva de frenos completa.',
            anticipacionDias: 7,
            anticipacionKm: null,
            bloqueaAlVencer: true,
            claveTarea: 'FRENOS.001',
            componente: 'Frenos',
            criterio: 'FECHA',
            destino: { busId: 'bus-1', tipo: 'BUS' },
            id: 'plan-1',
            intervaloDias: 30,
            intervaloKm: null,
            prioridad: 'MEDIA',
            programacionesAsociadas: 1,
            version: 1,
          },
        ],
      })
    }
    if (path === '/mantenimiento-preventivo/planes' && init?.method === 'POST')
      return ok({ plan: { id: 'plan-new' } })
    if (path === '/mantenimiento-preventivo/planes/plan-1' && !init?.method)
      return ok({
        plan: {
          activa: true,
          claveTarea: 'FRENOS.001',
          id: 'plan-1',
          version: 1,
        },
        versiones: [
          {
            activa: true,
            actividad: 'Revision preventiva de frenos completa.',
            anticipacionDias: 7,
            anticipacionKm: null,
            bloqueaAlVencer: true,
            claveTarea: 'FRENOS.001',
            componente: 'Frenos',
            criterio: 'FECHA',
            destino: { busId: 'bus-1', tipo: 'BUS' },
            id: 'plan-1',
            intervaloDias: 30,
            intervaloKm: null,
            prioridad: 'MEDIA',
            programacionesAsociadas: 1,
            version: 1,
          },
        ],
      })
    if (path === '/mantenimiento-preventivo/planes/plan-1/versiones' && init?.method === 'POST')
      return ok({ plan: { id: 'plan-2' } })
    if (path === '/mantenimiento-preventivo/planes/plan-1/desactivar' && init?.method === 'POST')
      return ok({ plan: { id: 'plan-1', activa: false } })
    if (path === '/mantenimiento-preventivo/restricciones') {
      return ok({
        evaluadoAt: '2026-09-06T00:00:00.000Z',
        restricciones: [
          {
            bloqueaDespacho: true,
            bus: { codigoInterno: 'ABC123', id: 'bus-1' },
            estado: 'VENCIDO',
            objetivos: { fecha: '2026-09-01', kilometraje: null },
            programacionId: 'prev-1',
            restantes: { dias: -5, kilometros: null },
            restriccion: 'PREVENTIVO_VENCIDO_BLOQUEANTE',
          },
        ],
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
      const body = JSON.parse(String(init.body)) as { planId?: string }
      return body.planId
        ? ok({ programacion: preventiveVencida, yaExistia: false })
        : ok({ programacion: preventiveVigente })
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

export function fleetCatalogHandler(
  role: RoleCode = 'ADMINISTRADOR',
  options: Partial<{ empty: boolean; fail: boolean }> = {},
) {
  let model = { ...catalogModel }
  let route = { ...catalogRoute }

  return async (path: string, init?: RequestInit) => {
    if (path === '/auth/me') {
      return ok({ user: userForRole(role) })
    }

    if (path === '/flota/modelos-bus' && !init?.method) {
      if (options.fail) return apiError(500, 'INTERNAL_ERROR', 'Fallo de catalogos controlado')
      return ok({ modelosBus: options.empty ? [] : [model] })
    }

    if (path === '/flota/rutas' && !init?.method) {
      return ok({ rutas: options.empty ? [] : [route] })
    }

    if (path === '/flota/modelos-bus' && init?.method === 'POST') {
      return ok({ modeloBus: model })
    }

    if (path === '/flota/modelos-bus/model-1') {
      if (init?.method === 'PATCH') {
        model = { ...model, nombreModelo: 'OF-1722' }
      }
      return ok({ modeloBus: model })
    }

    if (path === '/flota/modelos-bus/model-1/desactivar') {
      model = { ...model, activo: false }
      return ok({ modeloBus: model })
    }

    if (path === '/flota/modelos-bus/model-1/activar') {
      model = { ...model, activo: true }
      return ok({ modeloBus: model })
    }

    if (path === '/flota/rutas' && init?.method === 'POST') {
      return ok({ ruta: route })
    }

    if (path === '/flota/rutas/route-1' && init?.method === 'PATCH') {
      route = { ...route, destino: 'Terminal Sur' }
      return ok({ ruta: route })
    }

    if (path === '/flota/rutas/route-1/desactivar') {
      route = { ...route, activa: false }
      return ok({ ruta: route })
    }

    if (path === '/flota/rutas/route-1/activar') {
      route = { ...route, activa: true }
      return ok({ ruta: route })
    }

    return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
  }
}

export const historyBus = {
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

export function historySummary(role: RoleCode) {
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

export function historyDetail(role: RoleCode) {
  const isAdmin = role === 'ADMINISTRADOR'
  const isDriver = role === 'CONDUCTOR'
  const canViewTechnicalDetails = isAdmin || role === 'MECANICO'

  return {
    alertas: [
      {
        ...(isAdmin ? {} : { estado: 'NO_LEIDA' }),
        fechaGeneracion: '2026-08-10T09:05:00.000Z',
        id: 'history-alert-1',
        prioridad: 'ALTA',
        tipo: 'NOVEDAD_CRITICA',
        titulo: 'Novedad crítica reportada',
      },
    ],
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
    jornadas: [
      {
        conductor: 'Conductor Uno',
        estado: 'FINALIZADA',
        finReal: '2026-08-12T18:00:00.000Z',
        finProgramado: '2026-08-12T17:00:00.000Z',
        id: 'history-journey-1',
        inicioReal: '2026-08-10T07:00:00.000Z',
        inicioProgramado: '2026-08-10T07:00:00.000Z',
        lecturas: [
          {
            fechaLectura: '2026-08-10T07:00:00.000Z',
            id: 'history-journey-reading-1',
            kilometraje: 47500,
            tipo: 'INICIO_JORNADA',
          },
          {
            fechaLectura: '2026-08-12T18:00:00.000Z',
            id: 'history-journey-reading-2',
            kilometraje: 48000,
            tipo: 'FIN_JORNADA',
          },
        ],
        ruta: { codigo: 'R-01', nombre: 'Centro norte' },
      },
    ],
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
        ...(canViewTechnicalDetails
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
                  compatibilidad: {
                    evidencia: { fuente: 'fixture-frontend-p10' },
                    reglaId: 'history-rule-1',
                    reglaVersion: 1,
                    resultado: 'COMPATIBLE',
                  },
                  ...(isAdmin ? { costoUnitario: '92500.00', subtotal: '185000.00' } : {}),
                  fechaConsumo: '2026-08-11T12:00:00.000Z',
                  movimiento: {
                    cantidad: '2.00',
                    fechaMovimiento: '2026-08-11T12:00:00.000Z',
                    id: 'history-movement-1',
                    tipo: 'CONSUMO',
                  },
                  nombre: 'Pastilla de freno',
                  unidadMedida: 'unidad',
                },
              ],
            }
          : {}),
        estado: 'CERRADA',
        disponibilidadAlCierre: true,
        fechaCierre: '2026-08-12T18:00:00.000Z',
        fechaCreacion: '2026-08-10T10:00:00.000Z',
        id: 'history-order-1',
        jornada: {
          estado: 'FINALIZADA',
          id: 'history-journey-1',
          ruta: { codigo: 'R-01', nombre: 'Centro norte' },
        },
        origen: 'NOVEDAD',
        tecnico: 'Mecánico Uno',
        tipo: 'CORRECTIVA',
      },
    ],
  }
}

export function historyHandler(role: RoleCode, options: { noAssignment?: boolean } = {}) {
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
