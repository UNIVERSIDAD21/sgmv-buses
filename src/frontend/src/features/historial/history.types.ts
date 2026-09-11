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
  id: number
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
    actividadesDetalladas?: Array<{
      descripcion: string
      fechaRegistro: string
      id: number
    }>
    diagnostico: string | null
    fechaFin: string | null
    fechaInicio: string
    observaciones: string | null
    tecnico: string
  }>
  estado: HistoryOrderState
  fechaCierre: string | null
  fechaCreacion: string
  id: number
  historialEstados?: Array<{
    cambiadoPor: string
    estadoAnterior: HistoryOrderState | null
    estadoNuevo: HistoryOrderState
    fechaCambio: string
    id: number
    observacion: string | null
  }>
  novedadOrigen?: {
    fechaOcurrencia: string | null
    fechaReporte: string
    id: number
    jornadaId: number | null
    lecturaId: number | null
  } | null
  origen: HistoryOrderOrigin
  repuestos?: Array<{
    cantidad: string
    codigo: string
    costoUnitario?: string
    fechaConsumo?: string
    compatibilidad?: {
      evidencia: Record<string, unknown> | null
      reglaId: number | null
      reglaVersion: number | null
      resultado: 'COMPATIBLE' | 'EXCEPCION_AUTORIZADA' | 'NO_EVALUADA_LEGADO' | null
    }
    movimiento?: {
      cantidad: string
      fechaMovimiento: string
      id: number
      tipo: string
    } | null
    nombre: string
    subtotal?: string
    unidadMedida: string
  }>
  jornada?: {
    estado: string
    id: number
    ruta: { codigo: string; nombre: string } | null
  } | null
  lecturasTecnicas?: Array<{
    fechaLectura: string
    id: number
    kilometraje: number
    tipo: string | null
  }>
  disponibilidadAlCierre?: boolean | null
  reasignaciones?: Array<{
    fechaReasignacion: string
    id: number
    motivo: string | null
    reasignadoPor: string
    tecnicoAnterior: string | null
    tecnicoNuevo: string
  }>
  tecnico: string | null
  tipo: HistoryOrderType
}

export interface HistoryDetailDto {
  alertas: Array<{
    estado?: string
    fechaGeneracion: string
    id: number
    origen: {
      busId: number | null
      jornadaId: number | null
      novedadId: number | null
      ordenId: number | null
      programacionId: number | null
    }
    prioridad: string
    tipo: string
    titulo: string
  }>
  asignaciones: Array<{
    activa: boolean
    asignadoPor: string
    conductor: string
    fechaFin: string | null
    fechaInicio: string
    id: number
    motivo: string | null
  }>
  bus: Omit<HistoryBusDto, 'costoAcumulado' | 'totalOrdenes' | 'ultimoMantenimiento'>
  estados: Array<{
    cambiadoPor: string
    estadoAnterior: HistoryBusDto['estadoOperativo'] | null
    estadoNuevo: HistoryBusDto['estadoOperativo']
    fechaCambio: string
    id: number
    motivo: string | null
  }>
  kilometrajes: Array<{
    fechaRegistro: string
    id: number
    kilometrajeAnterior: number
    kilometrajeNuevo: number
    motivo: string | null
    registradoPor: string
  }>
  jornadas: Array<{
    conductor: string
    estado: string
    finReal: string | null
    finProgramado: string
    id: number
    inicioReal: string | null
    inicioProgramado: string
    lecturas: Array<{
      fechaLectura: string
      id: number
      kilometraje: number
      tipo: string | null
    }>
    ruta: { codigo: string; nombre: string } | null
  }>
  mantenimientos: Array<{
    activa: boolean
    actividad: string
    criterio: 'FECHA' | 'FECHA_KILOMETRAJE' | 'KILOMETRAJE'
    fechaProgramada: string | null
    id: number
    kilometrajeObjetivo: number | null
    tipo: string
  }>
  novedades: Array<{
    clasificacion: string | null
    descripcion: string
    estado: string
    fechaReporte: string
    id: number
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
    id: number
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
    id: number
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
    busId: number
    cerradas: number
    costoPromedio: string
    costoTotal: string
    ordenes: number
  }>
}
