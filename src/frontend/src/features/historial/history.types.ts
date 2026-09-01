import type { RoleCode } from '../../domain/labels'

export type HistoryOrderState =
  | 'ASIGNADA'
  | 'CERRADA'
  | 'COMPLETADA_TECNICO'
  | 'DEVUELTA_CORRECCION'
  | 'EN_EJECUCION'
  | 'PENDIENTE_ASIGNACION'
export type HistoryOrderType = 'CORRECTIVA' | 'PREVENTIVA'
export type HistoryOrderOrigin = 'CORRECTIVO_DIRECTO' | 'NOVEDAD' | 'PREVENTIVO'

export interface PaginationDto {
  limite: number
  pagina: number
  total: number
  totalPaginas: number
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
  rol: RoleCode
}

export interface HistoryBusDto {
  anio: number
  codigoInterno: string
  costoAcumulado?: string
  estadoOperativo: 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO' | 'INACTIVO' | 'OPERATIVO'
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
  estado: HistoryOrderState
  fechaCierre: string | null
  fechaCreacion: string
  id: string
  origen: HistoryOrderOrigin
  repuestos?: Array<{
    cantidad: string
    codigo: string
    costoUnitario?: string
    nombre: string
    subtotal?: string
    unidadMedida: string
  }>
  tecnico: string | null
  tipo: HistoryOrderType
}

export interface HistoryDetailDto {
  asignaciones: Array<{
    activa: boolean
    asignadoPor: string
    conductor: string
    fechaFin: string | null
    fechaInicio: string
    id: string
    motivo: string | null
  }>
  bus: Omit<HistoryBusDto, 'costoAcumulado' | 'totalOrdenes' | 'ultimoMantenimiento'>
  estados: Array<{
    cambiadoPor: string
    estadoAnterior: HistoryBusDto['estadoOperativo'] | null
    estadoNuevo: HistoryBusDto['estadoOperativo']
    fechaCambio: string
    id: string
    motivo: string | null
  }>
  kilometrajes: Array<{
    fechaRegistro: string
    id: string
    kilometrajeAnterior: number
    kilometrajeNuevo: number
    motivo: string | null
    registradoPor: string
  }>
  mantenimientos: Array<{
    activa: boolean
    actividad: string
    criterio: 'FECHA' | 'FECHA_KILOMETRAJE' | 'KILOMETRAJE'
    fechaProgramada: string | null
    id: string
    kilometrajeObjetivo: number | null
    tipo: string
  }>
  novedades: Array<{
    clasificacion: string | null
    descripcion: string
    estado: string
    fechaReporte: string
    id: string
    reportadaPor?: string
    tipo: string
  }>
  ordenes: HistoryOrderDto[]
}

export interface MaintenanceReportDto {
  costoTotal: string
  paginacion: PaginationDto
  registros: Array<{
    bus: string
    codigo: string
    costoTotal: string
    estado: HistoryOrderState
    fechaCierre: string | null
    fechaCreacion: string
    id: string
    intervenciones: number
    origen: HistoryOrderOrigin
    repuestosConsumidos: number
    tecnico: string | null
    tipo: HistoryOrderType
  }>
}

export interface PartsReportDto {
  costoTotal: string
  paginacion: PaginationDto
  registros: Array<{
    cantidad: string
    categoria: string | null
    codigo: string
    costoTotal: string
    id: string
    nombre: string
    ordenes: number
    unidadMedida: string
  }>
}

export interface CostReportDto {
  costoTotal: string
  paginacion: PaginationDto
  registros: Array<{
    bus: string
    busId: string
    cerradas: number
    costoPromedio: string
    costoTotal: string
    ordenes: number
  }>
}
