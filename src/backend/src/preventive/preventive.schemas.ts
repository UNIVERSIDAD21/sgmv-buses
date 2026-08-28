import { z } from 'zod'

export const criterioMantenimientoValues = ['FECHA', 'KILOMETRAJE', 'FECHA_KILOMETRAJE'] as const
export const preventiveClassificationValues = ['VIGENTE', 'PROXIMO', 'VENCIDO'] as const
export const prioridadOrdenValues = ['BAJA', 'MEDIA', 'ALTA'] as const

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

const optionalTrimmedText = (max = 500) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }

    return value
  }, z.string().trim().max(max).optional())

const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)
const dateOnly = z.string().regex(dateOnlyPattern, 'Debe usar formato YYYY-MM-DD')

function hasDate(value: { fechaProgramada?: string }) {
  return Boolean(value.fechaProgramada)
}

function hasMileage(value: { kilometrajeObjetivo?: number }) {
  return value.kilometrajeObjetivo !== undefined
}

function validateCriterionShape(
  input: {
    criterio: (typeof criterioMantenimientoValues)[number]
    fechaProgramada?: string
    kilometrajeObjetivo?: number
  },
  context: z.RefinementCtx,
) {
  if (input.criterio === 'FECHA') {
    if (!hasDate(input)) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha programada es obligatoria para el criterio por fecha',
        path: ['fechaProgramada'],
      })
    }

    if (hasMileage(input)) {
      context.addIssue({
        code: 'custom',
        message: 'El kilometraje no aplica cuando el criterio es solo fecha',
        path: ['kilometrajeObjetivo'],
      })
    }
  }

  if (input.criterio === 'KILOMETRAJE') {
    if (!hasMileage(input)) {
      context.addIssue({
        code: 'custom',
        message: 'El kilometraje objetivo es obligatorio para el criterio por kilometraje',
        path: ['kilometrajeObjetivo'],
      })
    }

    if (hasDate(input)) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha no aplica cuando el criterio es solo kilometraje',
        path: ['fechaProgramada'],
      })
    }
  }

  if (input.criterio === 'FECHA_KILOMETRAJE') {
    if (!hasDate(input)) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha programada es obligatoria para el criterio combinado',
        path: ['fechaProgramada'],
      })
    }

    if (!hasMileage(input)) {
      context.addIssue({
        code: 'custom',
        message: 'El kilometraje objetivo es obligatorio para el criterio combinado',
        path: ['kilometrajeObjetivo'],
      })
    }
  }
}

export const programacionIdParamSchema = z.object({
  programacionId: z.uuid(),
})

export const listPreventiveSchedulesQuerySchema = z.object({
  activa: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  busId: z.uuid().optional(),
  busqueda: optionalTrimmedText(120),
  criterio: z.enum(criterioMantenimientoValues).optional(),
  direccion: z.enum(['asc', 'desc']).default('desc'),
  estado: z.enum(preventiveClassificationValues).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(10),
  ordenarPor: z
    .enum(['actividad', 'bus', 'createdAt', 'estado', 'fechaProgramada', 'kilometrajeObjetivo'])
    .default('createdAt'),
  pagina: z.coerce.number().int().min(1).default(1),
})

export const createPreventiveScheduleSchema = z
  .object({
    actividad: trimmedText(10, 2000),
    busId: z.uuid(),
    criterio: z.enum(criterioMantenimientoValues),
    fechaProgramada: dateOnly.optional(),
    kilometrajeObjetivo: z.coerce.number().int().positive().optional(),
    tipo: trimmedText(3, 120),
  })
  .strict()
  .superRefine(validateCriterionShape)

export const updatePreventiveScheduleSchema = z
  .object({
    activa: z.boolean().optional(),
    actividad: trimmedText(10, 2000).optional(),
    criterio: z.enum(criterioMantenimientoValues).optional(),
    fechaProgramada: dateOnly.optional(),
    kilometrajeObjetivo: z.coerce.number().int().positive().optional(),
    tipo: trimmedText(3, 120).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debe enviar al menos un campo editable',
  })

export const generatePreventiveOrderSchema = z
  .object({
    descripcionOrden: optionalTrimmedText(2000),
    observacion: optionalTrimmedText(1000),
    prioridad: z.enum(prioridadOrdenValues).default('MEDIA'),
  })
  .strict()

export type CreatePreventiveScheduleInput = z.infer<typeof createPreventiveScheduleSchema>
export type GeneratePreventiveOrderInput = z.infer<typeof generatePreventiveOrderSchema>
export type ListPreventiveSchedulesQuery = z.infer<typeof listPreventiveSchedulesQuerySchema>
export type UpdatePreventiveScheduleInput = z.infer<typeof updatePreventiveScheduleSchema>
