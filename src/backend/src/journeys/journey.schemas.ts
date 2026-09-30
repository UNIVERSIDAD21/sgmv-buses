import { entityIdSchema } from '../shared/entity-id.js'
import { z } from 'zod'

const eventDate = z.iso.datetime({ offset: true })
const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

const simulationSchema = z
  .object({
    ciclosCompletosSimulados: z.number().int().min(1).max(100),
    kmNoComercialesSimulados: z.number().min(0).max(1000).multipleOf(0.001).default(0),
  })
  .strict()

export const journeyStateValues = [
  'PROGRAMADA',
  'EN_CURSO',
  'INTERRUMPIDA',
  'FINALIZADA',
  'CANCELADA',
  'REASIGNADA',
] as const

const statesQuery = z.preprocess(
  (value) => {
    if (typeof value === 'string') return value.split(',').filter(Boolean)
    return value
  },
  z.array(z.enum(journeyStateValues)).max(journeyStateValues.length).optional(),
)

export const journeyIdParamSchema = z.object({
  jornadaId: entityIdSchema,
})
export const reportClosureProblemSchema = z.object({ motivo: trimmedText(10, 500) }).strict()

export const listJourneysQuerySchema = z
  .object({
    buscar: z.string().trim().max(80).optional(),
    cierreAtrasado: z.enum(['true', 'false']).optional(),
    busId: entityIdSchema.optional(),
    conductorId: entityIdSchema.optional(),
    direccion: z.enum(['asc', 'desc']).default('desc'),
    desde: eventDate.optional(),
    estado: statesQuery,
    hasta: eventDate.optional(),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    orden: z.enum(['inicioProgramado', 'estado', 'updatedAt']).default('inicioProgramado'),
    pagina: z.coerce.number().int().min(1).default(1),
    rutaId: entityIdSchema.optional(),
  })
  .refine(
    (value) => !value.desde || !value.hasta || Date.parse(value.desde) <= Date.parse(value.hasta),
    {
      message: 'El intervalo de consulta no es valido',
      path: ['hasta'],
    },
  )

export const createJourneySchema = z
  .object({
    simulacion: simulationSchema.optional(),
    busId: entityIdSchema,
    conductorId: entityIdSchema,
    finProgramado: eventDate,
    inicioProgramado: eventDate,
    rutaId: entityIdSchema.optional(),
  })
  .strict()
  .refine((value) => Date.parse(value.inicioProgramado) < Date.parse(value.finProgramado), {
    message: 'El inicio programado debe ser anterior al fin programado',
    path: ['finProgramado'],
  })

export const journeyReadingSchema = z
  .object({
    fechaEvento: eventDate,
    observadoPorId: entityIdSchema.optional(),
    motivoRespaldo: trimmedText(3, 500).optional(),
    kilometraje: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() ? Number(value) : value),
      z.number().int().min(0),
    ),
  })
  .strict()

export const interruptJourneySchema = z
  .object({
    fechaEvento: eventDate,
    motivo: trimmedText(10, 500),
    kilometrajeFinal: z.coerce.number().int().min(0).optional(),
    motivoSinLectura: trimmedText(3, 500).optional(),
    observadoPorId: entityIdSchema.optional(),
    motivoRespaldo: trimmedText(3, 500).optional(),
  })
  .strict()
  .refine(
    (value) => (value.kilometrajeFinal === undefined) !== (value.motivoSinLectura === undefined),
    {
      message: 'Indique lectura física final o motivo de ausencia, nunca ambos',
    },
  )

export const reconcileFinalReadingSchema = z
  .object({
    kilometraje: z.number().int().min(0),
    observadoPorId: entityIdSchema,
    motivoRespaldo: trimmedText(3, 500).optional(),
    declaracionObservacion: trimmedText(20, 500),
    confirmadaEnInterrupcion: z.literal(true),
  })
  .strict()

export const markReadingUnrecoverableSchema = z
  .object({
    motivo: trimmedText(10, 500),
  })
  .strict()

export const cancelJourneySchema = z
  .object({
    fechaEvento: eventDate,
    observadoPorId: entityIdSchema.optional(),
    motivoRespaldo: trimmedText(3, 500).optional(),
    kilometrajeFinal: z.coerce.number().int().min(0).optional(),
    motivo: trimmedText(3, 500),
  })
  .strict()

export const reassignJourneySchema = z
  .object({
    simulacion: simulationSchema.optional(),
    busId: entityIdSchema.optional(),
    conductorId: entityIdSchema.optional(),
    fechaEvento: eventDate,
    observadoPorId: entityIdSchema.optional(),
    motivoRespaldo: trimmedText(3, 500).optional(),
    finProgramado: eventDate.optional(),
    inicioProgramado: eventDate.optional(),
    kilometrajeFinal: z.coerce.number().int().min(0).optional(),
    motivo: trimmedText(3, 500),
    rutaId: entityIdSchema.nullable().optional(),
  })
  .strict()

export type CancelJourneyInput = z.infer<typeof cancelJourneySchema>
export type CreateJourneyInput = z.infer<typeof createJourneySchema>
export type JourneyReadingInput = z.infer<typeof journeyReadingSchema>
export type InterruptJourneyInput = z.infer<typeof interruptJourneySchema>
export type ReconcileFinalReadingInput = z.infer<typeof reconcileFinalReadingSchema>
export type MarkReadingUnrecoverableInput = z.infer<typeof markReadingUnrecoverableSchema>
export type ListJourneysQuery = z.infer<typeof listJourneysQuerySchema>
export type ReassignJourneyInput = z.infer<typeof reassignJourneySchema>
