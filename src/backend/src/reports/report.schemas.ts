import { z } from 'zod'

import {
  workOrderOriginValues,
  workOrderStateValues,
  workOrderTypeValues,
} from '../work-orders/work-order.state.js'

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

const reportFilters = z
  .object({
    busId: z.uuid().optional(),
    busqueda: optionalTrimmedText(),
    estado: z.enum(workOrderStateValues).optional(),
    fechaDesde: optionalDate,
    fechaHasta: optionalDate,
    limite: z.coerce.number().int().min(1).max(100).optional(),
    origen: z.enum(workOrderOriginValues).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    pagina: z.coerce.number().int().min(1).optional(),
    tipo: z.enum(workOrderTypeValues).optional(),
  })
  .superRefine((input, context) => {
    if (input.fechaDesde && input.fechaHasta && input.fechaDesde > input.fechaHasta) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha inicial no puede ser posterior a la fecha final',
        path: ['fechaHasta'],
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
