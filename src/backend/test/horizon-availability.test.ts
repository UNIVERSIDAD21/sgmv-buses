import { describe, expect, it } from 'vitest'
import { assertHorizonAvailability } from '../src/amb/horizon-availability.js'
import type { AvailabilityRecords } from '../src/availability/availability.types.js'

const now = new Date('2026-10-14T12:00:00Z')
const start = new Date('2026-10-15T10:30:00Z')
const end = new Date('2026-10-15T16:30:00Z')
const slot = { conductorId: 2, inicioProgramado: start, finProgramado: end }
const available: AvailabilityRecords = {
  bus: { id: 1, estadoOperativo: 'OPERATIVO', kilometrajeActual: 40000 },
  conflictingJourney: null,
  novelty: null,
  order: null,
  preventive: [],
}
const reservation = { ...slot, busId: 1, estado: 'PROGRAMADA', inicioReal: null, finReal: null }

describe('Validación por lotes del horizonte de simulación', () => {
  it('admite tramos futuros libres y permite reservas adyacentes sin solapamiento', () => {
    expect(() => assertHorizonAvailability(available, [slot], [], now)).not.toThrow()
    expect(() =>
      assertHorizonAvailability(
        available,
        [slot],
        [
          {
            ...reservation,
            inicioProgramado: end,
            finProgramado: new Date('2026-10-15T20:00:00Z'),
          },
        ],
        now,
      ),
    ).not.toThrow()
  })
  it('rechaza un vehículo bloqueado por mantenimiento aunque el intervalo sea futuro', () => {
    expect(() =>
      assertHorizonAvailability({ ...available, order: { id: 3 } }, [slot], [], now),
    ).toThrow(/disponibilidad técnica/)
  })
  it('evalúa preventivos bloqueantes a la fecha de cada salida, no solo al cargar', () => {
    const records: AvailabilityRecords = {
      ...available,
      preventive: [
        {
          id: 3,
          fechaProgramada: new Date('2026-10-14T00:00:00Z'),
          kilometrajeObjetivo: null,
          plan: {
            anticipacionDias: 2,
            anticipacionKm: null,
            bloqueaAlVencer: true,
            claveTarea: 'INSPECCION',
          },
        },
      ],
    }
    expect(() => assertHorizonAvailability(records, [slot], [], now)).toThrow(
      /disponibilidad técnica/,
    )
  })
  it('rechaza solapamiento del bus o del conductor con otro vehículo', () => {
    expect(() =>
      assertHorizonAvailability(available, [slot], [{ ...reservation, conductorId: 99 }], now),
    ).toThrow(/jornada incompatible/)
    expect(() =>
      assertHorizonAvailability(available, [slot], [{ ...reservation, busId: 99 }], now),
    ).toThrow(/jornada incompatible/)
  })
  it('conserva el bloqueo de una jornada real abierta aun fuera de su horario previsto', () => {
    const old = {
      ...reservation,
      estado: 'EN_CURSO',
      inicioProgramado: new Date('2026-10-13T10:00:00Z'),
      finProgramado: new Date('2026-10-13T12:00:00Z'),
      inicioReal: new Date('2026-10-13T10:00:00Z'),
    }
    expect(() => assertHorizonAvailability(available, [slot], [old], now)).toThrow(
      /jornada incompatible/,
    )
  })
  it('no fabrica fechas pasadas ni interpreta una cancelación como reserva vigente', () => {
    expect(() => assertHorizonAvailability(available, [slot], [], end)).toThrow(/futuros/)
    expect(() =>
      assertHorizonAvailability(available, [slot], [{ ...reservation, estado: 'CANCELADA' }], now),
    ).not.toThrow()
  })
})
