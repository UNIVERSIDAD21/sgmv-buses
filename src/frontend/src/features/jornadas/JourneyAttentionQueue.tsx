import { useState } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import JourneyCard from './JourneyCard'
import type {
  JourneyAttentionCategory,
  JourneyAttentionResponse,
  JourneyDto,
} from './journey.types'

type AttentionFilter = 'TODAS' | 'CIERRE_PENDIENTE' | 'SALIDA_SIN_CONFIRMAR' | 'RECURSOS'

const descriptions: Record<JourneyAttentionCategory, { title: string; action: string }> = {
  CIERRE_PENDIENTE: { title: 'Cierre pendiente', action: 'Resolver cierre' },
  SALIDA_SIN_CONFIRMAR: { title: 'Salida sin confirmar', action: 'Resolver situación' },
  REASIGNACION: { title: 'Necesita reasignación', action: 'Reasignar' },
  RELEVO: { title: 'Necesita relevo', action: 'Gestionar relevo' },
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}

export default function JourneyAttentionQueue({
  data,
  onResolve,
  onAction,
}: {
  data: JourneyAttentionResponse
  onResolve: (category: JourneyAttentionCategory, journey: JourneyDto) => void
  onAction: (action: 'cancel' | 'reassign' | 'interrupt', journey: JourneyDto) => void
}) {
  const [filter, setFilter] = useState<AttentionFilter>('TODAS')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const visible = data.jornadas.filter(
    ({ categoria }) =>
      filter === 'TODAS' ||
      filter === categoria ||
      (filter === 'RECURSOS' && (categoria === 'REASIGNACION' || categoria === 'RELEVO')),
  )
  const filters: Array<{ key: AttentionFilter; label: string; count: number }> = [
    { key: 'TODAS', label: 'Todas', count: data.jornadas.length },
    { key: 'CIERRE_PENDIENTE', label: 'Cierre pendiente', count: data.conteos.cierrePendiente },
    {
      key: 'SALIDA_SIN_CONFIRMAR',
      label: 'Salida sin confirmar',
      count: data.conteos.salidaSinConfirmar,
    },
    {
      key: 'RECURSOS',
      label: 'Reasignación / relevo',
      count: data.conteos.reasignacion + data.conteos.relevo,
    },
  ]

  return (
    <section
      aria-label="Necesitan tu atención"
      className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/30 p-4"
    >
      <div>
        <h2 className="text-lg font-bold text-slate-900">Necesitan tu atención</h2>
        <details className="mt-1 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            ¿Cómo usar esta bandeja?
          </summary>
          <p className="mt-1">
            Aquí aparecen únicamente jornadas que necesitan una decisión. Cada tarjeta indica qué
            ocurrió y cuál es el siguiente paso.
          </p>
        </details>
      </div>
      <div aria-label="Filtrar pendientes" className="flex flex-wrap gap-2" role="group">
        {filters.map(({ key, label, count }) => (
          <button
            aria-pressed={filter === key}
            className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${filter === key ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            key={key}
            onClick={() => setFilter(key)}
            type="button"
          >
            {label} {count}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {data.jornadas.length === 0
            ? 'No hay jornadas que requieran una decisión de Despacho.'
            : 'No hay casos en este filtro.'}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map(({ categoria, jornada }) => {
            const { title, action } = descriptions[categoria]
            const isExpanded = expandedId === jornada.id
            const technicalCause = jornada.causasDisponibilidad.find(
              (cause) => cause.codigo !== 'CONFLICTO_JORNADA',
            )
            return (
              <article className="surface p-4" key={jornada.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {jornada.bus.codigoInterno} · {jornada.bus.placa}
                  </h3>
                  <Badge tone={categoria === 'CIERRE_PENDIENTE' ? 'red' : 'amber'}>{title}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">Conductor: {jornada.conductor.nombre}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {categoria === 'CIERRE_PENDIENTE' || categoria === 'SALIDA_SIN_CONFIRMAR'
                    ? 'Pendiente desde el'
                    : 'Salida programada:'}{' '}
                  {formatDate(
                    categoria === 'CIERRE_PENDIENTE'
                      ? jornada.finProgramado
                      : jornada.inicioProgramado,
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-800">
                  {categoria === 'CIERRE_PENDIENTE'
                    ? 'Falta confirmar la hora y el odómetro finales reales.'
                    : categoria === 'SALIDA_SIN_CONFIRMAR'
                      ? 'El sistema no tiene registro de que esta jornada haya salido.'
                      : categoria === 'REASIGNACION'
                        ? 'El bus o el Conductor asignado no está disponible para este servicio.'
                        : 'Este recorrido necesita continuar con otro recurso.'}
                </p>
                {technicalCause && (
                  <p className="mt-2 text-xs text-amber-800">
                    Restricción del bus: {technicalCause.mensaje}.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => onResolve(categoria, jornada)} size="sm">
                    {action}
                  </Button>
                  <Button
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : jornada.id)}
                    size="sm"
                    variant="outline"
                  >
                    {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                  </Button>
                </div>
                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    <JourneyCard journey={jornada} onAction={() => undefined} showActions={false} />
                    {categoria === 'CIERRE_PENDIENTE' && jornada.acciones.puedeInterrumpir && (
                      <Button
                        onClick={() => onAction('interrupt', jornada)}
                        size="sm"
                        variant="outline"
                      >
                        Interrumpir por incidencia operativa
                      </Button>
                    )}
                    {categoria === 'REASIGNACION' && jornada.acciones.puedeCancelar && (
                      <Button
                        onClick={() => onAction('cancel', jornada)}
                        size="sm"
                        variant="outline"
                      >
                        El viaje no se realizará
                      </Button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
