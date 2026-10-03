import { apiRequest } from '../../lib/api'
import type {
  JourneyDto,
  JourneyAttentionResponse,
  JourneyListResponse,
  JourneyOptionsResponse,
  JourneyStatus,
  MyJourneyResponse,
} from './journey.types'

export interface JourneyScheduleInput {
  simulacion?: { ciclosCompletosSimulados: number; kmNoComercialesSimulados: number }
  busId: number
  conductorId: number
  finProgramado: string
  inicioProgramado: string
  rutaId?: number
}

export interface JourneyPeriodInput {
  busId: number
  conductorId: number
  rutaId?: number
  fechaInicio: string
  fechaFin: string
  diasSemana: number[]
  horaInicio: string
  horaFin: string
  claveIdempotencia: string
}

export interface JourneyPeriodPreview {
  total: number
  aptas: number
  puedeConfirmar: boolean
  jornadas: Array<{
    fecha: string
    inicioProgramado: string
    finProgramado: string
    conflictos: Array<{ codigo: string; mensaje: string }>
  }>
}

export function previewJourneyPeriod(input: JourneyPeriodInput) {
  return apiRequest<JourneyPeriodPreview>('/jornadas/periodo/previsualizar', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function confirmJourneyPeriod(input: JourneyPeriodInput) {
  return apiRequest<{ creadas: number; jornadas: Array<{ id: number; fecha: string }> }>(
    '/jornadas/periodo/confirmar',
    { body: JSON.stringify(input), method: 'POST' },
  )
}

export interface JourneyReassignInput {
  simulacion?: JourneyScheduleInput['simulacion']
  busId?: number
  conductorId?: number
  fechaEvento: string
  finProgramado?: string
  inicioProgramado?: string
  kilometrajeFinal?: number
  observadoPorId?: number
  motivoRespaldo?: string
  motivo: string
  rutaId?: number | null
}

export function listJourneys(input: {
  cierreAtrasado?: boolean
  requiereReasignacion?: boolean
  buscar?: string
  estado?: JourneyStatus | ''
  pagina?: number
}) {
  const query = new URLSearchParams({ limite: '12', pagina: String(input.pagina ?? 1) })
  if (input.buscar?.trim()) query.set('buscar', input.buscar.trim())
  if (input.estado) query.set('estado', input.estado)
  if (input.cierreAtrasado) query.set('cierreAtrasado', 'true')
  if (input.requiereReasignacion) query.set('requiereReasignacion', 'true')
  return apiRequest<JourneyListResponse>(`/jornadas?${query.toString()}`)
}

export function listJourneyAttention() {
  return apiRequest<JourneyAttentionResponse>('/jornadas/atencion')
}

export function reportJourneyClosureProblem(journeyId: number, motivo: string) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/informar-cierre-pendiente`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  })
}

export function getMyJourney() {
  return apiRequest<MyJourneyResponse>('/jornadas/mi-jornada')
}

export function getJourney(journeyId: number) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}`)
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

export function startJourney(
  journeyId: number,
  fechaEvento: string,
  kilometraje: number,
  idempotencyKey?: string,
  provenance?: { observadoPorId: number; motivoRespaldo?: string },
) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/iniciar`, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify({ fechaEvento, kilometraje, ...provenance }),
    method: 'POST',
  })
}

export function finishJourney(
  journeyId: number,
  fechaEvento: string,
  kilometraje: number,
  idempotencyKey?: string,
  provenance?: { observadoPorId: number; motivoRespaldo?: string },
) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/finalizar`, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify({ fechaEvento, kilometraje, ...provenance }),
    method: 'POST',
  })
}

export function cancelJourney(
  journeyId: number,
  input: {
    fechaEvento: string
    kilometrajeFinal?: number
    motivo: string
    observadoPorId?: number
    motivoRespaldo?: string
  },
) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/cancelar`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function reassignJourney(journeyId: number, input: JourneyReassignInput) {
  return apiRequest<{ jornadaAnterior: JourneyDto; jornadaSucesora: JourneyDto }>(
    `/jornadas/${journeyId}/reasignar`,
    { body: JSON.stringify(input), method: 'POST' },
  )
}

export function interruptJourney(
  journeyId: number,
  input: {
    fechaEvento: string
    motivo: string
    kilometrajeFinal?: number
    motivoSinLectura?: string
    observadoPorId?: number
    motivoRespaldo?: string
  },
) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/interrumpir`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function reconcileJourneyReading(
  journeyId: number,
  input: {
    kilometraje: number
    observadoPorId: number
    motivoRespaldo?: string
    declaracionObservacion: string
    confirmadaEnInterrupcion: true
  },
) {
  return apiRequest<{ jornada: JourneyDto }>(`/jornadas/${journeyId}/conciliar-lectura-final`, {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function markJourneyReadingUnrecoverable(journeyId: number, motivo: string) {
  return apiRequest<{ jornada: JourneyDto }>(
    `/jornadas/${journeyId}/declarar-lectura-no-recuperable`,
    {
      body: JSON.stringify({ motivo }),
      method: 'POST',
    },
  )
}
