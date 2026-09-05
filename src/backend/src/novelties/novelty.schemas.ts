import { z } from 'zod'

export const estadoNovedadValues = [
  'PENDIENTE_REVISION',
  'RESUELTA_SIN_ORDEN',
  'DESCARTADA',
  'CONVERTIDA_A_ORDEN',
] as const

export const prioridadOrdenValues = ['BAJA', 'MEDIA', 'ALTA'] as const
export const criticidadNovedadValues = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const

const optionalTrimmedText = (max = 500) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }

    return value
  }, z.string().trim().max(max).optional())

const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

export const noveltyIdParamSchema = z.object({
  novedadId: z.uuid(),
})

export const listNoveltiesQuerySchema = z.object({
  busqueda: optionalTrimmedText(120),
  clasificacion: optionalTrimmedText(120),
  estado: z.enum(estadoNovedadValues).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(10),
  pagina: z.coerce.number().int().min(1).default(1),
  prioridad: z.enum(prioridadOrdenValues).optional(),
  tipo: optionalTrimmedText(120),
})

export const createNoveltySchema = z
  .object({
    descripcion: trimmedText(10, 2000),
    fechaOcurrencia: z.iso.datetime({ offset: true }),
    kilometraje: z.coerce.number().int().min(0),
    tipo: trimmedText(3, 120),
  })
  .strict()

export const reviewNoveltySchema = z
  .object({
    accion: z.enum(['CLASIFICAR', 'RESOLVER_SIN_ORDEN', 'DESCARTAR']),
    afectaOperacion: z.boolean().optional(),
    bloqueaDisponibilidad: z.boolean().optional(),
    clasificacion: optionalTrimmedText(120),
    criticidad: z.enum(criticidadNovedadValues).optional(),
    observacion: optionalTrimmedText(1000),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.accion === 'CLASIFICAR' && !input.clasificacion) {
      context.addIssue({
        code: 'custom',
        message: 'La clasificacion es obligatoria al clasificar una novedad',
        path: ['clasificacion'],
      })
    }

    if (input.accion === 'CLASIFICAR' && !input.criticidad) {
      context.addIssue({
        code: 'custom',
        message: 'La criticidad es obligatoria al clasificar una novedad',
        path: ['criticidad'],
      })
    }

    if (input.accion === 'CLASIFICAR' && input.afectaOperacion === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Debe indicar si la novedad afecta la operacion',
        path: ['afectaOperacion'],
      })
    }

    if (input.accion === 'CLASIFICAR' && input.bloqueaDisponibilidad === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Debe indicar si la novedad bloquea la disponibilidad',
        path: ['bloqueaDisponibilidad'],
      })
    }

    if (input.bloqueaDisponibilidad && input.afectaOperacion !== true) {
      context.addIssue({
        code: 'custom',
        message: 'Una novedad bloqueante debe afectar la operacion',
        path: ['afectaOperacion'],
      })
    }

    if (
      input.criticidad === 'CRITICA' &&
      (!input.afectaOperacion || !input.bloqueaDisponibilidad)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Una novedad critica debe afectar y bloquear la operacion',
        path: ['criticidad'],
      })
    }

    if (
      (input.accion === 'RESOLVER_SIN_ORDEN' || input.accion === 'DESCARTAR') &&
      !input.observacion
    ) {
      context.addIssue({
        code: 'custom',
        message: 'La observacion es obligatoria para resolver o descartar',
        path: ['observacion'],
      })
    }
  })

export const convertNoveltySchema = z
  .object({
    descripcionOrden: optionalTrimmedText(2000),
    observacion: optionalTrimmedText(1000),
    prioridad: z.enum(prioridadOrdenValues).default('MEDIA'),
  })
  .strict()

export type ConvertNoveltyInput = z.infer<typeof convertNoveltySchema>
export type CreateNoveltyInput = z.infer<typeof createNoveltySchema>
export type ListNoveltiesQuery = z.infer<typeof listNoveltiesQuerySchema>
export type ReviewNoveltyInput = z.infer<typeof reviewNoveltySchema>
