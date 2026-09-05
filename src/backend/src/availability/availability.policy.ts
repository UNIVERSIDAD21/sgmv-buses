import type {
  AvailabilityCauseDto,
  AvailabilityDto,
  AvailabilityRecords,
} from './availability.types.js'

export function buildAvailability(
  records: AvailabilityRecords,
  evaluatedAt = new Date(),
): AvailabilityDto {
  const causas: AvailabilityCauseDto[] = []

  if (records.bus?.estadoOperativo === 'INACTIVO') {
    causas.push({
      bloquea: true,
      codigo: 'BUS_INACTIVO',
      mensaje: 'El bus esta inactivo',
      origenId: records.bus.id,
      origenTipo: 'BUS',
      prioridad: 500,
    })
  } else if (records.bus?.estadoOperativo === 'FUERA_DE_SERVICIO') {
    causas.push({
      bloquea: true,
      codigo: 'BUS_FUERA_DE_SERVICIO',
      mensaje: 'El bus esta fuera de servicio',
      origenId: records.bus.id,
      origenTipo: 'BUS',
      prioridad: 450,
    })
  } else if (records.bus?.estadoOperativo === 'EN_MANTENIMIENTO') {
    causas.push({
      bloquea: true,
      codigo: 'BUS_EN_MANTENIMIENTO',
      mensaje: 'El bus esta en mantenimiento',
      origenId: records.bus.id,
      origenTipo: 'BUS',
      prioridad: 400,
    })
  }

  if (records.order) {
    causas.push({
      bloquea: true,
      codigo: 'ORDEN_TECNICA_ACTIVA',
      mensaje: 'El bus tiene una orden tecnica activa',
      origenId: records.order.id,
      origenTipo: 'ORDEN',
      prioridad: 350,
    })
  }
  if (records.novelty) {
    causas.push({
      bloquea: true,
      codigo: 'NOVEDAD_BLOQUEANTE',
      mensaje: 'El bus tiene una novedad operativa bloqueante',
      origenId: records.novelty.id,
      origenTipo: 'NOVEDAD',
      prioridad: 300,
    })
  }
  if (records.preventive) {
    causas.push({
      bloquea: true,
      codigo: 'PREVENTIVO_VENCIDO_BLOQUEANTE',
      mensaje: 'El bus tiene mantenimiento preventivo vencido que bloquea la operacion',
      origenId: records.preventive.id,
      origenTipo: 'PREVENTIVO',
      prioridad: 250,
    })
  }
  if (records.conflictingJourney) {
    causas.push({
      bloquea: true,
      codigo: 'CONFLICTO_JORNADA',
      mensaje: 'El bus o el conductor tiene otra jornada en el intervalo',
      origenId: records.conflictingJourney.id,
      origenTipo: 'JORNADA',
      prioridad: 200,
    })
  }

  causas.sort((left, right) =>
    right.prioridad === left.prioridad
      ? left.codigo.localeCompare(right.codigo)
      : right.prioridad - left.prioridad,
  )

  return {
    causaPrincipal: causas[0]?.codigo ?? null,
    causas,
    disponible: causas.length === 0,
    evaluadoAt: evaluatedAt.toISOString(),
  }
}
