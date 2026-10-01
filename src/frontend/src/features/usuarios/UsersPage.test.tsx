import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../../App'
import { apiError, getPath, mockApi, ok, userForRole } from '../../test/app-test-helpers'

const activationToken = 'A'.repeat(43)
const userRecord = {
  bloqueadoHasta: null,
  createdAt: '2026-09-14T01:00:00.000Z',
  email: 'nuevo.conductor@sgmv.local',
  estado: 'PENDIENTE_ACTIVACION',
  id: 3101,
  nombre: 'Nuevo Conductor',
  rol: { codigo: 'CONDUCTOR', id: 4, nombre: 'Conductor' },
  telefono: '3001234567',
  ultimoAccesoAt: null,
  updatedAt: '2026-09-14T01:00:00.000Z',
}

function listResult(items = [userRecord]) {
  return { items, limite: 20, pagina: 1, paginas: 1, total: items.length }
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Administracion de usuarios y activacion', () => {
  it('muestra jornadas y OT antes de inactivar o cambiar rol', async () => {
    window.history.pushState({}, '', '/usuarios')
    const account = { ...userRecord, estado: 'ACTIVO' as const }
    mockApi(async (path) => {
      if (path === '/auth/me') return ok({ user: userForRole('ADMINISTRADOR') })
      if (path === '/usuarios') return ok(listResult([account]))
      if (path === `/usuarios/${account.id}/impacto`)
        return ok({
          jornadas: [
            {
              id: 2401,
              estado: 'PROGRAMADA',
              inicioProgramado: '2026-10-02T13:00:00.000Z',
              bus: { codigoInterno: 'BUS-01' },
            },
          ],
          ordenes: [
            { id: 2501, codigo: 'OT-2501', estado: 'ASIGNADA', bus: { codigoInterno: 'BUS-02' } },
          ],
        })
      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })
    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Gestionar/i }))[0]!)
    const dialog = screen.getByRole('dialog', { name: /Gestionar usuario/i })
    expect(
      await within(dialog).findByText(
        /1 jornadas activas o programadas pendientes; 1 órdenes asignadas/i,
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/Jornada #2401/)).toBeInTheDocument()
    expect(within(dialog).getByText(/OT OT-2501/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(/no reasigna tareas ni cambia autores históricos/i),
    ).toBeInTheDocument()
  })

  it('permite bloqueo urgente aunque falle la previsualización', async () => {
    window.history.pushState({}, '', '/usuarios')
    const account = { ...userRecord, estado: 'ACTIVO' as const }
    const fetchMock = mockApi(async (path, init) => {
      if (path === '/auth/me') return ok({ user: userForRole('ADMINISTRADOR') })
      if (path === '/usuarios') return ok(listResult([account]))
      if (path === `/usuarios/${account.id}/impacto`)
        return apiError(500, 'PREVIEW_ERROR', 'No disponible')
      if (path === `/usuarios/${account.id}/estado` && init?.method === 'PATCH')
        return ok({ ...account, estado: 'BLOQUEADO' })
      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })
    render(<App />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Gestionar/i }))[0]!)
    const dialog = screen.getByRole('dialog', { name: /Gestionar usuario/i })
    expect(await within(dialog).findByText(/No disponible/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cambiar rol' })).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Estado'), { target: { value: 'BLOQUEADO' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bloquear acceso ahora' }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            getPath(input) === `/usuarios/${account.id}/estado` && init?.method === 'PATCH',
        ),
      ).toBe(true),
    )
  })
  it('lista, busca y filtra cuentas con los cuatro roles oficiales', async () => {
    window.history.pushState({}, '', '/usuarios')
    const fetchMock = mockApi(async (path) => {
      if (path === '/auth/me') return ok({ user: userForRole('ADMINISTRADOR') })
      if (path === '/usuarios') return ok(listResult())
      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /^Usuarios$/i })).toBeInTheDocument()
    expect(await screen.findAllByText('Nuevo Conductor')).toHaveLength(2)
    expect(screen.getByTestId('user-card-list')).toBeInTheDocument()
    expect(screen.getByTestId('user-table')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Gestionar/i })).toHaveLength(2)
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre o correo/i), {
      target: { value: 'conductor' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /Filtrar por rol/i }), {
      target: { value: 'CONDUCTOR' },
    })

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(typeof input === 'string' ? input : input.url)
          return url.pathname === '/usuarios' && url.searchParams.get('rol') === 'CONDUCTOR'
        }),
      ).toBe(true),
    )

    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/i }))
    const dialog = screen.getByRole('dialog', { name: /Nuevo usuario/i })
    expect(
      within(dialog)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Administrador', 'Despachador', 'Mecánico', 'Conductor'])
  })

  it('crea una cuenta pendiente y mantiene el codigo fuera del DOM', async () => {
    window.history.pushState({}, '', '/usuarios')
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const fetchMock = mockApi(async (path, init) => {
      if (path === '/auth/me') return ok({ user: userForRole('ADMINISTRADOR') })
      if (path === '/usuarios' && init?.method === 'POST') {
        return ok({
          activacion: { expiraAt: '2026-09-15T01:00:00.000Z', token: activationToken },
          usuario: userRecord,
        })
      }
      if (path === '/usuarios') return ok(listResult())
      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo usuario/i }))
    const dialog = screen.getByRole('dialog', { name: /Nuevo usuario/i })
    fireEvent.change(within(dialog).getByLabelText(/^Nombre$/i), {
      target: { value: userRecord.nombre },
    })
    fireEvent.change(within(dialog).getByLabelText(/Correo de acceso/i), {
      target: { value: userRecord.email },
    })
    fireEvent.change(within(dialog).getByLabelText(/Rol inicial/i), {
      target: { value: 'CONDUCTOR' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Crear cuenta/i }))

    const delivery = await screen.findByRole('dialog', { name: /Cuenta pendiente/i })
    expect(within(delivery).queryByText(activationToken)).not.toBeInTheDocument()
    fireEvent.click(within(delivery).getByRole('button', { name: /Copiar c.digo una vez/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(activationToken))
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) => getPath(input) === '/usuarios' && init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({ rol: 'CONDUCTOR' })
  })

  it('muestra errores controlados de alta y no inventa un rol', async () => {
    window.history.pushState({}, '', '/usuarios')
    mockApi(async (path, init) => {
      if (path === '/auth/me') return ok({ user: userForRole('ADMINISTRADOR') })
      if (path === '/usuarios' && init?.method === 'POST') {
        return apiError(409, 'EMAIL_ALREADY_EXISTS', 'Ya existe una cuenta con ese correo')
      }
      if (path === '/usuarios') return ok(listResult([]))
      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo usuario/i }))
    const dialog = screen.getByRole('dialog', { name: /Nuevo usuario/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /Crear cuenta/i }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/obligatorios/i)
    fireEvent.change(within(dialog).getByLabelText(/^Nombre$/i), { target: { value: 'Duplicado' } })
    fireEvent.change(within(dialog).getByLabelText(/Correo de acceso/i), {
      target: { value: userRecord.email },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Crear cuenta/i }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Ya existe/i)
  })

  it('activa una cuenta precreada y nunca ofrece registro publico', async () => {
    window.history.pushState({}, '', '/activar-cuenta')
    mockApi(async (path, init) => {
      if (path === '/auth/me') return apiError(401, 'UNAUTHORIZED', 'Sin sesion')
      if (path === '/auth/activar' && init?.method === 'POST') return ok({ user: userRecord })
      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })

    render(<App />)
    expect(await screen.findByRole('heading', { name: /Activar cuenta SGMV/i })).toBeInTheDocument()
    expect(screen.queryByText(/Registrarse/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/C.digo temporal/i), {
      target: { value: activationToken },
    })
    fireEvent.change(screen.getByLabelText(/^Nueva contrase.a$/i), {
      target: { value: 'Clave-Activada-Segura-2026!' },
    })
    fireEvent.change(screen.getByLabelText(/Confirmar contrase.a/i), {
      target: { value: 'Clave-Activada-Segura-2026!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Establecer contrase.a y activar/i }))
    expect(await screen.findByRole('heading', { name: /Cuenta activada/i })).toBeInTheDocument()
  })

  it('oculta Usuarios y bloquea la ruta directa para todos los roles no autorizados', async () => {
    for (const role of ['DESPACHADOR', 'MECANICO', 'CONDUCTOR'] as const) {
      window.history.pushState({}, '', '/usuarios')
      mockApi(async (path) => {
        if (path === '/auth/me') return ok({ user: userForRole(role) })
        return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
      })
      const view = render(<App />)
      expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /Administracion de usuarios/i }),
      ).not.toBeInTheDocument()
      view.unmount()
      vi.restoreAllMocks()
    }
  })

  it('permite a cualquier rol cambiar su propia contrasena sin controles de rol', async () => {
    window.history.pushState({}, '', '/mi-cuenta')
    const fetchMock = mockApi(async (path, init) => {
      if (path === '/auth/me') return ok({ user: userForRole('CONDUCTOR') })
      if (path === '/auth/cambiar-contrasena' && init?.method === 'POST') return ok({ ok: true })
      return apiError(404, 'NOT_FOUND', 'Ruta no encontrada')
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText(/Contrase.a actual/i), {
      target: { value: 'Clave-Anterior-Segura-2026!' },
    })
    fireEvent.change(screen.getByLabelText(/^Nueva contrase.a$/i), {
      target: { value: 'Clave-Nueva-Segura-2026!' },
    })
    fireEvent.change(screen.getByLabelText(/Confirmar nueva contrase.a/i), {
      target: { value: 'Clave-Nueva-Segura-2026!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Actualizar contrase.a/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/actualizada/i)
    expect(
      fetchMock.mock.calls.some(([input]) => getPath(input) === '/auth/cambiar-contrasena'),
    ).toBe(true)
  })
})
