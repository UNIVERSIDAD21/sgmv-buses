import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  CheckCircle,
  ClipboardList,
  Package,
  PlusCircle,
  Shield,
  Wrench,
} from '../../components/ui/Icons'
import StatCard from '../../components/ui/StatCard'
import { NOVELTY_STATUS_LABELS, REQUIREMENT_NAV_ITEMS, ROLE_LABELS } from '../../domain/labels'
import { formatDateTime } from '../../lib/format'
import { useSession } from '../auth/session.context'
import { getFleetSummary } from '../flota/fleet.api'
import type { FleetSummaryDto } from '../flota/fleet.types'
import { getMyJourney } from '../jornadas/journey.api'
import type { MyJourneyResponse } from '../jornadas/journey.types'
import { getNoveltySummary, listOwnNovelties } from '../novedades/novelty.api'
import type { NoveltyListResponse, NoveltySummaryDto } from '../novedades/novelty.types'
import { getWorkOrderSummary } from '../ordenes-trabajo/work-order.api'
import type { WorkOrderSummaryDto } from '../ordenes-trabajo/work-order.types'
import { getPreventiveSummary } from '../preventivo/preventive.api'
import type { PreventiveSummaryDto } from '../preventivo/preventive.types'
import { getSparePartSummary } from '../repuestos/spare-part.api'
import type { SparePartSummaryDto } from '../repuestos/spare-part.types'

interface NavigationItem {
  description: string
  label: string
  path: string
}

function ModuleList({ items }: { items: NavigationItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <Link
          className="group rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-emerald-700/40 hover:shadow-sm"
          key={item.path}
          to={item.path}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold leading-5 text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
            </div>
            <ArrowRight
              className="mt-1 shrink-0 text-slate-300 group-hover:text-emerald-700"
              size={16}
            />
          </div>
        </Link>
      ))}
    </div>
  )
}

interface AttentionItem {
  actionLabel: string
  count: number | null
  description: string
  to: string
  title: string
}

function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const pendingItems = items.filter((item) => item.count === null)
  const actionableItems = items.filter((item) => (item.count ?? 0) > 0)

  return (
    <section className="surface p-4 md:p-5" aria-label="Requiere tu atención">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-950">Requiere tu atención</h2>
        <p className="text-sm leading-5 text-slate-600">
          Situaciones con registros pendientes. Cada acceso abre el listado ya preparado para
          actuar.
        </p>
      </div>

      {pendingItems.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pendingItems.map((item) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={item.title}>
              <p className="text-sm font-medium text-slate-800">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Cargando prioridad operativa.</p>
            </div>
          ))}
        </div>
      ) : actionableItems.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actionableItems.map((item) => (
            <Link
              className="group rounded-lg border border-amber-200 bg-amber-50 p-3 transition hover:border-amber-400 hover:bg-amber-100"
              key={item.title}
              to={item.to}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tabular-nums text-amber-950">{item.count}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                  <p className="mt-2 text-xs font-semibold text-emerald-800 group-hover:underline">
                    {item.actionLabel}
                  </p>
                </div>
                <ArrowRight className="mt-1 shrink-0 text-amber-700" size={16} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          No hay registros pendientes en los indicadores de atención.
        </p>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const { user } = useSession()
  const [fleetSummary, setFleetSummary] = useState<FleetSummaryDto | null>(null)
  const [driverJourney, setDriverJourney] = useState<MyJourneyResponse | null>(null)
  const [driverNovelties, setDriverNovelties] = useState<NoveltyListResponse | null>(null)
  const [fleetError, setFleetError] = useState<string | null>(null)
  const [noveltySummary, setNoveltySummary] = useState<NoveltySummaryDto | null>(null)
  const [preventiveSummary, setPreventiveSummary] = useState<PreventiveSummaryDto | null>(null)
  const [sparePartSummary, setSparePartSummary] = useState<SparePartSummaryDto | null>(null)
  const [workOrderSummary, setWorkOrderSummary] = useState<WorkOrderSummaryDto | null>(null)

  const visibleItems = user
    ? REQUIREMENT_NAV_ITEMS.filter((item) => item.roles.includes(user.rol.codigo))
    : []
  const isAdmin = user?.rol.codigo === 'ADMINISTRADOR'
  const isDispatcher = user?.rol.codigo === 'DESPACHADOR'
  const isMechanic = user?.rol.codigo === 'MECANICO'
  const isDriver = user?.rol.codigo === 'CONDUCTOR'
  const dispatcherTaskItems: NavigationItem[] = [
    {
      description: 'Consulte buses, kilometraje y restricciones antes de preparar el despacho.',
      label: 'Consultar flota disponible',
      path: '/flota',
    },
    {
      description: 'Programe, inicie y supervise las jornadas operativas asignadas.',
      label: 'Programar y supervisar jornadas',
      path: '/jornadas',
    },
    {
      description: 'Revise los reportes que pueden exigir coordinación de recursos.',
      label: 'Atender novedades operativas',
      path: '/novedades',
    },
    {
      description: 'Identifique qué buses no pueden salir y consulte la causa permitida.',
      label: 'Revisar buses restringidos',
      path: '/ordenes-trabajo/despacho',
    },
    {
      description: 'Consulte jornadas, kilometraje y novedades de la operación.',
      label: 'Consultar historial operacional',
      path: '/historial',
    },
  ]
  const adminAttentionItems: AttentionItem[] = [
    {
      actionLabel: 'Revisar novedades',
      count: noveltySummary?.pendientes ?? null,
      description: 'Clasifique, resuelva o convierta en una orden cuando corresponda.',
      title: 'Novedades pendientes de revisión',
      to: '/novedades?estado=PENDIENTE_REVISION',
    },
    {
      actionLabel: 'Revisar mantenimientos',
      count: preventiveSummary
        ? preventiveSummary.estados.PROXIMO + preventiveSummary.estados.VENCIDO
        : null,
      description: 'Programaciones próximas o vencidas que requieren seguimiento.',
      title: 'Mantenimientos que requieren atención',
      to: '/mantenimiento-preventivo?requiereAtencion=true',
    },
    {
      actionLabel: 'Asignar mecánico',
      count: workOrderSummary?.pendientesAsignacion ?? null,
      description: 'Órdenes que todavía no tienen responsable técnico.',
      title: 'Órdenes pendientes de asignación',
      to: '/ordenes-trabajo?estado=PENDIENTE_ASIGNACION',
    },
    {
      actionLabel: 'Validar órdenes',
      count: workOrderSummary?.pendientesRevision ?? null,
      description: 'Órdenes completadas por el mecánico que esperan revisión.',
      title: 'Órdenes esperando validación',
      to: '/ordenes-trabajo?estado=COMPLETADA_TECNICO',
    },
    {
      actionLabel: 'Revisar inventario',
      count: sparePartSummary ? sparePartSummary.bajoStock + sparePartSummary.agotados : null,
      description: 'Repuestos agotados o con existencias bajas.',
      title: 'Repuestos que requieren reposición',
      to: '/repuestos?requiereReposicion=true',
    },
  ]

  useEffect(() => {
    let active = true

    async function loadDashboardContext() {
      if (!isAdmin && !isDispatcher && !isDriver && !isMechanic) {
        return
      }

      setFleetError(null)

      try {
        if (isAdmin) {
          const [summary, novelties, preventive, workOrders, spareParts] = await Promise.all([
            getFleetSummary(),
            getNoveltySummary(),
            getPreventiveSummary(),
            getWorkOrderSummary(),
            getSparePartSummary(),
          ])

          if (active) {
            setFleetSummary(summary)
            setNoveltySummary(novelties)
            setPreventiveSummary(preventive)
            setWorkOrderSummary(workOrders)
            setSparePartSummary(spareParts)
          }
        }

        if (isDispatcher) {
          const [summary, novelties] = await Promise.all([getFleetSummary(), getNoveltySummary()])

          if (active) {
            setFleetSummary(summary)
            setNoveltySummary(novelties)
          }
        }

        if (isMechanic) {
          const workOrders = await getWorkOrderSummary()

          if (active) {
            setWorkOrderSummary(workOrders)
          }
        }

        if (isDriver) {
          const [journey, novelties] = await Promise.all([
            getMyJourney(),
            listOwnNovelties({
              limite: 3,
              pagina: 1,
            }),
          ])

          if (active) {
            setDriverJourney(journey)
            setDriverNovelties(novelties)
          }
        }
      } catch {
        if (active) {
          setFleetError('No fue posible cargar el resumen operativo')
        }
      }
    }

    loadDashboardContext()

    return () => {
      active = false
    }
  }, [isAdmin, isDispatcher, isDriver, isMechanic])

  if (!user) {
    return null
  }

  const activeDriverJourney = driverJourney?.jornadaActual ?? driverJourney?.proximaJornada ?? null

  return (
    <div className="page-container">
      <section className="surface p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone="emerald">{ROLE_LABELS[user.rol.codigo]}</Badge>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">
              Hola, {user.nombre}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
              Prioridades y accesos de tu jornada de trabajo.
            </p>
          </div>
          <div className="surface-muted px-3 py-2 text-xs text-slate-600">
            <span className="block text-xs font-medium text-slate-600">Fecha del sistema</span>
            {formatDateTime()}
          </div>
        </div>
      </section>

      {isAdmin && (
        <>
          <div
            aria-label="Resumen operativo"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
          >
            <StatCard
              actionLabel="Ver flota"
              description="Buses registrados"
              icon={<Bus size={16} />}
              label="Total de buses"
              note={fleetError ?? undefined}
              to="/flota"
              value={fleetSummary?.totalBuses ?? null}
            />
            <StatCard
              actionLabel="Ver buses operativos"
              description="Estado operativo actual"
              icon={<Shield size={16} />}
              label="Buses operativos"
              note="Listos para operar si no tienen otras restricciones"
              to="/flota?estado=OPERATIVO"
              value={fleetSummary?.porEstado.OPERATIVO ?? null}
            />
            <StatCard
              actionLabel="Ver buses en mantenimiento"
              description="Estado operativo actual"
              icon={<ClipboardList size={16} />}
              label="Buses en mantenimiento"
              note="No disponibles para una nueva jornada"
              priority="attention"
              to="/flota?estado=EN_MANTENIMIENTO"
              value={fleetSummary?.porEstado.EN_MANTENIMIENTO ?? null}
            />
            <StatCard
              actionLabel="Revisar asignaciones"
              description="Sin una asignación activa"
              icon={<Package size={16} />}
              label="Buses sin conductor"
              note="Revise la asignación antes de programar una jornada"
              to="/flota?sinConductor=true"
              value={fleetSummary?.sinConductor ?? null}
            />
            <StatCard
              actionLabel="Revisar novedades"
              description="Esperan decisión administrativa"
              icon={<AlertTriangle size={16} />}
              label="Novedades pendientes de revisión"
              note="Clasifique, resuelva o genere una orden"
              priority="attention"
              to="/novedades?estado=PENDIENTE_REVISION"
              value={noveltySummary?.pendientes ?? null}
            />
            <StatCard
              actionLabel="Revisar mantenimientos"
              description="Próximos o vencidos"
              icon={<Shield size={16} />}
              label="Mantenimientos que requieren atención"
              note="Programaciones preventivas próximas o vencidas"
              priority="attention"
              to="/mantenimiento-preventivo?requiereAtencion=true"
              value={
                preventiveSummary
                  ? preventiveSummary.estados.PROXIMO + preventiveSummary.estados.VENCIDO
                  : null
              }
            />
            <StatCard
              actionLabel="Asignar mecánico"
              description="Esperan un responsable técnico"
              icon={<ClipboardList size={16} />}
              label="Órdenes pendientes de asignación"
              note="Asigne un mecánico para iniciar el trabajo"
              priority="attention"
              to="/ordenes-trabajo?estado=PENDIENTE_ASIGNACION"
              value={workOrderSummary?.pendientesAsignacion ?? null}
            />
            <StatCard
              actionLabel="Ver órdenes en ejecución"
              description="Trabajo técnico en curso"
              icon={<Wrench size={16} />}
              label="Órdenes en ejecución"
              note="Siga el avance de cada intervención"
              to="/ordenes-trabajo?estado=EN_EJECUCION"
              value={workOrderSummary?.porEstado.EN_EJECUCION ?? null}
            />
            <StatCard
              actionLabel="Validar órdenes"
              description="Completadas por el mecánico"
              icon={<CheckCircle size={16} />}
              label="Órdenes esperando validación"
              note="Revise la evidencia antes de cerrar"
              priority="attention"
              to="/ordenes-trabajo?estado=COMPLETADA_TECNICO"
              value={workOrderSummary?.pendientesRevision ?? null}
            />
            <StatCard
              actionLabel="Revisar inventario"
              description="Bajo stock o agotados"
              icon={<Package size={16} />}
              label="Repuestos que requieren reposición"
              note="Verifique existencias antes de una intervención"
              priority="attention"
              to="/repuestos?requiereReposicion=true"
              value={
                sparePartSummary ? sparePartSummary.bajoStock + sparePartSummary.agotados : null
              }
            />
          </div>
          <AttentionPanel items={adminAttentionItems} />
          <ModuleList items={visibleItems} />
        </>
      )}

      {isDispatcher && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase text-slate-500">Panel operativo</h2>
            <ModuleList items={dispatcherTaskItems} />
          </section>
          <div className="space-y-3">
            <StatCard
              actionLabel="Ver flota"
              description="Buses registrados"
              icon={<Bus size={16} />}
              label="Total de buses"
              note={fleetError ?? undefined}
              to="/flota"
              value={fleetSummary?.totalBuses ?? null}
            />
            <StatCard
              actionLabel="Ver disponibilidad"
              description="Estado operativo actual"
              icon={<Shield size={16} />}
              label="Buses operativos"
              note="Confirme restricciones antes de programar"
              to="/flota?estado=OPERATIVO"
              value={fleetSummary?.porEstado.OPERATIVO ?? null}
            />
            <StatCard
              actionLabel="Ver buses restringidos"
              description="Mantenimiento o fuera de servicio"
              icon={<AlertTriangle size={16} />}
              label="Buses restringidos"
              note="No se pueden usar para una nueva jornada"
              priority="attention"
              to="/ordenes-trabajo/despacho"
              value={
                fleetSummary
                  ? fleetSummary.porEstado.EN_MANTENIMIENTO +
                    fleetSummary.porEstado.FUERA_DE_SERVICIO
                  : null
              }
            />
            <StatCard
              actionLabel="Coordinar novedades"
              description="Requieren seguimiento operativo"
              icon={<ClipboardList size={16} />}
              label="Novedades pendientes de atención"
              note="Revise si requiere cambiar recursos de una jornada"
              priority="attention"
              to="/novedades?estado=PENDIENTE_REVISION"
              value={noveltySummary?.pendientes ?? null}
            />
          </div>
        </div>
      )}

      {isMechanic && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase text-slate-500">Panel tecnico</h2>
            <ModuleList items={visibleItems} />
          </section>
          <div className="space-y-3">
            <StatCard
              icon={<ClipboardList size={16} />}
              label="Asignadas"
              note={fleetError ?? 'Ordenes propias'}
              value={workOrderSummary?.porEstado.ASIGNADA ?? null}
            />
            <StatCard
              icon={<Wrench size={16} />}
              label="En ejecucion"
              note="Ordenes propias"
              value={workOrderSummary?.porEstado.EN_EJECUCION ?? null}
            />
            <StatCard
              icon={<AlertTriangle size={16} />}
              label="Devueltas"
              note="Correccion tecnica"
              value={workOrderSummary?.porEstado.DEVUELTA_CORRECCION ?? null}
            />
          </div>
        </div>
      )}

      {isDriver && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase text-slate-500">
              Panel del conductor
            </h2>
            <ModuleList items={visibleItems} />
          </section>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Wrench size={18} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Mi jornada</h3>
              {fleetError && <p className="mt-2 text-sm leading-6 text-red-600">{fleetError}</p>}
              {!fleetError && activeDriverJourney && (
                <>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {activeDriverJourney.bus.codigoInterno} - {activeDriverJourney.bus.placa}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {activeDriverJourney.ruta
                      ? `${activeDriverJourney.ruta.codigo} · ${activeDriverJourney.ruta.nombre}`
                      : 'Sin ruta contextual'}
                  </p>
                  <Link
                    className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    to="/jornadas"
                  >
                    Ver mi jornada
                  </Link>
                </>
              )}
              {!fleetError && driverJourney && !activeDriverJourney && (
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  No hay una jornada en curso ni una proxima jornada programada.
                </p>
              )}
              {!fleetError && !driverJourney && (
                <p className="mt-2 text-sm leading-6 text-slate-500">Consultando jornada.</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Novedades recientes</h3>
              {driverNovelties?.novedades.length ? (
                <div className="mt-3 space-y-2">
                  {driverNovelties.novedades.map((novelty) => (
                    <div className="rounded-lg bg-slate-50 px-3 py-2" key={novelty.id}>
                      <p className="text-sm font-semibold text-slate-800">{novelty.tipo}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {
                          NOVELTY_STATUS_LABELS[
                            novelty.estado as keyof typeof NOVELTY_STATUS_LABELS
                          ]
                        }
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  No hay novedades registradas para este usuario.
                </p>
              )}
              <Link
                className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                to="/novedades"
              >
                <PlusCircle size={16} />
                Registrar novedad
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
