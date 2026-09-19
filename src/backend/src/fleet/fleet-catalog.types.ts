import type { RouteReferenceDto } from '../amb/route-contract.js'
export interface ModeloBusSummaryDto {
  activo: boolean
  busesAsociados: number
  compatibilidadesAsociadas: number
  id: number
  marca: string
  nombreModelo: string
  rutinasAsociadas: number
  updatedAt: string
  versionTecnica: string | null
}

export interface ModeloBusDetailDto extends ModeloBusSummaryDto {
  createdAt: string
  especificaciones?: Record<string, unknown>
}

export interface RutaDto extends RouteReferenceDto {
  activa: boolean
  codigo: string
  createdAt: string
  destino: string
  id: number
  jornadasAsociadas: number
  nombre: string
  origen: string
  updatedAt: string
}
