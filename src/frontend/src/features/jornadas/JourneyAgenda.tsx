import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import { BUS_STATUS_LABELS } from '../../domain/labels'
import { useCurrentTime } from '../../hooks/useCurrentTime'
import { formatNumber } from '../../lib/format'
import JourneyProjection from './JourneyProjection'
import { JOURNEY_LABELS, closureOverdue, type JourneyAction } from './journey.view'
import type { JourneyDto } from './journey.types'

export type JourneyGroupBy = 'bus' | 'conductor' | 'fecha'

type Group = { key: string; title: string; journeys: JourneyDto[] }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Bogota',
    year: 'numeric',
  }).format(new Date(value))
}

function friendlyDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
    year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}

function groupJourneys(journeys: JourneyDto[], groupBy: JourneyGroupBy): Group[] {
  const groups = new Map<string, Group>()
  for (const journey of journeys) {
    const key =
      groupBy === 'bus'
        ? `bus-${journey.bus.id}`
        : groupBy === 'conductor'
          ? `conductor-${journey.conductor.id}`
          : `fecha-${formatDate(journey.inicioProgramado)}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        title:
          groupBy === 'bus'
            ? `${journey.bus.codigoInterno} · ${journey.bus.placa}`
            : groupBy === 'conductor'
              ? journey.conductor.nombre
              : friendlyDate(journey.inicioProgramado),
        journeys: [],
      }
      groups.set(key, group)
    }
    group.journeys.push(journey)
  }
  return [...groups.values()]
}

function JourneyActions({
  journey,
  onAction,
  onDetail,
}: {
  journey: JourneyDto
  onAction: (action: JourneyAction, journey: JourneyDto) => void
  onDetail: () => void
}) {
  const menu = useRef<HTMLDetailsElement>(null)
  const actions: Array<{ action: JourneyAction; label: string }> = [
    ...(journey.acciones.puedeIniciar
      ? [{ action: 'start' as const, label: 'Confirmar salida' }]
      : []),
    ...(journey.acciones.puedeFinalizar
      ? [{ action: 'finish' as const, label: 'Confirmar llegada' }]
      : []),
    ...(journey.acciones.puedeReasignar
      ? [
          {
            action: 'reassign' as const,
            label:
              journey.estado === 'INTERRUMPIDA'
                ? 'Crear tramo con bus sustituto'
                : 'Cambiar bus o conductor',
          },
        ]
      : []),
    ...(journey.acciones.puedeInterrumpir
      ? [{ action: 'interrupt' as const, label: 'Interrumpir jornada' }]
      : []),
    ...(journey.acciones.puedeConciliarLectura
      ? [{ action: 'reconcile' as const, label: 'Conciliar lectura observada' }]
      : []),
    ...(journey.acciones.puedeMarcarNoRecuperable
      ? [{ action: 'unrecoverable' as const, label: 'Declarar lectura no recuperable' }]
      : []),
    ...(journey.acciones.puedeCancelar
      ? [{ action: 'cancel' as const, label: 'Cancelar jornada' }]
      : []),
  ]
  return (
    <details ref={menu} className="relative justify-self-start">
      <summary
        aria-label={`Acciones de jornada ${journey.id}`}
        className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Acciones ···
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        <button
          className="block min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-slate-50"
          onClick={() => {
            menu.current?.removeAttribute('open')
            onDetail()
          }}
          type="button"
        >
          Ver detalle
        </button>
        {actions.map(({ action, label }) => (
          <button
            key={action}
            className="block min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-slate-50"
            onClick={() => {
              menu.current?.removeAttribute('open')
              onAction(action, journey)
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  )
}

function JourneyDetail({ journey }: { journey: JourneyDto }) {
  return (
    <div
      aria-label={`Detalle de jornada ${journey.id}`}
      className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
      role="region"
    >
      <p>
        <strong>Odómetro inicial:</strong>{' '}
        {journey.lecturaInicial
          ? `${formatNumber(journey.lecturaInicial.kilometraje)} km`
          : 'Pendiente'}{' '}
        · <strong>Final:</strong>{' '}
        {journey.lecturaFinal
          ? `${formatNumber(journey.lecturaFinal.kilometraje)} km`
          : journey.interrupcion?.estadoConciliacion === 'NO_RECUPERABLE'
            ? 'No recuperable'
            : 'Pendiente'}
      </p>
      {[journey.lecturaInicial, journey.lecturaFinal]
        .filter((reading) => reading !== null)
        .map((reading) => (
          <p key={reading.id}>
            Lectura {reading.tipo === 'INICIO_JORNADA' ? 'inicial' : 'final'}: observada por{' '}
            {reading.observadoPor?.nombre ?? 'persona no identificada'} el{' '}
            {formatDateTime(reading.fechaLectura)}; registrada por {reading.registradoPor.nombre} el{' '}
            {formatDateTime(reading.fechaRegistro ?? reading.fechaLectura)}.
            {reading.motivoRespaldo ? ` Respaldo: ${reading.motivoRespaldo}` : ''}
          </p>
        ))}
      {journey.motivoCambio && <p>Motivo: {journey.motivoCambio}</p>}
      {journey.motivoSucesion && <p>Motivo del bus sustituto: {journey.motivoSucesion}</p>}
      {journey.interrupcion && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-950">
          <p>
            Tramo interrumpido{journey.finReal ? ` el ${formatDateTime(journey.finReal)}` : ''}.
          </p>
          <p>
            Conciliación:{' '}
            {journey.interrupcion.estadoConciliacion === 'PENDIENTE'
              ? 'Pendiente'
              : journey.interrupcion.estadoConciliacion === 'NO_RECUPERABLE'
                ? 'No recuperable'
                : 'Lectura física registrada'}
            .
          </p>
          {journey.interrupcion.motivoAusenciaLectura && (
            <p>Ausencia inicial: {journey.interrupcion.motivoAusenciaLectura}</p>
          )}
          {journey.interrupcion.motivoNoRecuperable && (
            <p>Decisión administrativa: {journey.interrupcion.motivoNoRecuperable}</p>
          )}
          {journey.interrupcion.conciliadaPor && (
            <p>
              Conciliada por {journey.interrupcion.conciliadaPor.nombre}
              {journey.interrupcion.conciliadaAt
                ? ` el ${formatDateTime(journey.interrupcion.conciliadaAt)}`
                : ''}
              .
            </p>
          )}
          {journey.interrupcion.detalleConciliacion && (
            <p>Declaración: {journey.interrupcion.detalleConciliacion}</p>
          )}
          <p>La interrupción no habilita automáticamente el bus.</p>
        </div>
      )}
      {journey.cierrePendiente && (
        <p>
          Cierre informado por {journey.cierrePendiente.reportadoPor.nombre} el{' '}
          {formatDateTime(journey.cierrePendiente.reportadoAt)}: {journey.cierrePendiente.motivo}
        </p>
      )}
      {journey.causasDisponibilidad.length > 0 && (
        <p>
          Disponibilidad: {journey.causasDisponibilidad.map((cause) => cause.mensaje).join('; ')}
        </p>
      )}
      {(journey.jornadaAnteriorId || journey.jornadaSucesoraId) && (
        <div className="flex flex-wrap gap-3">
          {journey.jornadaAnteriorId && (
            <Link
              className="font-semibold text-cyan-800 underline"
              to={`/jornadas?detalle=${journey.jornadaAnteriorId}`}
            >
              Ver tramo anterior
            </Link>
          )}
          {journey.jornadaSucesoraId && (
            <Link
              className="font-semibold text-cyan-800 underline"
              to={`/jornadas?detalle=${journey.jornadaSucesoraId}`}
            >
              Ver tramo siguiente
            </Link>
          )}
        </div>
      )}
      {journey.proyeccionDemo && (
        <details>
          <summary className="cursor-pointer font-medium">
            Referencia académica simulada (no es odómetro)
          </summary>
          <JourneyProjection journey={journey} />
        </details>
      )}
      <Link
        className="mt-2 inline-block font-semibold text-cyan-800 underline"
        to={`/historial?busId=${journey.bus.id}`}
      >
        Ver historial del bus
      </Link>
    </div>
  )
}

export default function JourneyAgenda({
  journeys,
  onAction,
  searchTerm,
  groupBy,
  onGroupByChange,
  page,
}: {
  journeys: JourneyDto[]
  onAction: (action: JourneyAction, journey: JourneyDto) => void
  searchTerm: string
  groupBy: JourneyGroupBy
  onGroupByChange: (groupBy: JourneyGroupBy) => void
  page: number
}) {
  const [expanded, setExpanded] = useState<string[]>([])
  const [details, setDetails] = useState<number[]>([])
  const groups = groupJourneys(journeys, groupBy)
  const now = useCurrentTime()
  const searchActive = Boolean(searchTerm.trim())

  function toggle(key: string) {
    setExpanded((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    )
  }

  function toggleDetail(id: number) {
    setDetails((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }

  return (
    <section aria-label="Agenda compacta de jornadas" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="field-label max-w-xs">
          Agrupar por
          <select
            aria-label="Agrupar por"
            className="field-control"
            value={groupBy}
            onChange={(event) => {
              onGroupByChange(event.target.value as JourneyGroupBy)
              setExpanded([])
              setDetails([])
            }}
          >
            <option value="bus">Bus</option>
            <option value="conductor">Conductor</option>
            <option value="fecha">Fecha</option>
          </select>
        </label>
        <p className="text-xs text-slate-500">
          Grupos de la página {page}; use Anterior/Siguiente para consultar el resto.
        </p>
      </div>
      {groups.map((group) => {
        const open = searchActive
          ? !expanded.includes(`closed-${group.key}`)
          : expanded.includes(group.key)
        const first = group.journeys[0]
        const next = [...group.journeys]
          .filter((journey) => Date.parse(journey.inicioProgramado) >= now)
          .sort(
            (left, right) => Date.parse(left.inicioProgramado) - Date.parse(right.inicioProgramado),
          )[0]
        const busCount = new Set(group.journeys.map((journey) => journey.bus.id)).size
        const secondary =
          groupBy === 'bus'
            ? `${group.journeys.length} ${group.journeys.length === 1 ? 'jornada' : 'jornadas'} en esta página${next ? ` · Próxima: ${friendlyDate(next.inicioProgramado)} ${formatTime(next.inicioProgramado)}–${formatTime(next.finProgramado)} · ${next.conductor.nombre}` : ''}`
            : groupBy === 'conductor'
              ? `${group.journeys.length} ${group.journeys.length === 1 ? 'jornada' : 'jornadas'} · ${busCount} ${busCount === 1 ? 'bus' : 'buses'} en esta página`
              : `${group.journeys.filter((journey) => journey.estado === 'PROGRAMADA').length} programadas · ${group.journeys.filter((journey) => journey.estado === 'EN_CURSO').length} en curso · ${group.journeys.length} en total en esta página`
        return (
          <article
            key={group.key}
            aria-label={`Jornadas de ${group.title}`}
            className="surface overflow-visible p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{group.title}</h3>
                  {groupBy === 'bus' && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      Bus:
                      <Badge tone={first.bus.estadoOperativo === 'OPERATIVO' ? 'emerald' : 'amber'}>
                        {BUS_STATUS_LABELS[first.bus.estadoOperativo]}
                      </Badge>
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{secondary}</p>
              </div>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? `grupo-${group.key}` : undefined}
                onClick={() => {
                  toggle(searchActive ? `closed-${group.key}` : group.key)
                }}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                {open ? 'Ocultar jornadas' : 'Ver jornadas'}
              </button>
            </div>
            {open && (
              <div
                id={`grupo-${group.key}`}
                className="mt-3 space-y-2 border-t border-slate-100 pt-3"
              >
                {group.journeys.map((journey) => (
                  <div
                    key={journey.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/70 p-2"
                  >
                    <div
                      className={`grid items-center gap-2 text-sm sm:grid-cols-2 ${groupBy === 'fecha' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}
                    >
                      <div className="min-w-0">
                        <span className="block text-xs text-slate-500">Fecha y horario</span>
                        {friendlyDate(journey.inicioProgramado)}
                        <br />
                        {formatTime(journey.inicioProgramado)}–{formatTime(journey.finProgramado)}
                      </div>
                      {groupBy !== 'bus' && (
                        <div className="min-w-0">
                          <span className="block text-xs text-slate-500">Bus</span>
                          <span className="block">
                            {journey.bus.codigoInterno} · {journey.bus.placa}
                          </span>
                          <span className="block text-xs text-slate-500">
                            Estado del bus: {BUS_STATUS_LABELS[journey.bus.estadoOperativo]}
                          </span>
                        </div>
                      )}
                      {groupBy !== 'conductor' && (
                        <div className="min-w-0">
                          <span className="block text-xs text-slate-500">Conductor</span>
                          {journey.conductor.nombre}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="block text-xs text-slate-500">Ruta</span>
                        {journey.ruta?.nombre ?? 'Sin ruta'}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs text-slate-500">Estado de jornada</span>
                        <Badge
                          tone={
                            journey.estado === 'INTERRUMPIDA' || journey.estado === 'CANCELADA'
                              ? 'red'
                              : journey.estado === 'EN_CURSO'
                                ? 'teal'
                                : journey.estado === 'FINALIZADA'
                                  ? 'emerald'
                                  : journey.estado === 'REASIGNADA'
                                    ? 'slate'
                                    : 'amber'
                          }
                        >
                          {JOURNEY_LABELS[journey.estado]}
                        </Badge>
                        {closureOverdue(journey, now) && (
                          <span className="mt-1 block text-xs font-semibold text-red-700">
                            Cierre atrasado
                          </span>
                        )}
                        {journey.estado === 'PROGRAMADA' &&
                          journey.causasDisponibilidad.length > 0 && (
                            <span className="mt-1 block text-xs font-semibold text-amber-800">
                              No disponible para iniciar
                            </span>
                          )}
                      </div>
                      <JourneyActions
                        journey={journey}
                        onAction={onAction}
                        onDetail={() => toggleDetail(journey.id)}
                      />
                    </div>
                    {details.includes(journey.id) && (
                      <div className="mt-2">
                        <JourneyDetail journey={journey} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
