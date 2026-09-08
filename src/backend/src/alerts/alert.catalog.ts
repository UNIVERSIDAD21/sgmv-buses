import type { PrioridadAlerta, RolCodigo, TipoAlerta } from '@prisma/client'

export type AlertRecipientRole = Extract<
  RolCodigo,
  'ADMINISTRADOR' | 'DESPACHADOR' | 'MECANICO' | 'CONDUCTOR'
>

export type AlertOriginKind =
  'busId' | 'jornadaId' | 'novedadId' | 'ordenId' | 'programacionMantenimientoId' | 'repuestoId'

export interface AlertCatalogEntry {
  allowedRecipientRoles: readonly AlertRecipientRole[]
  contextSchemaVersion: 1
  deduplicationScope: string
  defaultPriority: PrioridadAlerta
  defaultTitle: string
  internalRoutes: Readonly<Partial<Record<AlertRecipientRole, string>>>
  originKind: AlertOriginKind
  recipientStrategy: string
}

const administrators = ['ADMINISTRADOR'] as const
const administrativeAndDispatch = ['ADMINISTRADOR', 'DESPACHADOR'] as const

export const alertCatalog = {
  MANTENIMIENTO_PROXIMO: {
    allowedRecipientRoles: administrators,
    contextSchemaVersion: 1,
    deduplicationScope: 'ciclo, version y objetivos preventivos',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Mantenimiento preventivo próximo',
    internalRoutes: { ADMINISTRADOR: '/mantenimiento-preventivo' },
    originKind: 'programacionMantenimientoId',
    recipientStrategy: 'administradores activos',
  },
  MANTENIMIENTO_VENCIDO: {
    allowedRecipientRoles: administrativeAndDispatch,
    contextSchemaVersion: 1,
    deduplicationScope: 'ciclo, version y objetivos preventivos',
    defaultPriority: 'ALTA',
    defaultTitle: 'Mantenimiento preventivo vencido',
    internalRoutes: {
      ADMINISTRADOR: '/mantenimiento-preventivo',
      DESPACHADOR: '/mantenimiento-preventivo',
    },
    originKind: 'programacionMantenimientoId',
    recipientStrategy: 'administradores y despacho solo si bloquea',
  },
  NOVEDAD_CRITICA: {
    allowedRecipientRoles: administrativeAndDispatch,
    contextSchemaVersion: 1,
    deduplicationScope: 'novedad crítica reportada',
    defaultPriority: 'CRITICA',
    defaultTitle: 'Novedad crítica reportada',
    internalRoutes: { ADMINISTRADOR: '/novedades', DESPACHADOR: '/novedades' },
    originKind: 'novedadId',
    recipientStrategy: 'administradores y despachadores activos',
  },
  BUS_BLOQUEADO: {
    allowedRecipientRoles: ['DESPACHADOR', 'CONDUCTOR'],
    contextSchemaVersion: 1,
    deduplicationScope: 'ocurrencia de bloqueo',
    defaultPriority: 'ALTA',
    defaultTitle: 'Bus bloqueado',
    internalRoutes: {
      CONDUCTOR: '/novedades',
      DESPACHADOR: '/novedades',
    },
    originKind: 'novedadId',
    recipientStrategy: 'despacho y conductor contextual',
  },
  CONFLICTO_JORNADA: {
    allowedRecipientRoles: administrativeAndDispatch,
    contextSchemaVersion: 1,
    deduplicationScope: 'bus y solicitud idempotente rechazada',
    defaultPriority: 'ALTA',
    defaultTitle: 'Conflicto de jornada rechazado',
    internalRoutes: { ADMINISTRADOR: '/jornadas', DESPACHADOR: '/jornadas' },
    originKind: 'busId',
    recipientStrategy: 'administradores y despachadores activos',
  },
  JORNADA_SIN_KILOMETRAJE_INICIAL: {
    allowedRecipientRoles: ['DESPACHADOR', 'CONDUCTOR'],
    contextSchemaVersion: 1,
    deduplicationScope: 'jornada e inicio programado',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Jornada sin kilometraje inicial',
    internalRoutes: {
      CONDUCTOR: '/jornadas',
      DESPACHADOR: '/jornadas',
    },
    originKind: 'jornadaId',
    recipientStrategy: 'despacho y conductor propietario',
  },
  JORNADA_SIN_KILOMETRAJE_FINAL: {
    allowedRecipientRoles: ['DESPACHADOR', 'CONDUCTOR'],
    contextSchemaVersion: 1,
    deduplicationScope: 'jornada y fin programado',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Jornada sin kilometraje final',
    internalRoutes: {
      CONDUCTOR: '/jornadas',
      DESPACHADOR: '/jornadas',
    },
    originKind: 'jornadaId',
    recipientStrategy: 'despacho y conductor propietario',
  },
  ORDEN_PENDIENTE_ASIGNACION: {
    allowedRecipientRoles: administrators,
    contextSchemaVersion: 1,
    deduplicationScope: 'creación de orden',
    defaultPriority: 'ALTA',
    defaultTitle: 'Orden pendiente de asignación',
    internalRoutes: { ADMINISTRADOR: '/ordenes-trabajo' },
    originKind: 'ordenId',
    recipientStrategy: 'administradores activos',
  },
  ORDEN_ASIGNADA: {
    allowedRecipientRoles: ['MECANICO'],
    contextSchemaVersion: 1,
    deduplicationScope: 'asignación o reasignación',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Orden de trabajo asignada',
    internalRoutes: { MECANICO: '/ordenes-trabajo' },
    originKind: 'ordenId',
    recipientStrategy: 'mecánico asignado en la ocurrencia',
  },
  ORDEN_COMPLETADA_TECNICO: {
    allowedRecipientRoles: ['ADMINISTRADOR'],
    contextSchemaVersion: 1,
    deduplicationScope: 'transición técnica completada',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Orden completada por técnico',
    internalRoutes: { ADMINISTRADOR: '/ordenes-trabajo' },
    originKind: 'ordenId',
    recipientStrategy: 'administradores activos',
  },
  ORDEN_DEVUELTA: {
    allowedRecipientRoles: ['MECANICO'],
    contextSchemaVersion: 1,
    deduplicationScope: 'transición devuelta a corrección',
    defaultPriority: 'ALTA',
    defaultTitle: 'Orden devuelta a corrección',
    internalRoutes: { MECANICO: '/ordenes-trabajo' },
    originKind: 'ordenId',
    recipientStrategy: 'mecánico asignado en la ocurrencia',
  },
  BAJO_INVENTARIO: {
    allowedRecipientRoles: administrators,
    contextSchemaVersion: 1,
    deduplicationScope: 'movimiento que cruza el umbral mínimo',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Nivel bajo de inventario',
    internalRoutes: { ADMINISTRADOR: '/repuestos' },
    originKind: 'repuestoId',
    recipientStrategy: 'administradores activos',
  },
  CONSUMO_INCOMPATIBLE: {
    allowedRecipientRoles: ['ADMINISTRADOR', 'MECANICO'],
    contextSchemaVersion: 1,
    deduplicationScope: 'intento idempotente rechazado',
    defaultPriority: 'ALTA',
    defaultTitle: 'Consumo incompatible rechazado',
    internalRoutes: { ADMINISTRADOR: '/ordenes-trabajo', MECANICO: '/ordenes-trabajo' },
    originKind: 'ordenId',
    recipientStrategy: 'administradores y mecánico asignado',
  },
  CAMBIO_JORNADA: {
    allowedRecipientRoles: ['DESPACHADOR', 'CONDUCTOR'],
    contextSchemaVersion: 1,
    deduplicationScope: 'alta, cancelación o reasignación',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Cambio de jornada operativa',
    internalRoutes: {
      CONDUCTOR: '/jornadas',
      DESPACHADOR: '/jornadas',
    },
    originKind: 'jornadaId',
    recipientStrategy: 'despacho y conductores afectados',
  },
  CAMBIO_ESTADO_NOVEDAD: {
    allowedRecipientRoles: ['CONDUCTOR'],
    contextSchemaVersion: 1,
    deduplicationScope: 'novedad y nuevo estado',
    defaultPriority: 'MEDIA',
    defaultTitle: 'Cambio en el estado de la novedad',
    internalRoutes: {
      CONDUCTOR: '/novedades',
    },
    originKind: 'novedadId',
    recipientStrategy: 'conductor propietario de la novedad',
  },
} as const satisfies Record<TipoAlerta, AlertCatalogEntry>

export const tipoAlertaValues = Object.keys(alertCatalog) as TipoAlerta[]
export const prioridadAlertaValues = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const
export const estadoAlertaDestinatarioValues = ['NO_LEIDA', 'LEIDA', 'ATENDIDA'] as const

export function alertCatalogEntry(type: TipoAlerta) {
  return alertCatalog[type] as AlertCatalogEntry
}
