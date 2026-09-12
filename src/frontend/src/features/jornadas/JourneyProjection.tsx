import { formatNumber } from '../../lib/format'
import type { JourneyDto } from './journey.types'

export default function JourneyProjection({ journey }: { journey: JourneyDto }) {
  const projection = journey.proyeccionDemo
  if (!projection) return null
  return (
    <section
      aria-label="Proyección simulada de jornada"
      className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 text-sm text-cyan-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">Proyección simulada SGMV</h4>
        <span className="rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-800">
          Simulado
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <dt className="text-[10px] font-bold uppercase text-cyan-700">Longitud oficial</dt>
          <dd className="font-semibold tabular-nums">
            {formatNumber(projection.longitudKmOficialSnapshot)} km
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-cyan-700">Ciclos demo</dt>
          <dd className="font-semibold tabular-nums">{projection.ciclosCompletosSimulados}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-cyan-700">Proyección</dt>
          <dd className="font-semibold tabular-nums">
            {formatNumber(projection.kmJornadaProyectadosDemo)} km proyectados
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-5 text-cyan-900">
        Circuito completo es una convención de demo, no una definición del AMB. Incluye{' '}
        {formatNumber(projection.kmNoComercialesSimulados)} km no comerciales.
      </p>
      {projection.conciliada ? (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs">
          Recorrido por odómetro: <strong>{formatNumber(projection.kmReal!)} km</strong>. Diferencia
          real − proyección: {formatNumber(projection.diferenciaKm!)} km. Prevalece la lectura real.
        </p>
      ) : ['CANCELADA', 'REASIGNADA'].includes(journey.estado) ? (
        <p className="mt-2 text-xs">Proyección anulada; sin recorrido registrado.</p>
      ) : (
        <p className="mt-2 text-xs">
          Cierre estimado: {formatNumber(projection.kmEstimadoCierre)} km. No modifica el odómetro
          ni determina disponibilidad.
        </p>
      )}
    </section>
  )
}
