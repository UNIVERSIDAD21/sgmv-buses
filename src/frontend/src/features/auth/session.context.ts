import { createContext, useContext } from 'react'

import type { RoleCode } from '../../domain/labels'

export interface SessionUser {
  email: string
  estado: 'ACTIVO' | 'INACTIVO'
  id: string
  nombre: string
  rol: {
    codigo: RoleCode
    nombre: string
  }
}

export interface SessionContextValue {
  error: string | null
  login: (credentials: { contrasena: string; email: string }) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  status: 'authenticated' | 'loading' | 'unauthenticated'
  user: SessionUser | null
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider')
  }

  return context
}
