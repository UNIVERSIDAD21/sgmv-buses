import { z } from 'zod'

import {
  workOrderOriginValues,
  workOrderPriorityValues,
  workOrderStateValues,
  workOrderTypeValues,
} from './work-order.state.js'

const optionalTrimmedText = (max = 500) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }

    return value
  }, z.string().trim().max(max).optional())

const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

const decimalQuantity = z.union([z.string(), z.number()]).transform((value, context) => {
  const text = String(value).trim().replace(',', '.')

  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
    context.addIssue({
      code: 'custom',
      message: 'La cantidad debe ser positiva y tener maximo dos decimales',
    })

    return z.NEVER
  }

  if (Number(text) <= 0) {
    context.addIssue({
      code: 'custom',
      message: 'La cantidad debe ser mayor que cero',
    })

    return z.NEVER
  }

  return text
})

export const orderIdParamSchema = z.object({
  ordenId: z.uuid(),
})

export const listWorkOrdersQuerySchema = z.object({
  busId: z.uuid().optional(),
  busqueda: optionalTrimmedText(120),
  direccion: z.enum(['asc', 'desc']).default('desc'),
  estado: z.enum(workOrderStateValues).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(10),
  ordenarPor: z
    .enum(['fechaCreacion', 'codigo', 'estado', 'prioridad', 'fechaCierre', 'costoTotal', 'bus'])
    .default('fechaCreacion'),
  origen: z.enum(workOrderOriginValues).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tecnicoId: z.uuid().optional(),
  tipo: z.enum(workOrderTypeValues).optional(),
})

export const availableMechanicsQuerySchema = z.object({
  busqueda: optionalTrimmedText(120),
  limite: z.coerce.number().int().min(1).max(100).default(100),
})

export const availablePartsQuerySchema = z.object({
  busqueda: optionalTrimmedText(120),
  limite: z.coerce.number().int().min(1).max(100).default(20),
})

export const createManualWorkOrderSchema = z
  .object({
    busId: z.uuid(),
    descripcion: trimmedText(10, 2000),
    prioridad: z.enum(workOrderPriorityValues).default('MEDIA'),
    tipo: z.enum(workOrderTypeValues).default('CORRECTIVA'),
  })
  .strict()

export const assignWorkOrderSchema = z
  .object({
    observacion: optionalTrimmedText(1000),
    tecnicoId: z.uuid(),
  })
  .strict()

export const reassignWorkOrderSchema = z
  .object({
    motivo: trimmedText(3, 1000),
    tecnicoId: z.uuid(),
  })
  .strict()

export const transitionObservationSchema = z
  .object({
    observacion: optionalTrimmedText(1000),
  })
  .strict()

export const interventionUpdateSchema = z
  .object({
    diagnostico: optionalTrimmedText(3000),
    observaciones: optionalTrimmedText(3000),
  })
  .strict()
  .refine((input) => input.diagnostico !== undefined || input.observaciones !== undefined, {
    message: 'Debe enviar diagnostico u observaciones tecnicas',
  })

export const createActivitySchema = z
  .object({
    descripcion: trimmedText(3, 2000),
  })
  .strict()

export const createConsumptionSchema = z
  .object({
    cantidad: decimalQuantity,
    claveIdempotencia: z.uuid(),
    repuestoId: z.uuid(),
  })
  .strict()

export const returnWorkOrderSchema = z
  .object({
    motivo: trimmedText(3, 1000),
  })
  .strict()

export type AssignWorkOrderInput = z.infer<typeof assignWorkOrderSchema>
export type AvailableMechanicsQuery = z.infer<typeof availableMechanicsQuerySchema>
export type AvailablePartsQuery = z.infer<typeof availablePartsQuerySchema>
export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type CreateConsumptionInput = z.infer<typeof createConsumptionSchema>
export type CreateManualWorkOrderInput = z.infer<typeof createManualWorkOrderSchema>
export type InterventionUpdateInput = z.infer<typeof interventionUpdateSchema>
export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuerySchema>
export type ReassignWorkOrderInput = z.infer<typeof reassignWorkOrderSchema>
export type ReturnWorkOrderInput = z.infer<typeof returnWorkOrderSchema>
export type TransitionObservationInput = z.infer<typeof transitionObservationSchema>
