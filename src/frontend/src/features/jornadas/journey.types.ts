import type { BusStatus, RutaDto } from '../flota/fleet.types'

export type JourneyStatus = 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' | 'REASIGNADA'

export interface JourneyUserRefDto {
  id: number
  nombre: string
  rol: 'ADMINISTRADOR' | 'DESPACHADOR' | 'MECANICO' | 'CONDUCTOR'
}

export interface JourneyReadingDto {
  fechaLectura: string
  id: number
  kilometraje: number
  kilometrajeAnterior: number
  registradoPor: JourneyUserRefDto
  tipo: 'INICIO_JORNADA' | 'FIN_JORNADA'
}

export interface AvailabilityCauseDto {
  codigo: string
  mensaje: string
  origenId: number
  origenTipo: string
  prioridad: number
}

export interface JourneyDto {
  proyeccionDemo?: {
    origen: 'PROYECCION_SIMULADA'
    origenSemanticaDemo: 'SIMULADO_SGMV'
    semanticaLongitudDemo: 'CIRCUITO_COMPLETO'
    ciclosCompletosSimulados: number
    kmNoComercialesSimulados: number
    longitudKmOficialSnapshot: number
    kmComercialesProyectadosDemo: number
    kmJornadaProyectadosDemo: number
    kmEstimadoCierre: number
    kmReal: number | null
    diferenciaKm: number | null
    conciliada: boolean
  } | null
  acciones: {
    puedeCancelar: boolean
    puedeFinalizar: boolean
    puedeIniciar: boolean
    puedeReasignar: boolean
  }
  bus: {
    codigoInterno: string
    estadoOperativo: BusStatus
    id: number
    placa: string
  }
  cambioPor: JourneyUserRefDto | null
  causasDisponibilidad: AvailabilityCauseDto[]
  conductor: JourneyUserRefDto
  estado: JourneyStatus
  fechaCambio: string | null
  finProgramado: string
  finReal: string | null
  finalizadaPor: JourneyUserRefDto | null
  id: number
  iniciadaPor: JourneyUserRefDto | null
  inicioProgramado: string
  inicioReal: string | null
  jornadaAnteriorId: number | null
  jornadaSucesoraId: number | null
  lecturaFinal: JourneyReadingDto | null
  lecturaInicial: JourneyReadingDto | null
  motivoCambio: string | null
  programadaPor: JourneyUserRefDto
  ruta: JourneyRouteRef | null
  updatedAt: string
}

export interface JourneyListResponse {
  jornadas: JourneyDto[]
  paginacion: {
    limite: number
    pagina: number
    paginas: number
    total: number
  }
}

export interface JourneyOptionsResponse {
  buses: Array<{
    disponibilidadTecnica?: { disponible: boolean; causas: AvailabilityCauseDto[] }
    mantenimientos?: Array<{
      id: number
      fechaObjetivo: string | null
      kilometrajeObjetivo: number | null
      anticipacionKm: number
      estado: string
    }>
    codigoInterno: string
    estadoOperativo: BusStatus
    id: number
    kilometrajeActual: number
    placa: string
  }>
  conductores: Array<{ id: number; nombre: string }>
  rutas: JourneyRouteRef[]
}

export type JourneyRouteRef = Pick<
  RutaDto,
  | 'codigo'
  | 'destino'
  | 'id'
  | 'nombre'
  | 'origen'
  | 'longitudKmOficial'
  | 'origenDato'
  | 'operador'
>

export interface MyJourneyResponse {
  jornadaActual: JourneyDto | null
  proximaJornada: JourneyDto | null
}
