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
  id: number
  kilometraje: number
  kilometrajeAnterior: number
  registradoPor: JourneyUserRefDto
  tipo: TipoLectura
}

export interface JourneyActionsDto {
  puedeCancelar: boolean
  puedeFinalizar: boolean
  puedeIniciar: boolean
  puedeReasignar: boolean
}

export interface JourneyDto {
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
  programadaPor: JourneyUserRefDto
  ruta: JourneyRouteRefDto | null
  updatedAt: string
}
