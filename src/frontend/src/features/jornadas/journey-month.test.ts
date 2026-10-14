import { describe, expect, it } from 'vitest'
import { getMonthlyPeriod } from './journey-month'

describe('Selección por mes calendario', () => {
  it('limita el mes actual a días futuros y cubre noviembre, diciembre y enero completos', () => {
    const firstFutureDate = '2026-10-15'
    expect(getMonthlyPeriod('2026-10', firstFutureDate)).toEqual({
      fechaInicio: '2026-10-15',
      fechaFin: '2026-10-31',
    })
    for (const [month, lastDay] of [
      ['2026-11', '30'],
      ['2026-12', '31'],
      ['2027-01', '31'],
    ])
      expect(getMonthlyPeriod(month!, firstFutureDate)).toEqual({
        fechaInicio: `${month}-01`,
        fechaFin: `${month}-${lastDay}`,
      })
  })

  it('maneja años bisiestos y no ofrece meses ya terminados', () => {
    expect(getMonthlyPeriod('2028-02', '2028-01-01')?.fechaFin).toBe('2028-02-29')
    expect(getMonthlyPeriod('2026-10', '2026-11-01')).toBeNull()
    expect(getMonthlyPeriod('2027-13', '2026-10-15')).toBeNull()
    expect(getMonthlyPeriod('', '2026-10-15')).toBeNull()
  })
})
