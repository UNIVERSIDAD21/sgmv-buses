import { officialAmbRoutes } from './routes.js'
import { buildJourneyPeriodSlots } from '../journeys/journey-period.js'

const companies = [
  ['UNITRANSA', '1'],
  ['TRANSCOLOMBIA', '14'],
  ['COTRANDER', '7'],
  ['TRANSGIRON', '30'],
  ['ORIENTAL', '39'],
  ['COOTRAGAS', '40'],
  ['LUSITANIA', '41'],
] as const

/** Los operadores y rutas son referencias públicas; los vehículos y turnos no son registros empresariales. */
export function buildAmbOperationalMonth(fechaInicio: string, dias = 30) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !Number.isInteger(dias) || dias < 1 || dias > 31)
    throw new Error('Indique fecha ISO y un horizonte de 1 a 31 días')
  const first = new Date(`${fechaInicio}T00:00:00Z`)
  if (!Number.isFinite(first.getTime()) || first.toISOString().slice(0, 10) !== fechaInicio)
    throw new Error('La fecha de inicio no existe')
  const fechaFin = new Date(first.getTime() + (dias - 1) * 86_400_000).toISOString().slice(0, 10)
  return {
    fechaInicio,
    fechaFin,
    dias,
    origenOperacion: 'SIMULADO_SGMV' as const,
    fuenteReferencias: 'https://www.amb.gov.co/rutas-publico-colectivo-complementario/',
    jornadasFuturasNoEjecutadas: true,
    empresas: companies.map(([slug, codigoRuta]) => {
      const ruta = officialAmbRoutes.find((row) => row.codigo === codigoRuta)!
      return {
        slug,
        empresa: ruta.operador,
        codigoRuta,
        busPrincipal: `SIM-${slug}-01`,
        busReserva: `SIM-${slug}-02`,
        turnos: [
          { codigo: 'AM', horaInicio: '05:30', horaFin: '11:30' },
          { codigo: 'PM', horaInicio: '12:00', horaFin: '17:00' },
        ].map((turno) => ({
          ...turno,
          jornadas: buildJourneyPeriodSlots({
            fechaInicio,
            fechaFin,
            diasSemana: [1, 2, 3, 4, 5, 6],
            horaInicio: turno.horaInicio,
            horaFin: turno.horaFin,
          }),
        })),
      }
    }),
  }
}
