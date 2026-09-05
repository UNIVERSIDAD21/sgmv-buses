import type { BusStatus, RutaDto } from '../flota/fleet.types'

export type JourneyStatus = 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' | 'REASIGNADA'

export interface JourneyUserRefDto {
  id: string
  nombre: string
  rol: 'ADMINISTRADOR' | 'DESPACHADOR' | 'MECANICO' | 'CONDUCTOR'
}

export interface JourneyReadingDto {
  fechaLectura: string
  id: string
  kilometraje: number
  kilometrajeAnterior: number
  registradoPor: JourneyUserRefDto
  tipo: 'INICIO_JORNADA' | 'FIN_JORNADA'
}

export interface AvailabilityCauseDto {
  codigo: string
  mensaje: string
  origenId: string
  origenTipo: string
  prioridad: number
}

export interface JourneyDto {
  acciones: {
    puedeCancelar: boolean
    puedeFinalizar: boolean
    puedeIniciar: boolean
    puedeReasignar: boolean
  }
  bus: {
    codigoInterno: string
    estadoOperativo: BusStatus
    id: string
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
  id: string
  iniciadaPor: JourneyUserRefDto | null
  inicioProgramado: string
  inicioReal: string | null
  jornadaAnteriorId: string | null
  jornadaSucesoraId: string | null
  lecturaFinal: JourneyReadingDto | null
  lecturaInicial: JourneyReadingDto | null
  motivoCambio: string | null
  programadaPor: JourneyUserRefDto
  ruta: Pick<RutaDto, 'codigo' | 'destino' | 'id' | 'nombre' | 'origen'> | null
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
    codigoInterno: string
    estadoOperativo: BusStatus
    id: string
    kilometrajeActual: number
    placa: string
  }>
  conductores: Array<{ id: string; nombre: string }>
  rutas: Array<Pick<RutaDto, 'codigo' | 'destino' | 'id' | 'nombre' | 'origen'>>
}

export interface MyJourneyResponse {
  jornadaActual: JourneyDto | null
  proximaJornada: JourneyDto | null
}
