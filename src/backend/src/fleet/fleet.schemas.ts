import { z } from 'zod'

export const estadoBusValues = [
  'OPERATIVO',
  'EN_MANTENIMIENTO',
  'FUERA_DE_SERVICIO',
  'INACTIVO',
] as const

const optionalTrimmedText = (max = 500) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }

    return value
  }, z.string().trim().max(max).optional())

const trimmedText = (max: number) => z.string().trim().min(1).max(max)

const currentYear = new Date().getFullYear()

export const busIdParamSchema = z.object({
  busId: z.uuid(),
})

export const listBusesQuerySchema = z.object({
  busqueda: optionalTrimmedText(80),
  estado: z.enum(estadoBusValues).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(10),
  pagina: z.coerce.number().int().min(1).default(1),
})

export const historyQuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(20),
})

export const availableDriversQuerySchema = z.object({
  busId: z.uuid().optional(),
})

export const createBusSchema = z
  .object({
    anio: z.coerce
      .number()
      .int()
      .min(1980)
      .max(currentYear + 1),
    codigoInterno: trimmedText(60),
    estadoOperativo: z.enum(estadoBusValues).default('OPERATIVO'),
    kilometrajeActual: z.coerce.number().int().min(0).default(0),
    marca: trimmedText(100),
    modelo: trimmedText(100),
    motivoEstado: optionalTrimmedText(500),
    placa: trimmedText(20),
  })
  .strict()

export const updateBusSchema = z
  .object({
    anio: z.coerce
      .number()
      .int()
      .min(1980)
      .max(currentYear + 1)
      .optional(),
    codigoInterno: trimmedText(60).optional(),
    marca: trimmedText(100).optional(),
    modelo: trimmedText(100).optional(),
    placa: trimmedText(20).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debe enviar al menos un campo editable',
  })

export const registerMileageSchema = z
  .object({
    kilometrajeNuevo: z.coerce.number().int().min(0),
    motivo: optionalTrimmedText(500),
  })
  .strict()

export const changeBusStateSchema = z
  .object({
    estadoNuevo: z.enum(estadoBusValues),
    motivo: z.string().trim().min(3).max(500),
  })
  .strict()

export const assignDriverSchema = z
  .object({
    conductorId: z.uuid(),
    motivo: optionalTrimmedText(500),
  })
  .strict()

export type AssignDriverInput = z.infer<typeof assignDriverSchema>
export type ChangeBusStateInput = z.infer<typeof changeBusStateSchema>
export type CreateBusInput = z.infer<typeof createBusSchema>
export type ListBusesQuery = z.infer<typeof listBusesQuerySchema>
export type RegisterMileageInput = z.infer<typeof registerMileageSchema>
export type UpdateBusInput = z.infer<typeof updateBusSchema>
