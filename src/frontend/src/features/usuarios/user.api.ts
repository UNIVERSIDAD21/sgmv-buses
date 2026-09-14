import type { RoleCode } from '../../domain/labels'
import { apiRequest } from '../../lib/api'
import type { ActivationDelivery, UserListResponse, UserRecord, UserState } from './user.types'

interface UserFilters {
  busqueda?: string
  estado?: UserState | ''
  pagina?: number
  rol?: RoleCode | ''
}

export function listUsers(filters: UserFilters) {
  const query = new URLSearchParams()
  if (filters.busqueda) query.set('busqueda', filters.busqueda)
  if (filters.estado) query.set('estado', filters.estado)
  if (filters.rol) query.set('rol', filters.rol)
  query.set('pagina', String(filters.pagina ?? 1))
  return apiRequest<UserListResponse>(`/usuarios?${query.toString()}`)
}

export function createUser(input: {
  email: string
  nombre: string
  rol: RoleCode
  telefono?: string
}) {
  return apiRequest<ActivationDelivery>('/usuarios', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function updateUser(
  usuarioId: number,
  input: { email?: string; nombre?: string; telefono?: string | null },
) {
  return apiRequest<UserRecord>(`/usuarios/${usuarioId}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export function changeUserRole(usuarioId: number, rol: RoleCode) {
  return apiRequest<UserRecord>(`/usuarios/${usuarioId}/rol`, {
    body: JSON.stringify({ rol }),
    method: 'PATCH',
  })
}

export function changeUserState(
  usuarioId: number,
  estado: Exclude<UserState, 'PENDIENTE_ACTIVACION'>,
) {
  return apiRequest<UserRecord>(`/usuarios/${usuarioId}/estado`, {
    body: JSON.stringify({ estado }),
    method: 'PATCH',
  })
}

export function reissueActivation(usuarioId: number) {
  return apiRequest<ActivationDelivery>(`/usuarios/${usuarioId}/activacion`, { method: 'POST' })
}

export function activateAccount(input: { contrasena: string; token: string }) {
  return apiRequest<{ user: UserRecord }>('/auth/activar', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function changeOwnPassword(input: { contrasenaActual: string; contrasenaNueva: string }) {
  return apiRequest<{ ok: boolean }>('/auth/cambiar-contrasena', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}
