import type { EstadoOrdenTrabajo } from '@prisma/client'

import { AppError } from '../shared/http.js'

export const workOrderStateValues = [
  'PENDIENTE_ASIGNACION',
  'ASIGNADA',
  'EN_EJECUCION',
  'COMPLETADA_TECNICO',
  'DEVUELTA_CORRECCION',
  'CERRADA',
] as const satisfies readonly EstadoOrdenTrabajo[]

export const workOrderTypeValues = ['PREVENTIVA', 'CORRECTIVA'] as const
export const workOrderOriginValues = ['PREVENTIVO', 'CORRECTIVO_DIRECTO', 'NOVEDAD'] as const
export const workOrderPriorityValues = ['BAJA', 'MEDIA', 'ALTA'] as const

export const activeWorkOrderStates: EstadoOrdenTrabajo[] = [
  'PENDIENTE_ASIGNACION',
  'ASIGNADA',
  'EN_EJECUCION',
  'COMPLETADA_TECNICO',
  'DEVUELTA_CORRECCION',
]

export const reassignableWorkOrderStates: EstadoOrdenTrabajo[] = [
  'ASIGNADA',
  'EN_EJECUCION',
  'DEVUELTA_CORRECCION',
]

const allowedTransitions: Record<EstadoOrdenTrabajo, EstadoOrdenTrabajo[]> = {
  ASIGNADA: ['EN_EJECUCION'],
  CERRADA: [],
  COMPLETADA_TECNICO: ['CERRADA', 'DEVUELTA_CORRECCION'],
  DEVUELTA_CORRECCION: ['EN_EJECUCION'],
  EN_EJECUCION: ['COMPLETADA_TECNICO'],
  PENDIENTE_ASIGNACION: ['ASIGNADA'],
}

export function canTransitionWorkOrder(
  estadoAnterior: EstadoOrdenTrabajo,
  estadoNuevo: EstadoOrdenTrabajo,
) {
  return allowedTransitions[estadoAnterior].includes(estadoNuevo)
}

export function assertWorkOrderTransition(
  estadoAnterior: EstadoOrdenTrabajo,
  estadoNuevo: EstadoOrdenTrabajo,
) {
  if (!canTransitionWorkOrder(estadoAnterior, estadoNuevo)) {
    throw new AppError(
      400,
      'INVALID_ORDER_TRANSITION',
      `No se permite cambiar la orden de ${estadoAnterior} a ${estadoNuevo}`,
    )
  }
}
