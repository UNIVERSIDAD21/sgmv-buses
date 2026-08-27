import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ApiError, apiRequest } from '../../lib/api'
import { SessionContext, type SessionContextValue, type SessionUser } from './session.context'

interface AuthResponse {
  user: SessionUser
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionContextValue['status']>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const response = await apiRequest<AuthResponse>('/auth/me')
      setUser(response.user)
      setStatus('authenticated')
    } catch (requestError) {
      setUser(null)
      setStatus('unauthenticated')

      if (requestError instanceof ApiError && requestError.status !== 401) {
        setError(requestError.message)
      }
    }
  }, [])

  const login = useCallback(async (credentials: { contrasena: string; email: string }) => {
    setStatus('loading')
    setError(null)

    try {
      const response = await apiRequest<AuthResponse>('/auth/login', {
        body: JSON.stringify(credentials),
        method: 'POST',
      })
      setUser(response.user)
      setStatus('authenticated')
    } catch (requestError) {
      setUser(null)
      setStatus('unauthenticated')
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'No se pudo iniciar sesión en este momento',
      )
      throw requestError
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadInitialSession() {
      try {
        const response = await apiRequest<AuthResponse>('/auth/me')

        if (!isActive) {
          return
        }

        setUser(response.user)
        setStatus('authenticated')
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setUser(null)
        setStatus('unauthenticated')

        if (requestError instanceof ApiError && requestError.status !== 401) {
          setError(requestError.message)
        }
      }
    }

    void loadInitialSession()

    return () => {
      isActive = false
    }
  }, [])

  const value = useMemo(
    () => ({
      error,
      login,
      logout,
      refreshSession,
      status,
      user,
    }),
    [error, login, logout, refreshSession, status, user],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
