import { formatNumber } from '../../lib/format'
import type { JourneyDto } from './journey.types'

export default function JourneyProjection({ journey }: { journey: JourneyDto }) {
  const projection = journey.proyeccionDemo
  if (!projection) return null
  return (
    <section
      aria-label="Proyección simulada de jornada"
      className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900"
    >
      <h4 className="font-semibold">Proyección simulada SGMV</h4>
      <p>
        Longitud oficial usada: {formatNumber(projection.longitudKmOficialSnapshot)} km. Circuito
        completo es una convención de demo, no una definición del AMB.
      </p>
      <p>
        {projection.ciclosCompletosSimulados} ciclos ×{' '}
        {formatNumber(projection.longitudKmOficialSnapshot)} km +{' '}
        {formatNumber(projection.kmNoComercialesSimulados)} km no comerciales ={' '}
        <strong>{formatNumber(projection.kmJornadaProyectadosDemo)} km proyectados</strong>.
      </p>
      {projection.conciliada ? (
        <p>
          Recorrido por odómetro: <strong>{formatNumber(projection.kmReal!)} km</strong>. Diferencia
          real − proyección: {formatNumber(projection.diferenciaKm!)} km. Prevalece la lectura real.
        </p>
      ) : ['CANCELADA', 'REASIGNADA'].includes(journey.estado) ? (
        <p>Proyección anulada; sin recorrido registrado.</p>
      ) : (
        <p>
          Cierre estimado: {formatNumber(projection.kmEstimadoCierre)} km. No modifica el odómetro
          ni determina disponibilidad.
        </p>
      )}
    </section>
  )
}
