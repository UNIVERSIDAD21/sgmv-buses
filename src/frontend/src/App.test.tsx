// Routing, authentication, and shell regression
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { testCsrfToken, userForRole, ok, apiError, getPath, mockApi } from './test/app-test-helpers'
import App from './App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App authentication and role navigation', () => {
  it('shows a loading state while the session is being recovered', async () => {
    window.history.pushState({}, '', '/inicio')
    const admin = userForRole('ADMINISTRADOR')
    let resolveSession!: (response: Response) => void

    mockApi(async (path) => {
      if (path === '/auth/me') {
        return new Promise<Response>((resolve) => {
          resolveSession = resolve
        })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Cargando sesi.n/i)).toBeInTheDocument()
    resolveSession(ok({ user: admin }))
    expect((await screen.findAllByText(/^Administrador$/i)).length).toBeGreaterThan(0)
    expect(
      screen.queryByText(/Administrador\s*\/|Conductor\s*\/|Personal T[eé]cnico/i),
    ).not.toBeInTheDocument()
  })

  it('protects private routes when there is no active session', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Iniciar sesi.n/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('treats an expired session as unauthenticated during recovery', async () => {
    window.history.pushState({}, '', '/historial')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Iniciar sesi.n/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('redirects unknown authenticated routes to the start page', async () => {
    window.history.pushState({}, '', '/ruta-inexistente')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/inicio')
    })
    expect(await screen.findByRole('heading', { name: /Inicio/i })).toBeInTheDocument()
  })

  it('starts a real session through POST /auth/login', async () => {
    window.history.pushState({}, '', '/login')
    const admin = userForRole('ADMINISTRADOR')
    const fetchMock = mockApi(async (path, init) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      if (path === '/auth/login' && init?.method === 'POST') {
        return ok({ user: admin })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/Correo/i), {
      target: { value: admin.email },
    })
    fireEvent.change(screen.getByLabelText(/Contrase/i), {
      target: { value: 'Clave-segura-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }))

    expect((await screen.findAllByText(/^Administrador$/i)).length).toBeGreaterThan(0)
    expect(
      screen.queryByText(/Administrador\s*\/|Conductor\s*\/|Personal T[eé]cnico/i),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText(/RF-03/i).length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    const loginCall = fetchMock.mock.calls.find(([input]) => getPath(input) === '/auth/login')

    expect(new Headers(loginCall?.[1]?.headers).get('X-CSRF-Token')).toBe(testCsrfToken)
  })

  it('shows a safe error when login credentials are rejected', async () => {
    window.history.pushState({}, '', '/login')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return apiError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
      }

      if (path === '/auth/login') {
        return apiError(401, 'UNAUTHORIZED', 'Credenciales invalidas')
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/Correo/i), {
      target: { value: 'usuario@sgmv.local' },
    })
    fireEvent.change(screen.getByLabelText(/Contrase/i), {
      target: { value: 'incorrecta' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }))

    expect(
      await screen.findByText(/No fue posible iniciar sesi.n con esas credenciales/i),
    ).toBeInTheDocument()
  })

  it('recovers an existing mechanic session and limits the menu by role', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('MECANICO') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Panel t.cnico/i)).toBeInTheDocument()
    expect(screen.getAllByText(/RF-04/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/RF-06/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/RF-05/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Central de repuestos/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-01/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-02/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-03/i)).not.toBeInTheDocument()
  })

  it('limits the driver menu to assigned modules', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('CONDUCTOR') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Panel del conductor/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Jornadas operativas/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/RF-02/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/RF-06/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/RF-03/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-04/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RF-05/i)).not.toBeInTheDocument()
  })

  it('redirects unauthorized roles to the access denied screen', async () => {
    window.history.pushState({}, '', '/mantenimiento-preventivo')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('CONDUCTOR') })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
  })

  it('closes the active session through POST /auth/logout', async () => {
    window.history.pushState({}, '', '/inicio')
    mockApi(async (path) => {
      if (path === '/auth/me') {
        return ok({ user: userForRole('ADMINISTRADOR') })
      }

      if (path === '/auth/logout') {
        return ok({ ok: true })
      }

      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Cerrar sesi.n/i }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
    })
    expect(await screen.findByRole('heading', { name: /Iniciar sesi.n/i })).toBeInTheDocument()
  })
})
