export type RoleCode = 'ADMINISTRADOR' | 'DESPACHADOR' | 'MECANICO' | 'CONDUCTOR'

export type AppRouteId =
  | 'inicio'
  | 'flota'
  | 'jornadas'
  | 'novedades'
  | 'mantenimiento-preventivo'
  | 'ordenes-trabajo'
  | 'ordenes-despacho'
  | 'repuestos'
  | 'historial'
  | 'mi-cuenta'
  | 'usuarios'

export type RequirementRouteId = Exclude<
  AppRouteId,
  'inicio' | 'jornadas' | 'mi-cuenta' | 'usuarios'
>

export interface RequirementNavItem {
  description: string
  id: RequirementRouteId
  label: string
  path: string
  roles: RoleCode[]
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMINISTRADOR: 'Administrador',
  DESPACHADOR: 'Despachador',
  CONDUCTOR: 'Conductor',
  MECANICO: 'Mecánico',
}

export const REQUIREMENT_NAV_ITEMS: RequirementNavItem[] = [
  {
    description: 'Consulte buses, asignaciones, kilometraje y disponibilidad operativa.',
    id: 'flota',
    label: 'Flota vehicular',
    path: '/flota',
    roles: ['ADMINISTRADOR', 'DESPACHADOR'],
  },
  {
    description: 'Revise los reportes de operación y coordine su continuidad.',
    id: 'novedades',
    label: 'Novedades operativas',
    path: '/novedades',
    roles: ['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'],
  },
  {
    description: 'Planifique mantenimientos por fecha, kilometraje o ambos criterios.',
    id: 'mantenimiento-preventivo',
    label: 'Mantenimiento preventivo',
    path: '/mantenimiento-preventivo',
    roles: ['ADMINISTRADOR', 'DESPACHADOR'],
  },
  {
    description: 'Asigne, supervise y valide el trabajo técnico de los buses.',
    id: 'ordenes-trabajo',
    label: 'Órdenes de trabajo',
    path: '/ordenes-trabajo',
    roles: ['ADMINISTRADOR', 'MECANICO'],
  },
  {
    description: 'Identifique si un bus puede salir a operación y qué lo restringe.',
    id: 'ordenes-despacho',
    label: 'Disponibilidad para despacho',
    path: '/ordenes-trabajo/despacho',
    roles: ['ADMINISTRADOR', 'DESPACHADOR'],
  },
  {
    description: 'Gestione existencias, movimientos y compatibilidad de repuestos.',
    id: 'repuestos',
    label: 'Central de repuestos',
    path: '/repuestos',
    roles: ['ADMINISTRADOR'],
  },
  {
    description: 'Consulte la trazabilidad e informes derivados de la operación.',
    id: 'historial',
    label: 'Historial e informes',
    path: '/historial',
    roles: ['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR'],
  },
]

export const BUS_STATUS_LABELS = {
  EN_MANTENIMIENTO: 'En mantenimiento',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  INACTIVO: 'Inactivo',
  OPERATIVO: 'Operativo',
} as const

export const ORDER_STATUS_LABELS = {
  ASIGNADA: 'Asignada',
  CERRADA: 'Cerrada',
  COMPLETADA_TECNICO: 'Completada por técnico',
  DEVUELTA_CORRECCION: 'Devuelta a corrección',
  EN_EJECUCION: 'En ejecución',
  PENDIENTE_ASIGNACION: 'Pendiente de asignación',
} as const

export const NOVELTY_STATUS_LABELS = {
  CONVERTIDA_A_ORDEN: 'Convertida a orden',
  DESCARTADA: 'Descartada',
  PENDIENTE_REVISION: 'Pendiente de revisión',
  RESUELTA_SIN_ORDEN: 'Resuelta sin orden',
} as const

export const PREVENTIVE_STATUS_LABELS = {
  PROXIMO: 'Proximo',
  VENCIDO: 'Vencido',
  VIGENTE: 'Vigente',
} as const

export const PREVENTIVE_CRITERION_LABELS = {
  FECHA: 'Fecha',
  FECHA_KILOMETRAJE: 'Fecha y kilometraje',
  KILOMETRAJE: 'Kilometraje',
} as const

export function getDefaultPathForRole() {
  return '/inicio'
}
