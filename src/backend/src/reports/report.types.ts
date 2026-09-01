import type {
  EstadoBus,
  EstadoNovedad,
  EstadoOrdenTrabajo,
  OrigenOrdenTrabajo,
  RolCodigo,
  TipoOrdenTrabajo,
} from '@prisma/client'

export interface ReportPaginationDto {
  limite: number
  pagina: number
  total: number
  totalPaginas: number
}

export interface HistoryBusDto {
  anio: number
  codigoInterno: string
  costoAcumulado?: string
  estadoOperativo: EstadoBus
  id: string
  kilometrajeActual: number
  marca: string
  modelo: string
  placa: string
  totalOrdenes: number
  ultimoMantenimiento: string | null
}

export interface HistoryOrderDto {
  codigo: string
  costoTotal?: string
  descripcion: string
  diagnosticos?: Array<{
    actividades: string[]
    diagnostico: string | null
    fechaFin: string | null
    fechaInicio: string
    observaciones: string | null
    tecnico: string
  }>
  estado: EstadoOrdenTrabajo
  fechaCierre: string | null
  fechaCreacion: string
  id: string
  origen: OrigenOrdenTrabajo
  repuestos?: Array<{
    cantidad: string
    codigo: string
    costoUnitario?: string
    nombre: string
    subtotal?: string
    unidadMedida: string
  }>
  tecnico: string | null
  tipo: TipoOrdenTrabajo
}

export interface HistoryNoveltyDto {
  clasificacion: string | null
  descripcion: string
  estado: EstadoNovedad
  fechaReporte: string
  id: string
  reportadaPor?: string
  tipo: string
}

export interface HistorySummaryDto {
  alcance: string
  costoTotal?: string
  indicadores: {
    buses: number
    mantenimientosProgramados: number
    novedades: number
    ordenes: number
    ordenesCerradas: number
  }
  rol: RolCodigo
}
