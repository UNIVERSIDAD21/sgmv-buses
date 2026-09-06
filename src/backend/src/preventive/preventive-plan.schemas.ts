import { z } from 'zod'

import { criterioMantenimientoValues, prioridadOrdenValues } from './preventive.schemas.js'

const keyPattern = /^[A-Za-z0-9._-]+$/
const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)
const positiveInteger = z.coerce.number().int().positive()
const nonNegativeInteger = z.coerce.number().int().min(0)

const planShape = z
  .object({
    actividad: trimmedText(10, 4000),
    anticipacionDias: nonNegativeInteger.optional(),
    anticipacionKm: nonNegativeInteger.optional(),
    bloqueaAlVencer: z.boolean(),
    componente: trimmedText(2, 160),
    criterio: z.enum(criterioMantenimientoValues),
    intervaloDias: positiveInteger.optional(),
    intervaloKm: positiveInteger.optional(),
    prioridad: z.enum(prioridadOrdenValues),
  })
  .strict()
  .superRefine((input, context) => {
    const needsDays = input.criterio === 'FECHA' || input.criterio === 'FECHA_KILOMETRAJE'
    const needsKm = input.criterio === 'KILOMETRAJE' || input.criterio === 'FECHA_KILOMETRAJE'

    if (needsDays !== (input.intervaloDias !== undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'El intervalo de días no corresponde al criterio',
        path: ['intervaloDias'],
      })
    }
    if (needsKm !== (input.intervaloKm !== undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'El intervalo de kilometraje no corresponde al criterio',
        path: ['intervaloKm'],
      })
    }
    if (
      input.anticipacionDias !== undefined &&
      (!input.intervaloDias || input.anticipacionDias >= input.intervaloDias)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'La anticipación en días debe ser menor que el intervalo',
        path: ['anticipacionDias'],
      })
    }
    if (
      input.anticipacionKm !== undefined &&
      (!input.intervaloKm || input.anticipacionKm >= input.intervaloKm)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'La anticipación en kilometraje debe ser menor que el intervalo',
        path: ['anticipacionKm'],
      })
    }
  })

export const planIdParamSchema = z.object({ planId: z.uuid() })

export const createPreventivePlanSchema = planShape
  .extend({
    busId: z.uuid().optional(),
    claveTarea: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(
        keyPattern,
        'La clave de tarea solo admite letras, números, punto, guion y guion bajo',
      ),
    modeloBusId: z.uuid().optional(),
  })
  .superRefine((input, context) => {
    if ((input.busId ? 1 : 0) + (input.modeloBusId ? 1 : 0) !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'Debe indicar exactamente uno entre busId y modeloBusId',
        path: ['busId'],
      })
    }
  })

export const createPreventivePlanVersionSchema = planShape

export const listPreventivePlansQuerySchema = z.object({
  activo: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  busId: z.uuid().optional(),
  claveTarea: z.string().trim().max(120).optional(),
  incluirHistoricos: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false),
  modeloBusId: z.uuid().optional(),
})

export type CreatePreventivePlanInput = z.infer<typeof createPreventivePlanSchema>
export type CreatePreventivePlanVersionInput = z.infer<typeof createPreventivePlanVersionSchema>
export type ListPreventivePlansQuery = z.infer<typeof listPreventivePlansQuerySchema>
