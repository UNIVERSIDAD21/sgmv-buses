import { apiRequest } from '../../lib/api'
import type {
  JourneyDto,
  JourneyListResponse,
  JourneyOptionsResponse,
  JourneyStatus,
  MyJourneyResponse,
} from './journey.types'

export interface JourneyScheduleInput {
  busId: string
  conductorId: string
  finProgramado: string
  inicioProgramado: string
  rutaId?: string
}

export interface JourneyReassignInput {
  busId?: string
  conductorId?: string
  fechaEvento: string
  finProgramado?: string
  inicioProgramado?: string
  kilometrajeFinal?: number
  motivo: string
  rutaId?: string | null
}

export function listJourneys(input: {
  buscar?: string
  estado?: JourneyStatus | ''
  pagina?: number
}) {
  const query = new URLSearchParams({ limite: '12', pagina: String(input.pagina ?? 1) })
  if (input.buscar?.trim()) query.set('buscar', input.buscar.trim())
  if (input.estado) query.set('estado', input.estado)
  return apiRequest<JourneyListResponse>(`/jornadas?${query.toString()}`)
}

export function getMyJourney() {
  return apiRequest<MyJourneyResponse>('/jornadas/mi-jornada')
}

export function getJourneyOptions() {
  return apiRequest<JourneyOptionsResponse>('/jornadas/opciones')
}

export function createJourney(input: JourneyScheduleInput) {
  return apiRequest<{ jornada: JourneyDto }>('/jornadas', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function startJourney(journeyId: string, fechaEvento: string, kilometraje: number) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/iniciar`, {
    body: JSON.stringify({ fechaEvento, kilometraje }),
    method: 'POST',
  })
}

export function finishJourney(journeyId: string, fechaEvento: string, kilometraje: number) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/finalizar`, {
    body: JSON.stringify({ fechaEvento, kilometraje }),
    method: 'POST',
  })
}

export function cancelJourney(
  journeyId: string,
  input: { fechaEvento: string; kilometrajeFinal?: number; motivo: string },
) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/cancelar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function reassignJourney(journeyId: string, input: JourneyReassignInput) {
  return apiRequest<{ jornadaAnterior: JourneyDto; jornadaSucesora: JourneyDto }>(
    `/jornadas/${journeyId}/reasignar`,
    { body: JSON.stringify(input), method: 'POST' },
  )
}
