import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import {
  BarChart2,
  Bus,
  CheckCircle,
  ClipboardList,
  Gauge,
  Package,
  Search,
  Wrench,
} from '../../components/ui/Icons'
import StatCard from '../../components/ui/StatCard'
import StatePanel from '../../components/ui/StatePanel'
import { BUS_STATUS_LABELS, ORDER_STATUS_LABELS, ROLE_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatCurrency, formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import {
  getBusHistory,
  getCostReport,
  getHistorySummary,
  getMaintenanceReport,
  getMyBusHistory,
  getPartsReport,
  listHistoryBuses,
  type HistoryFilters,
} from './history.api'
import type {
  CostReportDto,
  HistoryBusDto,
  HistoryDetailDto,
  HistoryOrderDto,
  HistorySummaryDto,
  MaintenanceReportDto,
  PartsReportDto,
} from './history.types'

type BadgeTone = 'amber' | 'emerald' | 'red' | 'slate' | 'teal'

const initialFilters: HistoryFilters = { limite: 10, pagina: 1 }

const statusTone: Record<HistoryBusDto['estadoOperativo'], BadgeTone> = {
  EN_MANTENIMIENTO: 'amber',
  FUERA_DE_SERVICIO: 'red',
  INACTIVO: 'slate',
  OPERATIVO: 'emerald',
}

const orderTone: Record<HistoryOrderDto['estado'], BadgeTone> = {
  ASIGNADA: 'teal',
  CERRADA: 'emerald',
  COMPLETADA_TECNICO: 'emerald',
  DEVUELTA_CORRECCION: 'amber',
  EN_EJECUCION: 'teal',
  PENDIENTE_ASIGNACION: 'slate',
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo consultar el historial'
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin registro'
  }

  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Filters({
  draft,
  onChange,
  onClear,
  onSubmit,
}: {
  draft: HistoryFilters
  onChange: (next: HistoryFilters) => void
  onClear: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-6"
      onSubmit={onSubmit}
    >
      <label className="lg:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-500">Buscar bus</span>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            aria-label="Buscar bus"
            className="min-h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-600"
            onChange={(event) => onChange({ ...draft, busqueda: event.target.value })}
            placeholder="Código, placa, marca o modelo"
            value={draft.busqueda ?? ''}
          />
        </div>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-500">Tipo</span>
        <select
          aria-label="Tipo de orden"
          className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          onChange={(event) =>
            onChange({ ...draft, tipo: event.target.value as HistoryFilters['tipo'] })
          }
          value={draft.tipo ?? ''}
        >
          <option value="">Todos</option>
          <option value="PREVENTIVA">Preventiva</option>
          <option value="CORRECTIVA">Correctiva</option>
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-500">Estado</span>
        <select
          aria-label="Estado de orden"
          className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          onChange={(event) =>
            onChange({ ...draft, estado: event.target.value as HistoryFilters['estado'] })
          }
          value={draft.estado ?? ''}
        >
          <option value="">Todos</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-500">Desde</span>
        <input
          aria-label="Fecha desde"
          className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
          onChange={(event) => onChange({ ...draft, fechaDesde: event.target.value })}
          type="date"
          value={draft.fechaDesde ?? ''}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-500">Hasta</span>
        <input
          aria-label="Fecha hasta"
          className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
          onChange={(event) => onChange({ ...draft, fechaHasta: event.target.value })}
          type="date"
          value={draft.fechaHasta ?? ''}
        />
      </label>
      <div className="flex gap-2 lg:col-span-6 lg:justify-end">
        <Button onClick={onClear} size="sm" variant="outline">
          Limpiar filtros
        </Button>
        <Button icon={<Search size={14} />} size="sm" type="submit">
          Aplicar filtros
        </Button>
      </div>
    </form>
  )
}

function BusCards({
  buses,
  loadingId,
  onDetail,
}: {
  buses: HistoryBusDto[]
  loadingId: string | null
  onDetail: (busId: string) => void
}) {
  if (buses.length === 0) {
    return (
      <div className="p-4">
        <StatePanel
          description="Ajuste los filtros o verifique que existan órdenes asociadas a su alcance."
          title="Sin buses con historial"
        />
      </div>
    )
  }

  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
      {buses.map((bus) => (
        <article className="rounded-xl border border-slate-200 p-4" key={bus.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{bus.codigoInterno}</p>
              <p className="text-sm text-slate-500">{bus.placa}</p>
            </div>
            <Badge tone={statusTone[bus.estadoOperativo]}>
              {BUS_STATUS_LABELS[bus.estadoOperativo]}
            </Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-400">Vehículo</dt>
              <dd className="mt-1 font-medium text-slate-700">
                {bus.marca} {bus.modelo} · {bus.anio}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Kilometraje</dt>
              <dd className="mt-1 font-medium text-slate-700">
                {formatNumber(bus.kilometrajeActual)} km
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Órdenes</dt>
              <dd className="mt-1 font-medium text-slate-700">{bus.totalOrdenes}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Último mantenimiento</dt>
              <dd className="mt-1 font-medium text-slate-700">
                {formatDate(bus.ultimoMantenimiento)}
              </dd>
            </div>
          </dl>
          {bus.costoAcumulado !== undefined && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Costo acumulado: <strong>{formatCurrency(bus.costoAcumulado)}</strong>
            </p>
          )}
          <Button
            className="mt-4 w-full"
            loading={loadingId === bus.id}
            onClick={() => onDetail(bus.id)}
            size="sm"
            variant="outline"
          >
            Ver detalle
          </Button>
        </article>
      ))}
    </div>
  )
}

function OrderHistory({ admin, orders }: { admin: boolean; orders: HistoryOrderDto[] }) {
  if (orders.length === 0) {
    return <p className="p-4 text-sm text-slate-500">Sin órdenes para los filtros actuales.</p>
  }

  return (
    <div className="divide-y divide-slate-100">
      {orders.map((order) => (
        <article className="p-4 sm:p-5" key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{order.codigo}</p>
              <p className="mt-1 text-sm text-slate-500">{order.descripcion}</p>
            </div>
            <Badge tone={orderTone[order.estado]}>{ORDER_STATUS_LABELS[order.estado]}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span>{order.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva'}</span>
            <span>Creada: {formatDate(order.fechaCreacion)}</span>
            <span>Técnico: {order.tecnico ?? 'Sin asignar'}</span>
            {admin && order.costoTotal !== undefined && (
              <strong className="text-emerald-700">{formatCurrency(order.costoTotal)}</strong>
            )}
          </div>
          {order.diagnosticos?.map((diagnosis) => (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs" key={diagnosis.fechaInicio}>
              <p className="font-semibold text-slate-700">Diagnóstico · {diagnosis.tecnico}</p>
              <p className="mt-1 text-slate-600">{diagnosis.diagnostico ?? 'Sin diagnóstico'}</p>
              {diagnosis.actividades.length > 0 && (
                <p className="mt-1 text-slate-500">
                  Actividades: {diagnosis.actividades.join(' · ')}
                </p>
              )}
            </div>
          ))}
          {order.repuestos && order.repuestos.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Repuestos:{' '}
              {order.repuestos.map((part) => `${part.codigo} (${part.cantidad})`).join(', ')}
            </p>
          )}
        </article>
      ))}
    </div>
  )
}

function HistoryDetail({
  detail,
  isAdmin,
  title = 'Detalle histórico del bus',
}: {
  detail: HistoryDetailDto
  isAdmin: boolean
  title?: string
}) {
  return (
    <div className="space-y-4" data-testid="history-detail">
      <Section title={title}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Bus</p>
            <p className="font-semibold text-slate-900">{detail.bus.codigoInterno}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Placa</p>
            <p className="font-semibold text-slate-900">{detail.bus.placa}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Kilometraje actual</p>
            <p className="font-semibold text-slate-900">
              {formatNumber(detail.bus.kilometrajeActual)} km
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Estado</p>
            <Badge tone={statusTone[detail.bus.estadoOperativo]}>
              {BUS_STATUS_LABELS[detail.bus.estadoOperativo]}
            </Badge>
          </div>
        </div>
      </Section>

      <Section title="Línea de tiempo de mantenimiento">
        <OrderHistory admin={isAdmin} orders={detail.ordenes} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Mantenimiento programado">
          <div className="divide-y divide-slate-100">
            {detail.mantenimientos.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Sin programaciones registradas.</p>
            ) : (
              detail.mantenimientos.map((schedule) => (
                <div className="p-4 text-sm" key={schedule.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{schedule.tipo}</p>
                    <Badge tone={schedule.activa ? 'emerald' : 'slate'}>
                      {schedule.activa ? 'Activa' : 'Histórica'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-slate-500">{schedule.actividad}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDate(schedule.fechaProgramada)}
                    {schedule.kilometrajeObjetivo
                      ? ` · ${formatNumber(schedule.kilometrajeObjetivo)} km`
                      : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section title={isAdmin ? 'Novedades del bus' : 'Mis novedades del bus'}>
          <div className="divide-y divide-slate-100">
            {detail.novedades.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Sin novedades visibles.</p>
            ) : (
              detail.novedades.map((novelty) => (
                <div className="p-4 text-sm" key={novelty.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{novelty.tipo}</p>
                    <Badge tone="slate">{novelty.estado.replaceAll('_', ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-slate-500">{novelty.descripcion}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDate(novelty.fechaReporte)}
                    {novelty.reportadaPor ? ` · ${novelty.reportadaPor}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>

      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Asignaciones de conductor">
            <div className="divide-y divide-slate-100">
              {detail.asignaciones.map((assignment) => (
                <div
                  className="flex items-center justify-between gap-3 p-4 text-sm"
                  key={assignment.id}
                >
                  <div>
                    <p className="font-medium text-slate-800">{assignment.conductor}</p>
                    <p className="text-xs text-slate-400">
                      Desde {formatDate(assignment.fechaInicio)}
                    </p>
                  </div>
                  <Badge tone={assignment.activa ? 'emerald' : 'slate'}>
                    {assignment.activa ? 'Actual' : 'Finalizada'}
                  </Badge>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Cambios de estado y kilometraje">
            <div className="p-4 text-sm text-slate-600">
              <p>{detail.estados.length} cambios de estado registrados.</p>
              <p className="mt-2">
                {detail.kilometrajes.length} lecturas históricas de kilometraje.
              </p>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

function AdminReports({
  costs,
  maintenance,
  parts,
}: {
  costs: CostReportDto | null
  maintenance: MaintenanceReportDto | null
  parts: PartsReportDto | null
}) {
  return (
    <Section title="Informes administrativos">
      <div className="grid gap-4 p-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <Wrench size={17} />
            <h3 className="text-sm font-semibold">Mantenimiento</h3>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {maintenance?.paginacion.total ?? 0}
          </p>
          <p className="text-xs text-slate-500">órdenes en el período</p>
          <div className="mt-3 space-y-2">
            {maintenance?.registros.slice(0, 3).map((row) => (
              <div className="flex justify-between gap-3 text-xs" key={row.id}>
                <span className="font-medium text-slate-700">{row.codigo}</span>
                <span className="text-slate-400">{row.bus}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-cyan-700">
            <Package size={17} />
            <h3 className="text-sm font-semibold">Repuestos utilizados</h3>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {parts?.paginacion.total ?? 0}
          </p>
          <p className="text-xs text-slate-500">referencias consumidas</p>
          <div className="mt-3 space-y-2">
            {parts?.registros.slice(0, 3).map((row) => (
              <div className="flex justify-between gap-3 text-xs" key={row.id}>
                <span className="font-medium text-slate-700">{row.codigo}</span>
                <span className="text-slate-400">
                  {row.cantidad} {row.unidadMedida}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <BarChart2 size={17} />
            <h3 className="text-sm font-semibold">Costos por bus</h3>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatCurrency(costs?.costoTotal ?? 0)}
          </p>
          <p className="text-xs text-slate-500">costo histórico filtrado</p>
          <div className="mt-3 space-y-2">
            {costs?.registros.slice(0, 3).map((row) => (
              <div className="flex justify-between gap-3 text-xs" key={row.busId}>
                <span className="font-medium text-slate-700">{row.bus}</span>
                <span className="text-slate-400">{formatCurrency(row.costoTotal)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

export default function HistoryReportsPage() {
  const { user } = useSession()
  const [draft, setDraft] = useState<HistoryFilters>(initialFilters)
  const [filters, setFilters] = useState<HistoryFilters>(initialFilters)
  const [summary, setSummary] = useState<HistorySummaryDto | null>(null)
  const [buses, setBuses] = useState<HistoryBusDto[]>([])
  const [detail, setDetail] = useState<HistoryDetailDto | null>(null)
  const [maintenance, setMaintenance] = useState<MaintenanceReportDto | null>(null)
  const [parts, setParts] = useState<PartsReportDto | null>(null)
  const [costs, setCosts] = useState<CostReportDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const role = user?.rol.codigo
  const isAdmin = role === 'ADMINISTRADOR'

  const load = useCallback(async () => {
    if (!role) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (role === 'CONDUCTOR') {
        const [summaryResult, myBus] = await Promise.all([
          getHistorySummary(filters),
          getMyBusHistory(filters),
        ])
        setSummary(summaryResult)
        setDetail(myBus.historial)
        setBuses([])
      } else {
        const [summaryResult, busResult] = await Promise.all([
          getHistorySummary(filters),
          listHistoryBuses(filters),
        ])
        setSummary(summaryResult)
        setBuses(busResult.buses)

        if (role === 'ADMINISTRADOR') {
          const [maintenanceResult, partsResult, costsResult] = await Promise.all([
            getMaintenanceReport(filters),
            getPartsReport(filters),
            getCostReport(filters),
          ])
          setMaintenance(maintenanceResult)
          setParts(partsResult)
          setCosts(costsResult)
        }
      }
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [filters, role])

  useEffect(() => {
    let active = true

    async function loadInitialHistory() {
      await Promise.resolve()

      if (active) {
        await load()
      }
    }

    void loadInitialHistory()

    return () => {
      active = false
    }
  }, [load])

  const openDetail = async (busId: string) => {
    setLoadingId(busId)
    setError(null)

    try {
      setDetail(await getBusHistory(busId, filters))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoadingId(null)
    }
  }

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()

    if (draft.fechaDesde && draft.fechaHasta && draft.fechaDesde > draft.fechaHasta) {
      setError('La fecha inicial no puede ser posterior a la fecha final')
      return
    }

    setDetail(role === 'CONDUCTOR' ? detail : null)
    setFilters({ ...draft, pagina: 1 })
  }

  const clearFilters = () => {
    setDraft(initialFilters)
    setFilters(initialFilters)
    setDetail(role === 'CONDUCTOR' ? detail : null)
    setError(null)
  }

  if (loading && !summary) {
    return (
      <div className="p-4 md:p-6">
        <StatePanel
          description="Estamos consolidando los datos validados de flota, mantenimiento y repuestos."
          title="Consultando historial"
          tone="loading"
        />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="p-4 md:p-6">
        <StatePanel
          action={<Button onClick={() => void load()}>Reintentar</Button>}
          description={error}
          title="No se pudo cargar RF-06"
          tone="error"
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-950">Historial e informes</h1>
            {role && <Badge tone="teal">{`Vista ${ROLE_LABELS[role]}`}</Badge>}
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Consulta cronológica derivada de registros validados. No crea ni modifica información
            operativa.
          </p>
          {summary && <p className="mt-1 text-xs text-slate-400">Alcance: {summary.alcance}</p>}
        </div>
        <Badge tone="emerald">Solo lectura</Badge>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<Bus size={17} />}
            label="Buses en alcance"
            value={summary.indicadores.buses}
          />
          <StatCard
            icon={<ClipboardList size={17} />}
            label="Órdenes"
            value={summary.indicadores.ordenes}
          />
          <StatCard
            icon={<CheckCircle size={17} />}
            label="Órdenes cerradas"
            value={summary.indicadores.ordenesCerradas}
          />
          <StatCard
            icon={<Wrench size={17} />}
            label="Mantenimientos programados"
            value={summary.indicadores.mantenimientosProgramados}
          />
          <StatCard
            icon={<Gauge size={17} />}
            label={isAdmin ? 'Costo total' : 'Novedades visibles'}
            value={
              isAdmin ? formatCurrency(summary.costoTotal ?? 0) : summary.indicadores.novedades
            }
          />
        </section>
      )}

      {role !== 'CONDUCTOR' && (
        <Filters draft={draft} onChange={setDraft} onClear={clearFilters} onSubmit={applyFilters} />
      )}

      {role !== 'CONDUCTOR' && (
        <Section
          title={isAdmin ? 'Historial consolidado de la flota' : 'Historial técnico autorizado'}
        >
          <BusCards
            buses={buses}
            loadingId={loadingId}
            onDetail={(busId) => void openDetail(busId)}
          />
        </Section>
      )}

      {isAdmin && <AdminReports costs={costs} maintenance={maintenance} parts={parts} />}

      {role === 'CONDUCTOR' && !detail && (
        <StatePanel
          description="No existe una asignación activa. El historial no acepta identificadores de bus enviados por el conductor."
          title="Sin bus asignado actualmente"
        />
      )}

      {detail && (
        <HistoryDetail
          detail={detail}
          isAdmin={isAdmin}
          title={
            role === 'CONDUCTOR' ? 'Historial de mi bus asignado' : 'Detalle histórico del bus'
          }
        />
      )}
    </div>
  )
}
