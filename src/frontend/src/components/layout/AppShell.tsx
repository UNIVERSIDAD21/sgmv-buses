import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  REQUIREMENT_NAV_ITEMS,
  ROLE_LABELS,
  type AppRouteId,
  type RequirementRouteId,
  type RoleCode,
} from '../../domain/labels'
import { formatDateTime } from '../../lib/format'
import Button from '../ui/Button'
import {
  AlertTriangle,
  BarChart2,
  Bell,
  Bus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Shield,
  X,
} from '../ui/Icons'

interface AppShellProps {
  onLogout: () => Promise<void>
  user: {
    email: string
    nombre: string
    rol: {
      codigo: RoleCode
    }
  }
}

interface NavigationItem {
  icon: ReactNode
  id: AppRouteId | 'inicio'
  label: string
  path: string
  roles: RoleCode[]
}

const iconById: Record<RequirementRouteId, ReactNode> = {
  flota: <Bus size={18} />,
  historial: <BarChart2 size={18} />,
  'mantenimiento-preventivo': <Shield size={18} />,
  novedades: <AlertTriangle size={18} />,
  'ordenes-trabajo': <ClipboardList size={18} />,
  repuestos: <Package size={18} />,
}

const allRoles: RoleCode[] = ['ADMIN_SUPERVISOR', 'MECANICO', 'CONDUCTOR_OPERADOR']

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function getPageTitle(pathname: string) {
  if (pathname === '/inicio' || pathname === '/') {
    return 'Inicio'
  }

  if (pathname.startsWith('/flota/nuevo')) {
    return 'Registro de bus'
  }

  if (pathname.includes('/editar')) {
    return 'Edición de bus'
  }

  return (
    REQUIREMENT_NAV_ITEMS.find((item) => pathname.startsWith(item.path))?.label ??
    'Software de Gestión de Mantenimiento Vehicular'
  )
}

function NavigationList({
  compact,
  items,
  onNavigate,
}: {
  compact: boolean
  items: NavigationItem[]
  onNavigate: () => void
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <NavLink
          aria-label={item.label}
          className={({ isActive }) =>
            `group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            } ${compact ? 'justify-center' : ''}`
          }
          key={item.path}
          onClick={onNavigate}
          to={item.path}
        >
          <span className="shrink-0">{item.icon}</span>
          {!compact && <span className="whitespace-normal leading-5">{item.label}</span>}
          {compact && (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden w-80 -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 shadow-lg group-hover:block group-focus-visible:block">
              {item.label}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  )
}

export default function AppShell({ onLogout, user }: AppShellProps) {
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const navigationItems = useMemo<NavigationItem[]>(() => {
    const requirements = REQUIREMENT_NAV_ITEMS.map((item) => ({
      ...item,
      icon: iconById[item.id],
    }))

    return [
      {
        icon: <LayoutDashboard size={18} />,
        id: 'inicio',
        label: 'Inicio',
        path: '/inicio',
        roles: allRoles,
      },
      ...requirements,
    ]
  }, [])

  const visibleNav = navigationItems.filter((item) => item.roles.includes(user.rol.codigo))
  const pageTitle = getPageTitle(location.pathname)

  const handleLogout = async () => {
    setLoggingOut(true)
    await onLogout()
    setLoggingOut(false)
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8F6] text-slate-700">
      <aside
        className={`relative hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 md:flex ${
          expanded ? 'w-96' : 'w-16'
        }`}
      >
        <div
          className={`flex h-16 items-center gap-3 border-b border-slate-100 px-3 ${expanded ? '' : 'justify-center'}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Bus size={18} />
          </div>
          {expanded && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">SGMV</p>
              <p className="text-xs text-slate-400">Mantenimiento vehicular</p>
            </div>
          )}
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto p-2">
          <NavigationList
            compact={!expanded}
            items={visibleNav}
            onNavigate={() => setMobileOpen(false)}
          />
        </nav>

        <div className="border-t border-slate-100 p-2">
          <div
            className={`mb-2 flex items-center gap-2 rounded-lg px-2 py-2 ${expanded ? '' : 'justify-center'}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">
              {initials(user.nombre)}
            </div>
            {expanded && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">{user.nombre}</p>
                <p className="text-xs leading-5 text-slate-400">{ROLE_LABELS[user.rol.codigo]}</p>
              </div>
            )}
          </div>
          <Button
            className={`w-full ${expanded ? '' : 'px-0'}`}
            icon={<LogOut size={15} />}
            loading={loggingOut}
            onClick={handleLogout}
            variant="ghost"
          >
            {expanded && 'Cerrar sesión'}
          </Button>
          <button
            aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
            className="mt-1 flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[86vw] flex-col border-r border-slate-200 bg-white transition-transform md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
              <Bus size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">SGMV</p>
              <p className="text-xs text-slate-400">Mantenimiento vehicular</p>
            </div>
          </div>
          <button
            aria-label="Cerrar menú"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X size={17} />
          </button>
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto p-3">
          <NavigationList
            compact={false}
            items={visibleNav}
            onNavigate={() => setMobileOpen(false)}
          />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <button
            aria-label="Abrir menú"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold leading-5 text-slate-900 md:text-base">
              {pageTitle}
            </h1>
            <p className="hidden text-xs text-slate-400 sm:block">{formatDateTime()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Buscar"
              className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:inline-flex"
              type="button"
            >
              <Search size={17} />
            </button>
            <button
              aria-label="Notificaciones"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              type="button"
            >
              <Bell size={17} />
            </button>
          </div>
        </header>

        <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>

        <footer className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-400">
          Prototipo académico — Datos simulados
        </footer>
      </div>
    </div>
  )
}
