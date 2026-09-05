import { z } from 'zod'

const trimmedText = (max: number) => z.string().trim().min(1).max(max)

const optionalNullableText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().min(1).max(max).nullable().optional(),
  )

const includeInactive = z.preprocess((value) => {
  if (value === 'true') return true
  if (value === 'false' || value === undefined) return false
  return value
}, z.boolean())

const optionalSearch = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(100).optional(),
)

const specificationsSchema = z.record(z.string(), z.json())

export const modeloBusIdParamSchema = z.object({
  modeloBusId: z.uuid(),
})

export const rutaIdParamSchema = z.object({
  rutaId: z.uuid(),
})

export const catalogListQuerySchema = z.object({
  busqueda: optionalSearch,
  incluirInactivos: includeInactive,
})

export const createModeloBusSchema = z
  .object({
    especificaciones: specificationsSchema.default({}),
    marca: trimmedText(100),
    nombreModelo: trimmedText(100),
    versionTecnica: optionalNullableText(120),
  })
  .strict()

export const updateModeloBusSchema = z
  .object({
    especificaciones: specificationsSchema.optional(),
    marca: trimmedText(100).optional(),
    nombreModelo: trimmedText(100).optional(),
    versionTecnica: optionalNullableText(120),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debe enviar al menos un campo editable',
  })

export const createRutaSchema = z
  .object({
    codigo: trimmedText(80),
    destino: trimmedText(160),
    nombre: trimmedText(160),
    origen: trimmedText(160),
  })
  .strict()

export const updateRutaSchema = z
  .object({
    codigo: trimmedText(80).optional(),
    destino: trimmedText(160).optional(),
    nombre: trimmedText(160).optional(),
    origen: trimmedText(160).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debe enviar al menos un campo editable',
  })

export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>
export type CreateModeloBusInput = z.infer<typeof createModeloBusSchema>
export type CreateRutaInput = z.infer<typeof createRutaSchema>
export type UpdateModeloBusInput = z.infer<typeof updateModeloBusSchema>
export type UpdateRutaInput = z.infer<typeof updateRutaSchema>
