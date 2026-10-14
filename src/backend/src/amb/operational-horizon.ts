import { documentedAmbRoutes2026 } from './documented-routes-2026.js'
import { buildMonthlyHorizon } from './monthly-horizon.js'
import { buildJourneyPeriodSlots } from '../journeys/journey-period.js'

const companies = [
  ['UNITRANSA', '1'],
  ['TRANSCOLOMBIA', '14'],
  ['COTRANDER', '7'],
  ['TRANSGIRON', '30'],
  ['ORIENTAL', '39'],
  ['COOTRAGAS', '40'],
  ['LUSITANIA', '41'],
  ['METROPOLITANA', '37'],
  ['SANJUAN', '44'],
  ['PIEDECUESTA', '49'],
  ['VILLASANCARLOS', '50'],
] as const

export function buildAmbOperationalHorizon(fechaInicio: string, fechaFin: string) {
  const meses = buildMonthlyHorizon(fechaInicio, fechaFin)
  const empresas = companies.map(([slug, code]) => {
    const ruta = documentedAmbRoutes2026.find((row) => row.codigo === `AMB-2026-${code}`)!
    return {
      slug,
      empresa: ruta.operador,
      ruta,
      busPrincipal: `SIM-${slug}-01`,
      busReserva: `SIM-${slug}-02`,
      turnos: [
        { codigo: 'AM', horaInicio: '05:30', horaFin: '11:30' },
        { codigo: 'PM', horaInicio: '12:00', horaFin: '17:00' },
      ].map((turno) => ({
        ...turno,
        meses: meses.map((mes) => ({
          ...mes,
          jornadas: buildJourneyPeriodSlots({
            ...mes,
            diasSemana: [1, 2, 3, 4, 5, 6],
            horaInicio: turno.horaInicio,
            horaFin: turno.horaFin,
          }),
        })),
      })),
    }
  })
  return {
    fechaInicio,
    fechaFin,
    meses,
    empresas,
    origenOperacion: 'SIMULADO_SGMV' as const,
    muestraRepresentativa: true,
    jornadasFuturasNoEjecutadas: true,
    totalJornadas: empresas.reduce(
      (total, company) =>
        total +
        company.turnos.reduce(
          (sum, shift) =>
            sum + shift.meses.reduce((count, month) => count + month.jornadas.length, 0),
          0,
        ),
      0,
    ),
  }
}
