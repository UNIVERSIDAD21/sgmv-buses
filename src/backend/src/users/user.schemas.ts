import { z } from 'zod'

import { entityIdSchema } from '../shared/entity-id.js'

export const roleCodeValues = ['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR'] as const

export const userStateValues = ['PENDIENTE_ACTIVACION', 'ACTIVO', 'BLOQUEADO', 'INACTIVO'] as const

const manageableUserStateValues = ['ACTIVO', 'BLOQUEADO', 'INACTIVO'] as const
const requiredText = (max: number) => z.string().trim().min(1).max(max)
const optionalPhone = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(7).max(20).optional(),
)

export const passwordSchema = z
  .string()
  .min(12, 'La contrasena debe tener al menos 12 caracteres.')
  .max(72, 'La contrasena no puede superar 72 caracteres.')
  .regex(/[a-z]/, 'La contrasena debe incluir una minuscula.')
  .regex(/[A-Z]/, 'La contrasena debe incluir una mayuscula.')
  .regex(/[0-9]/, 'La contrasena debe incluir un numero.')
  .regex(/[^A-Za-z0-9]/, 'La contrasena debe incluir un caracter especial.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'La contrasena no puede superar 72 bytes.',
  })

export const userIdParamSchema = z.object({
  usuarioId: entityIdSchema,
})

export const listUsersQuerySchema = z.object({
  busqueda: z.string().trim().max(120).optional(),
  estado: z.enum(userStateValues).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  pagina: z.coerce.number().int().min(1).default(1),
  rol: z.enum(roleCodeValues).optional(),
})

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(120).email(),
    nombre: requiredText(120),
    rol: z.enum(roleCodeValues),
    telefono: optionalPhone,
  })
  .strict()

export const updateUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(120).email().optional(),
    nombre: requiredText(120).optional(),
    telefono: z.union([z.string().trim().min(7).max(20), z.null()]).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debe enviar al menos un dato editable.',
  })

export const changeUserRoleSchema = z.object({ rol: z.enum(roleCodeValues) }).strict()

export const changeUserStateSchema = z
  .object({ estado: z.enum(manageableUserStateValues) })
  .strict()

export const activateAccountSchema = z
  .object({
    contrasena: passwordSchema,
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Codigo de activacion invalido.'),
  })
  .strict()

export const changeOwnPasswordSchema = z
  .object({
    contrasenaActual: z.string().min(1).max(72),
    contrasenaNueva: passwordSchema,
  })
  .strict()

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>
export type ChangeUserStateInput = z.infer<typeof changeUserStateSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
