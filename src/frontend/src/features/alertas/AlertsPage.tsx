import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/ui/PageHeader'
import StatePanel from '../../components/ui/StatePanel'
import { ApiError } from '../../lib/api'
import { useSession } from '../auth/session.context'
import { announceAlertsUpdated, listAlerts, markAlertAttended, markAlertRead } from './alert.api'
import type {
  AlertFilters,
  AlertInboxDto,
  AlertItemDto,
  AlertPriority,
  AlertRecipientStatus,
  AlertType,
} from './alert.types'

const TYPE_LABELS: Record<AlertType, string> = {
  BAJO_INVENTARIO: 'Bajo inventario',
  BUS_BLOQUEADO: 'Bus bloqueado',
  CAMBIO_ESTADO_NOVEDAD: 'Cambio de estado de novedad',
  CAMBIO_JORNADA: 'Cambio de jornada',
  CONFLICTO_JORNADA: 'Conflicto de jornada',
  CONSUMO_INCOMPATIBLE: 'Consumo incompatible',
  JORNADA_SIN_KILOMETRAJE_FINAL: 'Jornada sin kilometraje final',
  JORNADA_SIN_KILOMETRAJE_INICIAL: 'Jornada sin kilometraje inicial',
  MANTENIMIENTO_PROXIMO: 'Mantenimiento próximo',
  MANTENIMIENTO_VENCIDO: 'Mantenimiento vencido',
  NOVEDAD_CRITICA: 'Novedad crítica',
  ORDEN_ASIGNADA: 'Orden asignada',
  ORDEN_COMPLETADA_TECNICO: 'Orden completada por técnico',
  ORDEN_DEVUELTA: 'Orden devuelta',
  ORDEN_PENDIENTE_ASIGNACION: 'Orden pendiente de asignación',
}

const PRIORITY_LABELS: Record<AlertPriority, string> = {
  ALTA: 'Alta',
  BAJA: 'Baja',
  CRITICA: 'Crítica',
  MEDIA: 'Media',
}

const STATUS_LABELS: Record<AlertRecipientStatus, string> = {
  ATENDIDA: 'Atendida',
  LEIDA: 'Leída',
  NO_LEIDA: 'No leída',
}

const initialFilters: AlertFilters = {
  estado: '',
  fechaDesde: '',
  fechaHasta: '',
  page: 1,
  pageSize: 10,
  prioridad: '',
  tipo: '',
}

const TYPES_BY_ROLE = {
  ADMINISTRADOR: [
    'BAJO_INVENTARIO',
    'CONFLICTO_JORNADA',
    'CONSUMO_INCOMPATIBLE',
    'MANTENIMIENTO_PROXIMO',
    'MANTENIMIENTO_VENCIDO',
    'NOVEDAD_CRITICA',
    'ORDEN_COMPLETADA_TECNICO',
    'ORDEN_PENDIENTE_ASIGNACION',
  ],
  CONDUCTOR: [
    'BUS_BLOQUEADO',
    'CAMBIO_ESTADO_NOVEDAD',
    'CAMBIO_JORNADA',
    'JORNADA_SIN_KILOMETRAJE_FINAL',
    'JORNADA_SIN_KILOMETRAJE_INICIAL',
    'MANTENIMIENTO_PROXIMO',
    'MANTENIMIENTO_VENCIDO',
  ],
  DESPACHADOR: [
    'BUS_BLOQUEADO',
    'CAMBIO_JORNADA',
    'CONFLICTO_JORNADA',
    'JORNADA_SIN_KILOMETRAJE_FINAL',
    'JORNADA_SIN_KILOMETRAJE_INICIAL',
    'MANTENIMIENTO_PROXIMO',
    'MANTENIMIENTO_VENCIDO',
    'NOVEDAD_CRITICA',
  ],
  MECANICO: ['CONSUMO_INCOMPATIBLE', 'ORDEN_ASIGNADA', 'ORDEN_DEVUELTA'],
} as const satisfies Record<string, readonly AlertType[]>

function priorityTone(priority: AlertPriority): 'amber' | 'red' | 'slate' | 'teal' {
  if (priority === 'CRITICA') return 'red'
  if (priority === 'ALTA') return 'amber'
  if (priority === 'MEDIA') return 'teal'
  return 'slate'
}

function statusTone(status: AlertRecipientStatus): 'emerald' | 'slate' | 'teal' {
  if (status === 'ATENDIDA') return 'emerald'
  if (status === 'LEIDA') return 'teal'
  return 'slate'
}

function isSafeInternalLink(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'))
}

function originLink(item: AlertItemDto) {
  if (!isSafeInternalLink(item.enlaceInterno)) return null

  const detailIdByRoute: Record<string, number | undefined> = {
    '/flota': item.origen.busId,
    '/jornadas': item.origen.jornadaId,
    '/mantenimiento-preventivo': item.origen.programacionMantenimientoId,
    '/novedades': item.origen.novedadId,
    '/ordenes-trabajo': item.origen.ordenId,
    '/repuestos': item.origen.repuestoId,
  }
  const detailId = detailIdByRoute[item.enlaceInterno]
  if (!detailId) return item.enlaceInterno

  return `${item.enlaceInterno}?detalle=${detailId}&desde=alertas`
}

function formatAlertDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function contextEntries(context: Record<string, unknown>) {
  const labels: Array<[string, string]> = [
    ['busCodigo', 'Bus'],
    ['estado', 'Estado'],
    ['criticidad', 'Criticidad'],
    ['destino', 'Destino'],
    ['precedencia', 'Precedencia'],
  ]

  return labels.flatMap(([key, label]) => {
    const value = context[key]
    return typeof value === 'string' && value.trim() ? [[label, value] as const] : []
  })
}

export default function AlertsPage() {
  const { user } = useSession()
  const [filters, setFilters] = useState<AlertFilters>(initialFilters)
  const [inbox, setInbox] = useState<AlertInboxDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutatingId, setMutatingId] = useState<number | null>(null)
  const requestIdRef = useRef(0)
  const navigate = useNavigate()
  const visibleTypes = TYPES_BY_ROLE[user?.rol.codigo as keyof typeof TYPES_BY_ROLE] ?? []

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await listAlerts(filters)
      if (requestId === requestIdRef.current) setInbox(result)
    } catch (requestError) {
      if (requestId === requestIdRef.current)
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'No se pudo consultar la bandeja de alertas.',
        )
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [load])

  async function mutate(item: AlertItemDto, action: 'read' | 'attend') {
    if (mutatingId) return false
    setMutatingId(item.destinatarioId)
    setError(null)
    try {
      if (action === 'read') await markAlertRead(item.destinatarioId)
      else await markAlertAttended(item.destinatarioId)
      announceAlertsUpdated()
      await load()
      return true
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'No se pudo actualizar la alerta.',
      )
      return false
    } finally {
      setMutatingId(null)
    }
  }

  async function openOrigin(item: AlertItemDto) {
    const target = originLink(item)
    if (!target) return
    if (item.estado === 'NO_LEIDA' && !(await mutate(item, 'read'))) return
    navigate(target)
  }

  return (
    <section className="page-container">
      <PageHeader
        description="Eventos operativos y técnicos dirigidos exclusivamente a tu usuario."
        eyebrow="Bandeja personal"
        title="Alertas internas"
      />

      <form
        aria-label="Filtros de alertas"
        className="surface grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="text-xs font-medium text-slate-600">
          Estado
          <select
            className="field-control"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                estado: event.target.value as AlertRecipientStatus | '',
                page: 1,
              }))
            }
            value={filters.estado}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Prioridad
          <select
            className="field-control"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                page: 1,
                prioridad: event.target.value as AlertPriority | '',
              }))
            }
            value={filters.prioridad}
          >
            <option value="">Todas</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 md:col-span-2">
          Tipo
          <select
            className="field-control"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                page: 1,
                tipo: event.target.value as AlertType | '',
              }))
            }
            value={filters.tipo}
          >
            <option value="">Todos</option>
            {visibleTypes.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Desde
          <input
            className="field-control"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                fechaDesde: event.target.value,
                page: 1,
              }))
            }
            type="date"
            value={filters.fechaDesde}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Hasta
          <input
            className="field-control"
            min={filters.fechaDesde || undefined}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                fechaHasta: event.target.value,
                page: 1,
              }))
            }
            type="date"
            value={filters.fechaHasta}
          />
        </label>
      </form>

      {error && (
        <div
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error}</p>
          <Button className="mt-3" onClick={() => void load()} size="sm" variant="outline">
            Reintentar
          </Button>
        </div>
      )}

      {loading && (
        <StatePanel
          description="Consultando tus eventos..."
          title="Cargando alertas"
          tone="loading"
        />
      )}

      {!loading && !error && inbox?.items.length === 0 && (
        <StatePanel
          description="No hay eventos que coincidan con los filtros seleccionados."
          title="Bandeja vacía"
        />
      )}

      {!loading && inbox && inbox.items.length > 0 && (
        <div className="space-y-2.5" aria-live="polite">
          {inbox.items.map((item) => {
            const context = contextEntries(item.contextoEvento)
            return (
              <article
                className={`relative overflow-hidden rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${item.estado === 'NO_LEIDA' ? 'border-emerald-300 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-emerald-500' : 'border-slate-200'}`}
                key={item.destinatarioId}
              >
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={priorityTone(item.prioridad)}>
                        {PRIORITY_LABELS[item.prioridad]}
                      </Badge>
                      <Badge tone={statusTone(item.estado)}>{STATUS_LABELS[item.estado]}</Badge>
                      <span className="text-xs text-slate-500">{TYPE_LABELS[item.tipo]}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-950 md:text-base">
                      {item.titulo}
                    </h3>
                    <p className="mt-1 max-w-4xl text-sm leading-5 text-slate-600">
                      {item.mensaje}
                    </p>
                    {context.length > 0 && (
                      <dl
                        aria-label="Contexto permitido del evento"
                        className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"
                      >
                        {context.map(([label, value]) => (
                          <div className="flex gap-1" key={label}>
                            <dt className="font-semibold">{label}:</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <time
                      className="mt-2 block text-xs text-slate-400"
                      dateTime={item.fechaGeneracion}
                    >
                      {formatAlertDate(item.fechaGeneracion)}
                    </time>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[300px] lg:justify-end">
                    {item.estado === 'NO_LEIDA' && (
                      <Button
                        loading={mutatingId === item.destinatarioId}
                        onClick={() => void mutate(item, 'read')}
                        size="sm"
                        variant="outline"
                      >
                        Marcar leída
                      </Button>
                    )}
                    {item.estado !== 'ATENDIDA' && (
                      <Button
                        loading={mutatingId === item.destinatarioId}
                        onClick={() => void mutate(item, 'attend')}
                        size="sm"
                        variant="secondary"
                      >
                        Marcar atendida
                      </Button>
                    )}
                    {originLink(item) && (
                      <Button onClick={() => void openOrigin(item)} size="sm">
                        Ver origen
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!loading && inbox && inbox.totalPages > 1 && (
        <nav
          aria-label="Paginación de alertas"
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
        >
          <Button
            disabled={inbox.page <= 1}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
            size="sm"
            variant="outline"
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            Página {inbox.page} de {inbox.totalPages}
          </span>
          <Button
            disabled={inbox.page >= inbox.totalPages}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
            size="sm"
            variant="outline"
          >
            Siguiente
          </Button>
        </nav>
      )}
    </section>
  )
}
