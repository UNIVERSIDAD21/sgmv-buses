import { Link } from 'react-router-dom'

import { REQUIREMENT_NAV_ITEMS, ROLE_LABELS, type RequirementNavItem } from '../../domain/labels'
import { formatDateTime } from '../../lib/format'
import { useSession } from '../auth/session.context'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { ArrowRight, Bus, ClipboardList, Package, Shield, Wrench } from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import StatCard from '../../components/ui/StatCard'

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

  if (!user) {
    return null
  }

  const visibleItems = REQUIREMENT_NAV_ITEMS.filter((item) => item.roles.includes(user.rol.codigo))
  const isAdmin = user.rol.codigo === 'ADMIN_SUPERVISOR'
  const isMechanic = user.rol.codigo === 'MECANICO'
  const isDriver = user.rol.codigo === 'CONDUCTOR_OPERADOR'

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone="emerald">{ROLE_LABELS[user.rol.codigo]}</Badge>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Hola, {user.nombre}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Esta es la estructura visual oficial del SGMV. Los módulos de negocio siguen
              pendientes de implementación y se conectarán a Neon mediante endpoints reales.
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Bus size={16} />} label="Flota" note="RF-01 pendiente" value="0" />
            <StatCard
              icon={<Shield size={16} />}
              label="Preventivos"
              note="Cálculo 7 días / 500 km pendiente"
              value="0"
            />
            <StatCard
              icon={<ClipboardList size={16} />}
              label="Ordenes"
              note="Sin endpoint operativo aun"
              value="0"
            />
            <StatCard
              icon={<Package size={16} />}
              label="Repuestos"
              note="Inventario pendiente"
              value="0"
            />
          </div>
          <ModuleList items={visibleItems} />
        </>
      )}

      {isMechanic && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase text-slate-500">Panel técnico</h2>
            <ModuleList items={visibleItems} />
          </section>
          <StatePanel
            description="Las órdenes asignadas, consumos autorizados e historial técnico se mostrarán cuando se implemente RF-04, RF-05 y RF-06."
            title="Trabajo técnico pendiente"
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
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Wrench size={18} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Resumen autorizado</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              El conductor solo verá su bus asignado, sus novedades y un resumen autorizado. No se
              mostrarán costos, inventario administrativo ni órdenes internas.
            </p>
            <Button className="mt-5 w-full" disabled variant="outline">
              Esperando endpoints RF
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
