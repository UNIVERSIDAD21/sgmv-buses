export type RoleCode = 'ADMINISTRADOR' | 'MECANICO' | 'CONDUCTOR'

export type AppRouteId =
  | 'inicio'
  | 'flota'
  | 'novedades'
  | 'mantenimiento-preventivo'
  | 'ordenes-trabajo'
  | 'repuestos'
  | 'historial'

export type RequirementRouteId = Exclude<AppRouteId, 'inicio'>

export interface RequirementNavItem {
  description: string
  id: RequirementRouteId
  label: string
  path: string
  roles: RoleCode[]
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMINISTRADOR: 'Administrador',
  CONDUCTOR: 'Conductor',
  MECANICO: 'Mecánico',
}

export const REQUIREMENT_NAV_ITEMS: RequirementNavItem[] = [
  {
    description: 'Registro, consulta y actualización de buses y asignaciones.',
    id: 'flota',
    label: 'RF-01 — Gestión de la flota vehicular',
    path: '/flota',
    roles: ['ADMINISTRADOR', 'CONDUCTOR'],
  },
  {
    description: 'Registro y seguimiento de novedades operativas.',
    id: 'novedades',
    label: 'RF-02 — Control de novedades operativas',
    path: '/novedades',
    roles: ['ADMINISTRADOR', 'CONDUCTOR'],
  },
  {
    description: 'Programación preventiva por fecha, kilometraje o ambos.',
    id: 'mantenimiento-preventivo',
    label: 'RF-03 — Administración del mantenimiento preventivo',
    path: '/mantenimiento-preventivo',
    roles: ['ADMINISTRADOR'],
  },
  {
    description: 'Asignación, ejecución técnica y cierre administrativo.',
    id: 'ordenes-trabajo',
    label: 'RF-04 — Seguimiento de órdenes de trabajo',
    path: '/ordenes-trabajo',
    roles: ['ADMINISTRADOR', 'MECANICO'],
  },
  {
    description: 'Catálogo, existencias, consumos y movimientos trazables.',
    id: 'repuestos',
    label: 'Central de repuestos',
    path: '/repuestos',
    roles: ['ADMINISTRADOR'],
  },
  {
    description: 'Historial e informes derivados de datos validados.',
    id: 'historial',
    label: 'RF-06 — Consulta de historial y generación de informes',
    path: '/historial',
    roles: ['ADMINISTRADOR', 'MECANICO', 'CONDUCTOR'],
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
