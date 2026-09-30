import { Link } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { BUS_STATUS_LABELS } from '../../domain/labels'
import { useCurrentTime } from '../../hooks/useCurrentTime'
import { formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import JourneyProjection from './JourneyProjection'
import { JOURNEY_LABELS, closureOverdue, type JourneyAction } from './journey.view'
import type { JourneyDto, JourneyStatus } from './journey.types'

const JOURNEY_TONES: Record<JourneyStatus, 'amber' | 'emerald' | 'red' | 'slate' | 'teal'> = {
  CANCELADA: 'red',
  EN_CURSO: 'teal',
  FINALIZADA: 'emerald',
  PROGRAMADA: 'amber',
  REASIGNADA: 'slate',
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin registrar'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function JourneyCard({
  journey,
  onAction,
}: {
  journey: JourneyDto
  onAction: (action: JourneyAction, journey: JourneyDto) => void
}) {
  const { user } = useSession()
  const now = useCurrentTime()
  const overdue = closureOverdue(journey, now)
  const hours = Math.max(0, Math.floor((now - Date.parse(journey.finProgramado)) / 3_600_000))
  return (
    <article className="surface overflow-hidden p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {journey.bus.codigoInterno} · {journey.bus.placa}
            </h3>
            <Badge tone={overdue ? 'red' : JOURNEY_TONES[journey.estado]}>
              {overdue ? 'Cierre atrasado' : JOURNEY_LABELS[journey.estado]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">Conductor: {journey.conductor.nombre}</p>
          <p className="mt-1 text-xs text-slate-500">
            {journey.ruta
              ? `${journey.ruta.codigo} · ${journey.ruta.origen} → ${journey.ruta.destino}`
              : 'Sin ruta contextual'}
          </p>
        </div>
        <Badge tone={journey.bus.estadoOperativo === 'OPERATIVO' ? 'emerald' : 'amber'}>
          {BUS_STATUS_LABELS[journey.bus.estadoOperativo]}
        </Badge>
      </div>

      {overdue && (
        <section className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">
          <p className="font-semibold">
            {user?.rol.codigo === 'CONDUCTOR' ? 'Tu jornada terminó el' : 'La jornada terminó el'}{' '}
            {formatDateTime(journey.finProgramado)} y falta registrar el cierre.
          </p>
          <p>
            Atraso: {hours === 0 ? 'menos de 1 h' : `${hours} h`}. El bus y el Conductor siguen
            bloqueados para nuevas jornadas. Registra únicamente el kilometraje final real; nunca la
            estimación.
          </p>
          <p>
            {hours >= 24
              ? 'El atraso requiere atención del Administrador (escalamiento interno a partir de 24 horas).'
              : 'Despacho recibe la alerta interna. A las 24 horas se escala al Administrador.'}
          </p>
          {journey.cierrePendiente && (
            <p>
              Informe de {journey.cierrePendiente.reportadoPor.nombre} ·{' '}
              {formatDateTime(journey.cierrePendiente.reportadoAt)}:{' '}
              {journey.cierrePendiente.motivo}
            </p>
          )}
        </section>
      )}

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="surface-muted p-3">
          <p className="text-xs font-medium uppercase text-slate-400">Horario programado</p>
          <p className="mt-1 text-slate-700">{formatDateTime(journey.inicioProgramado)}</p>
          <p className="text-slate-700">{formatDateTime(journey.finProgramado)}</p>
        </div>
        <div className="surface-muted p-3">
          <p className="text-xs font-medium uppercase text-slate-400">Odometro real</p>
          <p className="mt-1 text-slate-700">
            Inicio:{' '}
            {journey.lecturaInicial
              ? `${formatNumber(journey.lecturaInicial.kilometraje)} km`
              : 'Pendiente'}
          </p>
          <p className="text-slate-700">
            Fin:{' '}
            {journey.lecturaFinal
              ? `${formatNumber(journey.lecturaFinal.kilometraje)} km`
              : 'Pendiente'}
          </p>
          {[journey.lecturaInicial, journey.lecturaFinal]
            .filter((reading) => reading !== null)
            .map((reading) => (
              <p className="mt-1 text-xs text-slate-600" key={reading.id}>
                {reading.tipo === 'INICIO_JORNADA' ? 'Inicio' : 'Fin'}: observado por{' '}
                {reading.observadoPor?.nombre ?? 'persona no identificada'} el{' '}
                {formatDateTime(reading.fechaLectura)}; registrado por{' '}
                {reading.registradoPor.nombre} el{' '}
                {formatDateTime(reading.fechaRegistro ?? reading.fechaLectura)}.
                {reading.motivoRespaldo ? ` Respaldo: ${reading.motivoRespaldo}` : ''}
              </p>
            ))}
        </div>
      </div>

      {journey.causasDisponibilidad.length > 0 && journey.estado === 'PROGRAMADA' && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">No disponible para iniciar</p>
          {journey.causasDisponibilidad.map((cause) => (
            <p className="mt-1 text-xs text-amber-700" key={`${cause.codigo}-${cause.origenId}`}>
              {cause.mensaje}
            </p>
          ))}
        </div>
      )}

      {journey.motivoCambio && (
        <p className="mt-3 text-xs text-slate-500">Cambio: {journey.motivoCambio}</p>
      )}
      {(journey.jornadaAnteriorId || journey.jornadaSucesoraId) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          {journey.jornadaAnteriorId && (
            <Link
              className="rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200"
              to={`/jornadas?detalle=${journey.jornadaAnteriorId}`}
            >
              Ver tramo anterior
            </Link>
          )}
          {journey.jornadaSucesoraId && (
            <Link
              className="rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200"
              to={`/jornadas?detalle=${journey.jornadaSucesoraId}`}
            >
              Ver tramo siguiente
            </Link>
          )}
        </div>
      )}

      {journey.estado === 'PROGRAMADA' && !journey.lecturaInicial && (
        <p className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
          Recordatorio: el Conductor debe registrar la lectura observada al iniciar. La hora
          programada no reemplaza el odómetro real.
        </p>
      )}
      {journey.estado === 'EN_CURSO' && !journey.lecturaFinal && (
        <p className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
          Recordatorio: antes de finalizar, registre la lectura observada de cierre del odómetro.
        </p>
      )}

      {journey.lecturaInicial && journey.lecturaFinal && (
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Distancia confirmada:{' '}
          {formatNumber(journey.lecturaFinal.kilometraje - journey.lecturaInicial.kilometraje)} km
        </p>
      )}
      {journey.estado === 'PROGRAMADA' && Date.parse(journey.finProgramado) < now && (
        <p className="mt-3 text-sm text-amber-800">
          Salida pendiente de confirmar. Registre la hora y lectura que realmente observó; si no
          hubo salida, contacte a Despacho.
        </p>
      )}
      {journey.estado === 'PROGRAMADA' && Date.parse(journey.inicioProgramado) > now && (
        <p className="mt-3 text-sm text-slate-600">
          Próxima jornada: la salida estará disponible desde el horario programado.
        </p>
      )}
      {journey.estado === 'PROGRAMADA' && user?.rol.codigo === 'CONDUCTOR' && (
        <Link
          className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900"
          to={`/novedades?antesDeSalir=${journey.id}`}
        >
          Reportar problema antes de salir
        </Link>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {journey.acciones.puedeIniciar && (
          <Button onClick={() => onAction('start', journey)} size="sm">
            Confirmar salida
          </Button>
        )}
        {journey.acciones.puedeFinalizar && (
          <Button onClick={() => onAction('finish', journey)} size="sm" variant="secondary">
            {user?.rol.codigo === 'CONDUCTOR'
              ? 'Confirmar llegada'
              : overdue
                ? 'Registrar cierre ahora'
                : 'Confirmar llegada'}
          </Button>
        )}
        {overdue && user?.rol.codigo === 'CONDUCTOR' && !journey.cierrePendiente && (
          <Button onClick={() => onAction('report', journey)} size="sm" variant="outline">
            Informar que no puedo registrar el cierre
          </Button>
        )}
        {journey.acciones.puedeReasignar && (
          <Button onClick={() => onAction('reassign', journey)} size="sm" variant="outline">
            Cambiar bus o conductor
          </Button>
        )}
        {journey.acciones.puedeCancelar && (
          <Button onClick={() => onAction('cancel', journey)} size="sm" variant="danger">
            Cancelar jornada
          </Button>
        )}
      </div>
      {journey.proyeccionDemo && (
        <details className="mt-4 text-xs text-slate-500">
          <summary className="cursor-pointer">
            Referencia académica simulada (no es odómetro)
          </summary>
          <JourneyProjection journey={journey} />
        </details>
      )}
    </article>
  )
}
