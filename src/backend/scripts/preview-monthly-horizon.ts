import { buildMonthlyHorizon } from '../src/amb/monthly-horizon.js'
import { documentedAmbRoutes2026 } from '../src/amb/documented-routes-2026.js'

const option = (key: string) =>
  process.argv.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1)
const fechaInicio = option('--desde')
const fechaFin = option('--hasta')
if (!fechaInicio || !fechaFin) throw new Error('Indique --desde=AAAA-MM-DD y --hasta=AAAA-MM-DD')
console.log(
  JSON.stringify(
    {
      meses: buildMonthlyHorizon(fechaInicio, fechaFin),
      referenciasPublicas: documentedAmbRoutes2026.map(
        ({ codigo, nombre, operador, procedencia }) => ({
          codigo,
          nombre,
          operador,
          fuente: procedencia.fuente,
          pagina: procedencia.pagina,
          vigencia: procedencia.vigencia,
        }),
      ),
      estado: 'REFERENCIAS_PUBLICAS_PARA_ESCENARIO_SIMULADO',
      catalogoNoExhaustivo: true,
      aplicaDatos: false,
      requisitos:
        'Aplicar solo el escenario de simulación autorizado con demo:amb:horizonte:local. Las referencias públicas no certifican placas, personal, inventario ni plan de rodamiento empresarial.',
    },
    null,
    2,
  ),
)
