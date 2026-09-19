import { useCallback, useEffect, useState } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'
import { PREVENTIVE_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import { listPreventiveRestrictions } from './preventive.api'
import type { PreventiveRestrictionDto } from './preventive.types'

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo consultar la proyeccion operativa.'
}

function targetSummary(item: PreventiveRestrictionDto) {
  const values = []
  if (item.objetivos.fecha) values.push(`Fecha objetivo: ${item.objetivos.fecha}.`)
  if (item.objetivos.kilometraje !== null) {
    values.push(`Objetivo: ${formatNumber(item.objetivos.kilometraje)} km.`)
  }
  return values.join(' ') || 'Sin objetivo pendiente.'
}

function distanceSummary(item: PreventiveRestrictionDto) {
  const values = []
  if (item.restantes.dias !== null) {
    values.push(
      item.restantes.dias < 0
        ? `${Math.abs(item.restantes.dias)} dias de retraso`
        : `${item.restantes.dias} dias restantes`,
    )
  }
  if (item.restantes.kilometros !== null) {
    values.push(
      item.restantes.kilometros < 0
        ? `${formatNumber(Math.abs(item.restantes.kilometros))} km excedidos`
        : `${formatNumber(item.restantes.kilometros)} km restantes`,
    )
  }
  return values.join(' · ') || 'Pendiente de evaluacion.'
}

export default function PreventiveRestrictionsPanel({
  focusProgramacionId,
  onOpenSchedule,
}: {
  focusProgramacionId?: number | null
  onOpenSchedule?: (programacionId: number) => void
}) {
  const [items, setItems] = useState<PreventiveRestrictionDto[] | null>(null)
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await listPreventiveRestrictions()
      setItems(response.restricciones)
      setEvaluatedAt(response.evaluadoAt)
    } catch (loadError) {
      setError(messageFrom(loadError))
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(request)
  }, [load])

  if (!items && !error) {
    return (
      <StatePanel
        description="Consultando restricciones preventivas."
        title="Cargando proyeccion"
        tone="loading"
      />
    )
  }
  if (error) {
    return (
      <StatePanel
        action={<Button onClick={() => void load()}>Reintentar</Button>}
        description={error}
        title="No fue posible cargar"
        tone="error"
      />
    )
  }
  if (items?.length === 0) {
    return (
      <StatePanel
        description="No hay preventivos proximos o vencidos para la operacion."
        title="Sin restricciones preventivas"
        tone="empty"
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <Badge tone="emerald">Seguimiento preventivo</Badge>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">
          Motivos preventivos que impiden operar
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Cada bus indica la causa, el objetivo y la siguiente accion. No incluye diagnosticos ni
          costos.
        </p>
        {evaluatedAt && (
          <p className="mt-2 text-xs text-slate-500">
            Evaluado:{' '}
            {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(evaluatedAt),
            )}
          </p>
        )}
      </section>
      <section className="grid gap-3">
        {items?.map((item) => {
          const isFocused = item.programacionId === focusProgramacionId

          return (
            <article
              aria-label={
                isFocused
                  ? `Mantenimiento preventivo ${item.programacionId}, origen de la alerta`
                  : `Mantenimiento preventivo ${item.programacionId}`
              }
              className={`rounded-lg border bg-white p-4 ${isFocused ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'}`}
              id={`preventivo-${item.programacionId}`}
              key={item.programacionId}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.bus.codigoInterno}</p>
                  {isFocused && (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Este mantenimiento originó la alerta.
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600">
                    {item.actividad ?? 'Mantenimiento preventivo programado'}
                  </p>
                </div>
                <Badge tone={item.estado === 'VENCIDO' ? 'red' : 'amber'}>
                  {PREVENTIVE_STATUS_LABELS[item.estado]}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">Objetivo</dt>
                  <dd className="mt-1 text-slate-700">{targetSummary(item)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    {item.estado === 'VENCIDO' ? 'Exceso' : 'Falta para vencer'}
                  </dt>
                  <dd className="mt-1 text-slate-700">{distanceSummary(item)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">Causa</dt>
                  <dd className="mt-1 text-slate-700">{item.causa}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="text-sm text-slate-600">
                  {item.bloqueaDespacho
                    ? 'Accion recomendada: atender el mantenimiento antes de iniciar otra jornada.'
                    : 'Accion recomendada: coordinar el mantenimiento antes del vencimiento.'}
                </p>
                {onOpenSchedule && (
                  <Button
                    onClick={() => onOpenSchedule(item.programacionId)}
                    size="sm"
                    variant="outline"
                  >
                    Abrir mantenimiento programado
                  </Button>
                )}
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
