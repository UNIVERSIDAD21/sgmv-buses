import { describe, expect, it } from 'vitest'

import { createJourneySchema, listJourneysQuerySchema } from '../src/journeys/journey.schemas.js'

describe('RF-01 intervalos con offsets ISO 8601', () => {
  const scope = {
    busId: 'c589a7dd-1a16-420a-8bea-f78bc303d691',
    conductorId: 'c589a7dd-1a16-420a-8bea-f78bc303d692',
  }

  it.each([
    ['2026-09-11T10:00:00Z', '2026-09-11T06:00:00-05:00', true],
    ['2026-09-11T06:00:00-05:00', '2026-09-11T10:00:00Z', false],
    ['2026-09-11T05:00:00-05:00', '2026-09-11T10:00:00Z', false],
  ])('valida el orden cronológico de %s a %s', (inicioProgramado, finProgramado, valid) => {
    expect(
      createJourneySchema.safeParse({ ...scope, inicioProgramado, finProgramado }).success,
    ).toBe(valid)
  })

  it.each([
    ['2026-09-11T10:00:00Z', '2026-09-11T06:00:00-05:00', true],
    ['2026-09-11T06:00:00-05:00', '2026-09-11T10:00:00Z', false],
    ['2026-09-11T10:00:00Z', '2026-09-11T05:00:00-05:00', true],
  ])('consulta intervalos por instante, no representación: %s a %s', (desde, hasta, valid) => {
    expect(listJourneysQuerySchema.safeParse({ desde, hasta }).success).toBe(valid)
  })
})
