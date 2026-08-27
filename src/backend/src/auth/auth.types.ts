import type { EstadoUsuario, RolCodigo } from '@prisma/client'

export interface AuthenticatedUser {
  email: string
  estado: EstadoUsuario
  id: string
  nombre: string
  rol: {
    codigo: RolCodigo
    nombre: string
  }
}

export interface SessionTokenPayload {
  email: string
  rol: RolCodigo
  sub: string
}

export interface LoginResult {
  cookieMaxAgeMs: number
  token: string
  user: AuthenticatedUser
}
