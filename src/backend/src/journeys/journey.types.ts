import type { EstadoBus, EstadoJornada, RolCodigo, TipoLectura } from '@prisma/client'

export interface JourneyUserRefDto {
  id: string
  nombre: string
  rol: RolCodigo
}

export interface JourneyBusRefDto {
  codigoInterno: string
  estadoOperativo: EstadoBus
  id: string
  placa: string
}

export interface JourneyRouteRefDto {
  codigo: string
  destino: string
  id: string
  nombre: string
  origen: string
}

export interface JourneyReadingDto {
  fechaLectura: string
  id: string
  kilometraje: number
  kilometrajeAnterior: number
  registradoPor: JourneyUserRefDto
  tipo: TipoLectura
}

export interface AvailabilityCauseDto {
  bloquea: true
  codigo:
    | 'BUS_INACTIVO'
    | 'BUS_FUERA_DE_SERVICIO'
    | 'BUS_EN_MANTENIMIENTO'
    | 'ORDEN_TECNICA_ACTIVA'
    | 'NOVEDAD_BLOQUEANTE'
    | 'PREVENTIVO_VENCIDO_BLOQUEANTE'
    | 'CONFLICTO_JORNADA'
  mensaje: string
  origenId: string
  origenTipo: 'BUS' | 'JORNADA' | 'NOVEDAD' | 'ORDEN' | 'PREVENTIVO'
  prioridad: number
}

export interface AvailabilityDto {
  causaPrincipal: AvailabilityCauseDto['codigo'] | null
  causas: AvailabilityCauseDto[]
  disponible: boolean
  evaluadoAt: string
}

export interface JourneyActionsDto {
  puedeCancelar: boolean
  puedeFinalizar: boolean
  puedeIniciar: boolean
  puedeReasignar: boolean
}

export interface JourneyDto {
  acciones: JourneyActionsDto
  bus: JourneyBusRefDto
  cambioPor: JourneyUserRefDto | null
  causasDisponibilidad: AvailabilityCauseDto[]
  conductor: JourneyUserRefDto
  estado: EstadoJornada
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
  ruta: JourneyRouteRefDto | null
  updatedAt: string
}
