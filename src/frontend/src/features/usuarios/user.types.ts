import type { RoleCode } from '../../domain/labels'

export type UserState = 'PENDIENTE_ACTIVACION' | 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO'

export interface UserRecord {
  bloqueadoHasta: string | null
  createdAt: string
  email: string
  estado: UserState
  id: number
  nombre: string
  rol: {
    codigo: RoleCode
    id: number
    nombre: string
  }
  telefono: string | null
  ultimoAccesoAt: string | null
  updatedAt: string
}

export interface ActivationDelivery {
  activacion: {
    expiraAt: string
    token: string
  }
  usuario: UserRecord
}

export interface UserListResponse {
  items: UserRecord[]
  limite: number
  pagina: number
  paginas: number
  total: number
}

export interface UserImpact {
  jornadas: Array<{
    id: number
    estado: 'PROGRAMADA' | 'EN_CURSO'
    inicioProgramado: string
    bus: { codigoInterno: string }
  }>
  ordenes: Array<{
    id: number
    codigo: string
    estado: 'ASIGNADA' | 'EN_EJECUCION' | 'DEVUELTA_CORRECCION'
    bus: { codigoInterno: string }
  }>
}
