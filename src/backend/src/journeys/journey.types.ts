import type { RouteReferenceDto } from '../amb/route-contract.js'
import type { JourneyProjectionDto } from './journey-projection.js'
import type { EstadoBus, EstadoJornada, RolCodigo, TipoLectura } from '@prisma/client'

import type { AvailabilityCauseDto } from '../availability/availability.types.js'

export type { AvailabilityCauseDto, AvailabilityDto } from '../availability/availability.types.js'

export interface JourneyUserRefDto {
  id: number
  nombre: string
  rol: RolCodigo
}

export interface JourneyBusRefDto {
  codigoInterno: string
  estadoOperativo: EstadoBus
  id: number
  placa: string
}

export type JourneyRouteRefDto = RouteReferenceDto

export interface JourneyReadingDto {
  fechaLectura: string
  fechaRegistro: string
  id: number
  kilometraje: number
  kilometrajeAnterior: number
  registradoPor: JourneyUserRefDto
  observadoPor: JourneyUserRefDto | null
  motivoRespaldo: string | null
  tipo: TipoLectura
}

export interface JourneyActionsDto {
  puedeCancelar: boolean
  puedeFinalizar: boolean
  puedeIniciar: boolean
  puedeReasignar: boolean
  puedeInterrumpir: boolean
  puedeConciliarLectura: boolean
  puedeMarcarNoRecuperable: boolean
}

export interface JourneyDto {
  interrupcion: {
    interrumpidaPor: JourneyUserRefDto | null
    estadoConciliacion: 'PENDIENTE' | 'LECTURA_FINAL_REGISTRADA' | 'NO_RECUPERABLE'
    motivoAusenciaLectura: string | null
    motivoNoRecuperable: string | null
    conciliadaAt: string | null
    conciliadaPor: JourneyUserRefDto | null
    detalleConciliacion: string | null
  } | null
  lecturaReferencia: { kilometraje: number; fechaLectura: string } | null
  cierrePendiente: { reportadoAt: string; motivo: string; reportadoPor: JourneyUserRefDto } | null
  proyeccionDemo: JourneyProjectionDto
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
  id: number
  iniciadaPor: JourneyUserRefDto | null
  inicioProgramado: string
  inicioReal: string | null
  jornadaAnteriorId: number | null
  jornadaSucesoraId: number | null
  lecturaFinal: JourneyReadingDto | null
  lecturaInicial: JourneyReadingDto | null
  motivoCambio: string | null
  motivoSucesion: string | null
  programadaPor: JourneyUserRefDto
  ruta: JourneyRouteRefDto | null
  updatedAt: string
}
