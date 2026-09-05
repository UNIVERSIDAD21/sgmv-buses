import { z } from 'zod'

const uuid = z.uuid()
const eventDate = z.iso.datetime({ offset: true })
const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

export const journeyStateValues = [
  'PROGRAMADA',
  'EN_CURSO',
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
  jornadaId: uuid,
})

export const listJourneysQuerySchema = z
  .object({
    buscar: z.string().trim().max(80).optional(),
    busId: uuid.optional(),
    conductorId: uuid.optional(),
    direccion: z.enum(['asc', 'desc']).default('desc'),
    desde: eventDate.optional(),
    estado: statesQuery,
    hasta: eventDate.optional(),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    orden: z.enum(['inicioProgramado', 'estado', 'updatedAt']).default('inicioProgramado'),
    pagina: z.coerce.number().int().min(1).default(1),
    rutaId: uuid.optional(),
  })
  .refine((value) => !value.desde || !value.hasta || value.desde <= value.hasta, {
    message: 'El intervalo de consulta no es valido',
    path: ['hasta'],
  })

export const createJourneySchema = z
  .object({
    busId: uuid,
    conductorId: uuid,
    finProgramado: eventDate,
    inicioProgramado: eventDate,
    rutaId: uuid.optional(),
  })
  .strict()
  .refine((value) => value.inicioProgramado < value.finProgramado, {
    message: 'El inicio programado debe ser anterior al fin programado',
    path: ['finProgramado'],
  })

export const journeyReadingSchema = z
  .object({
    fechaEvento: eventDate,
    kilometraje: z.coerce.number().int().min(0),
  })
  .strict()

export const cancelJourneySchema = z
  .object({
    fechaEvento: eventDate,
    kilometrajeFinal: z.coerce.number().int().min(0).optional(),
    motivo: trimmedText(3, 500),
  })
  .strict()

export const reassignJourneySchema = z
  .object({
    busId: uuid.optional(),
    conductorId: uuid.optional(),
    fechaEvento: eventDate,
    finProgramado: eventDate.optional(),
    inicioProgramado: eventDate.optional(),
    kilometrajeFinal: z.coerce.number().int().min(0).optional(),
    motivo: trimmedText(3, 500),
    rutaId: uuid.nullable().optional(),
  })
  .strict()

export type CancelJourneyInput = z.infer<typeof cancelJourneySchema>
export type CreateJourneyInput = z.infer<typeof createJourneySchema>
export type JourneyReadingInput = z.infer<typeof journeyReadingSchema>
export type ListJourneysQuery = z.infer<typeof listJourneysQuerySchema>
export type ReassignJourneyInput = z.infer<typeof reassignJourneySchema>
