import { describe, expect, it } from 'vitest'

import { classifyJourneyAttention } from '../src/journeys/journey-attention.js'
import type { JourneyDto } from '../src/journeys/journey.types.js'

const now = new Date('2026-10-03T12:00:00.000Z')

function journey(overrides: Partial<JourneyDto> = {}): JourneyDto {
  return {
    estado: 'PROGRAMADA',
    inicioProgramado: '2026-10-03T13:00:00.000Z',
    finProgramado: '2026-10-03T21:00:00.000Z',
    inicioReal: null,
    finReal: null,
    jornadaSucesoraId: null,
    causasDisponibilidad: [],
    acciones: { puedeReasignar: true },
    ...overrides,
  } as JourneyDto
}

describe('clasificación exclusiva de pendientes de Despacho', () => {
  it('excluye estados terminales y la programada futura normal', () => {
    for (const estado of ['FINALIZADA', 'CANCELADA', 'REASIGNADA'] as const) {
      expect(classifyJourneyAttention(journey({ estado }), false, now)).toBeNull()
    }
    expect(classifyJourneyAttention(journey(), true, now)).toBeNull()
  })

  it('prioriza salida sin confirmar sobre la falta de conductor o bus', () => {
    expect(
      classifyJourneyAttention(
        journey({
          inicioProgramado: '2026-10-01T13:00:00.000Z',
          causasDisponibilidad: [{ codigo: 'ORDEN_TECNICA_ACTIVA' }],
        } as Partial<JourneyDto>),
        false,
        now,
      ),
    ).toBe('SALIDA_SIN_CONFIRMAR')
  })

  it('separa cierre iniciado de relevo y no considera cierre a una programada', () => {
    expect(
      classifyJourneyAttention(
        journey({
          estado: 'EN_CURSO',
          inicioReal: '2026-10-01T13:00:00.000Z',
          finProgramado: '2026-10-02T21:00:00.000Z',
        }),
        false,
        now,
      ),
    ).toBe('CIERRE_PENDIENTE')
    expect(
      classifyJourneyAttention(
        journey({
          estado: 'EN_CURSO',
          inicioReal: '2026-10-03T11:00:00.000Z',
        }),
        false,
        now,
      ),
    ).toBe('RELEVO')
  })

  it('clasifica recurso inválido futuro e interrupción con continuidad vigente', () => {
    expect(classifyJourneyAttention(journey(), false, now)).toBe('REASIGNACION')
    expect(
      classifyJourneyAttention(
        journey({ causasDisponibilidad: [{ codigo: 'CONFLICTO_JORNADA' }] } as Partial<JourneyDto>),
        true,
        now,
      ),
    ).toBeNull()
    expect(
      classifyJourneyAttention(
        journey({
          estado: 'INTERRUMPIDA',
          inicioReal: '2026-10-03T10:00:00.000Z',
        }),
        true,
        now,
      ),
    ).toBe('RELEVO')
    expect(
      classifyJourneyAttention(
        journey({
          estado: 'INTERRUMPIDA',
          jornadaSucesoraId: 45,
        }),
        true,
        now,
      ),
    ).toBeNull()
  })
})
