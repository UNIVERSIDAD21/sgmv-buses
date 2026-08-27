import { z } from 'zod'

export const loginSchema = z.object({
  contrasena: z.string().min(1, 'La contrasena es obligatoria.'),
  email: z.string().trim().toLowerCase().email('Ingrese un correo electronico valido.'),
})

export type LoginInput = z.infer<typeof loginSchema>
