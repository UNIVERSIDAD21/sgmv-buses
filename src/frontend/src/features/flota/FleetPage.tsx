import { Link } from 'react-router-dom'

import { BUS_STATUS_LABELS } from '../../domain/labels'
import { formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import Badge from '../../components/ui/Badge'
import Drawer from '../../components/ui/Drawer'
import { Bus, Gauge, PlusCircle, Search, User } from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'

const statusRows = Object.entries(BUS_STATUS_LABELS)

export default function FleetPage() {
  const { user } = useSession()
  const canManage = user?.rol.codigo === 'ADMIN_SUPERVISOR'
  const isDriver = user?.rol.codigo === 'CONDUCTOR_OPERADOR'

  return (
    <div className="relative min-h-full p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {isDriver ? 'Mi bus asignado' : 'Gestión de la flota vehicular'}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Vista adaptada desde la interfaz seleccionada. Los datos de buses se conectaran al
                backend cuando se implemente RF-01 completo.
              </p>
            </div>
            {canManage && (
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                to="/flota/nuevo"
              >
                <PlusCircle size={16} />
                Registrar bus
              </Link>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar buses</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400"
              disabled
              placeholder="Buscar por codigo, placa o marca"
              type="search"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {statusRows.map(([value, label]) => (
              <Badge key={value} tone={value === 'OPERATIVO' ? 'emerald' : 'slate'}>
                {label}
              </Badge>
            ))}
          </div>
        </div>

        {isDriver ? (
          <StatePanel
            description="El backend determinara el bus permitido desde la asignacion activa del conductor. No se aceptaran IDs enviados por el cliente para saltar permisos."
            title="Consulta limitada al bus asignado"
            tone="empty"
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Codigo interno</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Vehiculo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Kilometraje</th>
                  <th className="px-4 py-3">Conductor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-8" colSpan={6}>
                    <StatePanel
                      description="No se muestran filas simuladas. La tabla quedó preparada para consumir el endpoint real de RF-01."
                      title="Sin datos de flota conectados"
                      tone="empty"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <Drawer
          onClose={() => undefined}
          open={false}
          subtitle="Preparado para mostrar el detalle real de un bus cuando RF-01 este disponible."
          title="Detalle de unidad"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <Bus className="text-emerald-700" size={18} />
              <span className="text-sm text-slate-500">Datos oficiales desde PostgreSQL/Neon.</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <Gauge className="text-slate-400" size={18} />
              <span className="text-sm text-slate-500">{formatNumber(0)} km registrados.</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <User className="text-slate-400" size={18} />
              <span className="text-sm text-slate-500">
                Asignación activa validada por backend.
              </span>
            </div>
          </div>
        </Drawer>
      </div>
    </div>
  )
}
