import { describe, expect, it } from 'vitest'
import { buildAmbOperationalMonth } from '../src/amb/operational-month.js'
import { buildMonthlyHorizon } from '../src/amb/monthly-horizon.js'
import { buildAmbOperationalHorizon } from '../src/amb/operational-horizon.js'

describe('Escenario AMB autorizado por meses', () => {
  it('cubre once referencias documentadas y 2046 jornadas futuras sin duplicar recursos', () => {
    const plan = buildAmbOperationalHorizon('2026-10-15', '2027-01-31')
    expect(plan.empresas).toHaveLength(11)
    expect(plan.meses.map((month) => month.mes)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ])
    expect(plan.totalJornadas).toBe(2046)
    expect(
      new Set(plan.empresas.flatMap((company) => [company.busPrincipal, company.busReserva])).size,
    ).toBe(22)
    for (const company of plan.empresas) {
      expect(company.ruta.procedencia.sha256).toMatch(/^[a-f0-9]{64}$/)
      const trips = company.turnos
        .flatMap((shift) => shift.meses.flatMap((month) => month.jornadas))
        .sort((a, b) => a.inicioProgramado.getTime() - b.inicioProgramado.getTime())
      for (const [index, trip] of trips.entries()) {
        expect(trip.fecha <= '2027-01-31').toBe(true)
        if (index) expect(trips[index - 1]!.finProgramado <= trip.inicioProgramado).toBe(true)
      }
    }
  })
})

describe('Horizonte mensual de planificación sin registros inventados', () => {
  it('separa el resto de octubre y los meses completos hasta enero de 2027', () => {
    expect(buildMonthlyHorizon('2026-10-15', '2027-01-31')).toEqual([
      { mes: '2026-10', fechaInicio: '2026-10-15', fechaFin: '2026-10-31', dias: 17 },
      { mes: '2026-11', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', dias: 30 },
      { mes: '2026-12', fechaInicio: '2026-12-01', fechaFin: '2026-12-31', dias: 31 },
      { mes: '2027-01', fechaInicio: '2027-01-01', fechaFin: '2027-01-31', dias: 31 },
    ])
  })

  it('conserva febrero bisiesto y rechaza fechas imposibles o intervalos invertidos', () => {
    expect(buildMonthlyHorizon('2028-02-01', '2028-03-02').map((month) => month.dias)).toEqual([
      29, 2,
    ])
    expect(() => buildMonthlyHorizon('2027-02-29', '2027-03-01')).toThrow()
    expect(() => buildMonthlyHorizon('2027-01-02', '2027-01-01')).toThrow()
    expect(() => buildMonthlyHorizon('2026-10-15', '2028-01-31')).toThrow()
  })
})

describe('AMB monthly operating calendar', () => {
  it('spans the month boundary without Sundays, overlaps or false completed trips', () => {
    const plan = buildAmbOperationalMonth('2026-10-15', 30)
    expect(plan.fechaFin).toBe('2026-11-13')
    expect(plan.empresas).toHaveLength(7)
    expect(plan.origenOperacion).toBe('SIMULADO_SGMV')
    expect(plan.jornadasFuturasNoEjecutadas).toBe(true)
    for (const company of plan.empresas) {
      const trips = company.turnos
        .flatMap((shift) => shift.jornadas)
        .sort((a, b) => a.inicioProgramado.getTime() - b.inicioProgramado.getTime())
      expect(trips).toHaveLength(52)
      for (const [i, trip] of trips.entries()) {
        expect(trip.fecha >= plan.fechaInicio && trip.fecha <= plan.fechaFin).toBe(true)
        expect(trip.inicioProgramado.getUTCDay()).not.toBe(0)
        if (i) expect(trips[i - 1]!.finProgramado <= trip.inicioProgramado).toBe(true)
      }
    }
  })

  it('rejects impossible dates and a horizon beyond the supported monthly period', () => {
    expect(() => buildAmbOperationalMonth('2026-02-30', 30)).toThrow()
    expect(() => buildAmbOperationalMonth('2026-10-15', 32)).toThrow()
    expect(() => buildAmbOperationalMonth('2026-10-15', 0)).toThrow()
  })
})
