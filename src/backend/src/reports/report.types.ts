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
    actividadesDetalladas: Array<{
      descripcion: string
      fechaRegistro: string
      id: string
    }>
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
  historialEstados?: Array<{
    cambiadoPor: string
    estadoAnterior: EstadoOrdenTrabajo | null
    estadoNuevo: EstadoOrdenTrabajo
    fechaCambio: string
    id: string
    observacion: string | null
  }>
  novedadOrigen?: {
    fechaOcurrencia: string | null
    fechaReporte: string
    id: string
    jornadaId: string | null
    lecturaId: string | null
  } | null
  origen: OrigenOrdenTrabajo
  repuestos?: Array<{
    cantidad: string
    codigo: string
    costoUnitario?: string
    nombre: string
    subtotal?: string
    unidadMedida: string
    fechaConsumo?: string
    compatibilidad?: {
      evidencia: Record<string, unknown> | null
      reglaId: string | null
      reglaVersion: number | null
      resultado: 'COMPATIBLE' | 'EXCEPCION_AUTORIZADA' | 'NO_EVALUADA_LEGADO' | null
    }
    movimiento?: {
      cantidad: string
      fechaMovimiento: string
      id: string
      tipo: string
    } | null
  }>
  jornada?: {
    estado: string
    id: string
    ruta: { codigo: string; nombre: string } | null
  } | null
  lecturasTecnicas?: Array<{
    fechaLectura: string
    id: string
    kilometraje: number
    tipo: string | null
  }>
  disponibilidadAlCierre?: boolean | null
  reasignaciones?: Array<{
    fechaReasignacion: string
    id: string
    motivo: string | null
    reasignadoPor: string
    tecnicoAnterior: string | null
    tecnicoNuevo: string
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

export interface HistoryJourneyDto {
  conductor: string
  estado: string
  finReal: string | null
  finProgramado: string
  id: string
  inicioReal: string | null
  inicioProgramado: string
  lecturas: Array<{
    fechaLectura: string
    id: string
    kilometraje: number
    tipo: string | null
  }>
  ruta: { codigo: string; nombre: string } | null
}

export interface HistoryAlertDto {
  estado?: string
  fechaGeneracion: string
  id: string
  origen: {
    busId: string | null
    jornadaId: string | null
    novedadId: string | null
    ordenId: string | null
    programacionId: string | null
  }
  prioridad: string
  tipo: string
  titulo: string
}
