import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  ClipboardList,
  Package,
  PlusCircle,
  Shield,
  Wrench,
} from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import StatCard from '../../components/ui/StatCard'
import {
  NOVELTY_STATUS_LABELS,
  REQUIREMENT_NAV_ITEMS,
  ROLE_LABELS,
  type RequirementNavItem,
} from '../../domain/labels'
import { formatDateTime } from '../../lib/format'
import { useSession } from '../auth/session.context'
import { getAssignedBus, getFleetSummary } from '../flota/fleet.api'
import type { AssignedBusResponse, FleetSummaryDto } from '../flota/fleet.types'
import { getNoveltySummary, listOwnNovelties } from '../novedades/novelty.api'
import type { NoveltyListResponse, NoveltySummaryDto } from '../novedades/novelty.types'

function ModuleList({ items }: { items: RequirementNavItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <Link
          className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-700/40"
          key={item.id}
          to={item.path}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold leading-6 text-slate-900">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
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

export default function DashboardPage() {
  const { user } = useSession()
  const [fleetSummary, setFleetSummary] = useState<FleetSummaryDto | null>(null)
  const [driverBus, setDriverBus] = useState<AssignedBusResponse | null>(null)
  const [driverNovelties, setDriverNovelties] = useState<NoveltyListResponse | null>(null)
  const [fleetError, setFleetError] = useState<string | null>(null)
  const [noveltySummary, setNoveltySummary] = useState<NoveltySummaryDto | null>(null)

  const visibleItems = user
    ? REQUIREMENT_NAV_ITEMS.filter((item) => item.roles.includes(user.rol.codigo))
    : []
  const isAdmin = user?.rol.codigo === 'ADMINISTRADOR'
  const isMechanic = user?.rol.codigo === 'MECANICO'
  const isDriver = user?.rol.codigo === 'CONDUCTOR'

  useEffect(() => {
    let active = true

    async function loadDashboardContext() {
      if (!isAdmin && !isDriver) {
        return
      }

      setFleetError(null)

      try {
        if (isAdmin) {
          const [summary, novelties] = await Promise.all([getFleetSummary(), getNoveltySummary()])

          if (active) {
            setFleetSummary(summary)
            setNoveltySummary(novelties)
          }
        }

        if (isDriver) {
          const [assigned, novelties] = await Promise.all([
            getAssignedBus(),
            listOwnNovelties({
              limite: 3,
              pagina: 1,
            }),
          ])

          if (active) {
            setDriverBus(assigned)
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
  }, [isAdmin, isDriver])

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone="emerald">{ROLE_LABELS[user.rol.codigo]}</Badge>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Hola, {user.nombre}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Modulos principales del sistema de mantenimiento vehicular.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <span className="block text-xs font-medium text-slate-400">Fecha del sistema</span>
            {formatDateTime()}
          </div>
        </div>
      </section>

      {isAdmin && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              icon={<Bus size={16} />}
              label="Flota"
              note={fleetError ?? 'Buses registrados'}
              value={fleetSummary?.totalBuses ?? '...'}
            />
            <StatCard
              icon={<Shield size={16} />}
              label="Operativos"
              note="Estado actual"
              value={fleetSummary?.porEstado.OPERATIVO ?? '...'}
            />
            <StatCard
              icon={<ClipboardList size={16} />}
              label="En mantenimiento"
              note="Estado actual"
              value={fleetSummary?.porEstado.EN_MANTENIMIENTO ?? '...'}
            />
            <StatCard
              icon={<Package size={16} />}
              label="Sin conductor"
              note="Asignacion activa"
              value={fleetSummary?.sinConductor ?? '...'}
            />
            <StatCard
              icon={<AlertTriangle size={16} />}
              label="Novedades"
              note="Pendientes de revision"
              value={noveltySummary?.pendientes ?? '...'}
            />
          </div>
          <ModuleList items={visibleItems} />
        </>
      )}

      {isMechanic && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase text-slate-500">Panel tecnico</h2>
            <ModuleList items={visibleItems} />
          </section>
          <StatePanel
            description="Las ordenes asignadas, consumos autorizados e historial tecnico se mostraran cuando se implemente RF-04, RF-05 y RF-06."
            title="Trabajo tecnico pendiente"
            tone="empty"
          />
        </div>
      )}

      {isDriver && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
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
              <h3 className="text-base font-semibold text-slate-900">Bus asignado</h3>
              {fleetError && <p className="mt-2 text-sm leading-6 text-red-600">{fleetError}</p>}
              {!fleetError && driverBus?.bus && (
                <>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {driverBus.bus.codigoInterno} - {driverBus.bus.placa}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {driverBus.bus.marca} {driverBus.bus.modelo}
                  </p>
                  <Link
                    className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    to="/flota"
                  >
                    Ver detalle
                  </Link>
                </>
              )}
              {!fleetError && driverBus && !driverBus.bus && (
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  No hay una asignacion activa vinculada a este usuario.
                </p>
              )}
              {!fleetError && !driverBus && (
                <p className="mt-2 text-sm leading-6 text-slate-500">Consultando asignacion.</p>
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
