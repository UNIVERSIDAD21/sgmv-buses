import type { EstadoUsuario, RolCodigo } from '@prisma/client'

export interface AuthenticatedUser {
  email: string
  estado: EstadoUsuario
  id: number
  nombre: string
  rol: {
    codigo: RolCodigo
    nombre: string
  }
}

export interface SessionTokenPayload {
  email: string
  rol: RolCodigo
  sub: number
}

export interface LoginResult {
  cookieMaxAgeMs: number
  token: string
  user: AuthenticatedUser
}
