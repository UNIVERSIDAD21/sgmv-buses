export interface ModeloBusSummaryDto {
  activo: boolean
  busesAsociados: number
  id: string
  marca: string
  nombreModelo: string
  updatedAt: string
  versionTecnica: string | null
}

export interface ModeloBusDetailDto extends ModeloBusSummaryDto {
  createdAt: string
  especificaciones?: Record<string, unknown>
}

export interface RutaDto {
  activa: boolean
  codigo: string
  createdAt: string
  destino: string
  id: string
  jornadasAsociadas: number
  nombre: string
  origen: string
  updatedAt: string
}
