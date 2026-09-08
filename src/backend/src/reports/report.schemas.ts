import { z } from 'zod'

import {
  workOrderOriginValues,
  workOrderStateValues,
  workOrderTypeValues,
} from '../work-orders/work-order.state.js'

const alertPriorityValues = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const
const alertRecipientStateValues = ['NO_LEIDA', 'LEIDA', 'ATENDIDA'] as const
const alertTypeValues = [
  'MANTENIMIENTO_PROXIMO',
  'MANTENIMIENTO_VENCIDO',
  'NOVEDAD_CRITICA',
  'BUS_BLOQUEADO',
  'CONFLICTO_JORNADA',
  'JORNADA_SIN_KILOMETRAJE_INICIAL',
  'JORNADA_SIN_KILOMETRAJE_FINAL',
  'ORDEN_PENDIENTE_ASIGNACION',
  'ORDEN_ASIGNADA',
  'ORDEN_COMPLETADA_TECNICO',
  'ORDEN_DEVUELTA',
  'BAJO_INVENTARIO',
  'CONSUMO_INCOMPATIBLE',
  'CAMBIO_JORNADA',
  'CAMBIO_ESTADO_NOVEDAD',
] as const
const compatibilityResultValues = [
  'COMPATIBLE',
  'EXCEPCION_AUTORIZADA',
  'NO_EVALUADA_LEGADO',
] as const

const optionalTrimmedText = (max = 120) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }

    return value
  }, z.string().trim().max(max).optional())

const optionalDate = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined
  }

  return value
}, z.iso.date().optional())

const optionalInteger = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}, z.coerce.number().int().min(0).optional())

const optionalBoolean = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}, z.boolean().optional())

const reportFilters = z
  .object({
    alertaEstado: z.enum(alertRecipientStateValues).optional(),
    alertaPrioridad: z.enum(alertPriorityValues).optional(),
    alertaTipo: z.enum(alertTypeValues).optional(),
    busId: z.uuid().optional(),
    busqueda: optionalTrimmedText(),
    compatibilidad: z.enum(compatibilityResultValues).optional(),
    conductorId: z.uuid().optional(),
    disponibilidadAlCierre: optionalBoolean,
    estado: z.enum(workOrderStateValues).optional(),
    fechaDesde: optionalDate,
    fechaHasta: optionalDate,
    jornadaId: z.uuid().optional(),
    kilometrajeDesde: optionalInteger,
    kilometrajeHasta: optionalInteger,
    limite: z.coerce.number().int().min(1).max(100).optional(),
    origen: z.enum(workOrderOriginValues).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    pagina: z.coerce.number().int().min(1).optional(),
    novedadCriticidad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
    novedadEstado: z
      .enum(['PENDIENTE_REVISION', 'RESUELTA_SIN_ORDEN', 'DESCARTADA', 'CONVERTIDA_A_ORDEN'])
      .optional(),
    novedadTipo: optionalTrimmedText(),
    repuestoId: z.uuid().optional(),
    tipo: z.enum(workOrderTypeValues).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.fechaDesde && input.fechaHasta && input.fechaDesde > input.fechaHasta) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha inicial no puede ser posterior a la fecha final',
        path: ['fechaHasta'],
      })
    }
    if (
      input.kilometrajeDesde !== undefined &&
      input.kilometrajeHasta !== undefined &&
      input.kilometrajeDesde > input.kilometrajeHasta
    ) {
      context.addIssue({
        code: 'custom',
        message: 'El kilometraje inicial no puede ser superior al final',
        path: ['kilometrajeHasta'],
      })
    }
  })
  .transform(({ limite, page, pageSize, pagina, ...filters }) => ({
    ...filters,
    limite: limite ?? pageSize ?? 10,
    pagina: pagina ?? page ?? 1,
  }))

export const reportQuerySchema = reportFilters

export const busHistoryParamSchema = z.object({
  busId: z.uuid(),
})

export type ReportQuery = z.infer<typeof reportQuerySchema>
