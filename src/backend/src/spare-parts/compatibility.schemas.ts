import { z } from 'zod'

const jsonObject = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Las especificaciones validadas no pueden estar vacias',
  })

export const compatibilityIdParamSchema = z.object({
  compatibilidadId: z.uuid(),
  repuestoId: z.uuid(),
})

export const createCompatibilitySchema = z
  .object({
    busId: z.uuid().optional(),
    condicionUso: z.string().trim().max(1000).optional(),
    especificacionesValidadas: jsonObject,
    modeloBusId: z.uuid().optional(),
    permitido: z.boolean(),
  })
  .strict()
  .refine((input) => Number(Boolean(input.busId)) + Number(Boolean(input.modeloBusId)) === 1, {
    message: 'Debe indicar exactamente busId o modeloBusId',
  })

export type CreateCompatibilityInput = z.infer<typeof createCompatibilitySchema>
