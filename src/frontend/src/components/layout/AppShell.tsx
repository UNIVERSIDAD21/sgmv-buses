import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  REQUIREMENT_NAV_ITEMS,
  ROLE_LABELS,
  type AppRouteId,
  type RequirementRouteId,
  type RoleCode,
} from '../../domain/labels'
import { formatDateTime } from '../../lib/format'
import { ALERTS_UPDATED_EVENT, getUnreadAlertCount } from '../../features/alertas/alert.api'
import Button from '../ui/Button'
import { useDialogFocus } from '../ui/useDialogFocus'
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
  'ordenes-despacho': <ClipboardList size={18} />,
  repuestos: <Package size={18} />,
}

const allRoles: RoleCode[] = ['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR']
const requirementsByPathLength = [...REQUIREMENT_NAV_ITEMS].sort(
  (left, right) => right.path.length - left.path.length,
)

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

  if (pathname.startsWith('/flota/catalogos')) {
    return 'Catalogos de operacion'
  }

  if (pathname.startsWith('/jornadas')) {
    return 'Jornadas operativas'
  }

  if (pathname.startsWith('/alertas')) {
    return 'Alertas internas'
  }

  if (pathname.includes('/editar')) {
    return 'Edición de bus'
  }

  return (
    requirementsByPathLength.find((item) => pathname.startsWith(item.path))?.label ??
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
          end={item.path === '/ordenes-trabajo'}
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
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const mobileMenuRef = useRef<HTMLElement>(null)
  const mobileMenuTitleRef = useRef<HTMLParagraphElement>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useDialogFocus(mobileOpen, mobileMenuRef, () => setMobileOpen(false), mobileMenuTitleRef)

  const refreshUnreadAlerts = useCallback(async () => {
    try {
      const response = await getUnreadAlertCount()
      setUnreadAlerts(response.count)
    } catch {
      setUnreadAlerts(0)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshUnreadAlerts(), 0)
    window.addEventListener(ALERTS_UPDATED_EVENT, refreshUnreadAlerts)
    return () => {
      window.clearTimeout(initialRefresh)
      window.removeEventListener(ALERTS_UPDATED_EVENT, refreshUnreadAlerts)
    }
  }, [location.pathname, refreshUnreadAlerts])

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
      {
        icon: <ClipboardList size={18} />,
        id: 'jornadas',
        label: 'Jornadas operativas',
        path: '/jornadas',
        roles: ['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'],
      },
      ...requirements,
    ]
  }, [])

  const visibleNav = navigationItems.filter((item) => item.roles.includes(user.rol.codigo))
  const pageTitle = getPageTitle(location.pathname)

  useEffect(() => {
    document.title = `${pageTitle} | SGMV`
    const focusMain = window.requestAnimationFrame(() => mainRef.current?.focus())
    return () => window.cancelAnimationFrame(focusMain)
  }, [location.pathname, pageTitle])

  const handleLogout = async () => {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)
    try {
      await onLogout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8F6] text-slate-700">
      <a
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white transition-transform focus:translate-y-0"
        href="#contenido-principal"
      >
        Saltar al contenido principal
      </a>
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

        <nav
          aria-label="Navegación principal"
          className="scrollbar-thin flex-1 overflow-y-auto p-2"
        >
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
            aria-label="Cerrar sesión"
            className={`w-full ${expanded ? '' : 'px-0'}`}
            icon={<LogOut size={15} />}
            loading={loggingOut}
            onClick={handleLogout}
            variant="ghost"
          >
            {expanded && 'Cerrar sesión'}
          </Button>
          <button
            aria-expanded={expanded}
            aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
            className="mt-1 flex min-h-11 w-full items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
      {mobileOpen && (
        <aside
          aria-labelledby="menu-movil-titulo"
          aria-modal="true"
          className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[86vw] flex-col border-r border-slate-200 bg-white md:hidden"
          id="menu-movil"
          ref={mobileMenuRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
                <Bus aria-hidden="true" size={18} />
              </div>
              <div>
                <p
                  className="text-sm font-semibold text-slate-900 focus:outline-none"
                  id="menu-movil-titulo"
                  ref={mobileMenuTitleRef}
                  tabIndex={-1}
                >
                  Menú principal SGMV
                </p>
                <p className="text-xs text-slate-500">Mantenimiento vehicular</p>
              </div>
            </div>
            <button
              aria-label="Cerrar menú"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
          <nav
            aria-label="Navegación principal"
            className="scrollbar-thin flex-1 overflow-y-auto p-3"
          >
            <NavigationList
              compact={false}
              items={visibleNav}
              onNavigate={() => setMobileOpen(false)}
            />
          </nav>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <button
            aria-controls="menu-movil"
            aria-expanded={mobileOpen}
            aria-label="Abrir menú"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold leading-5 text-slate-900 md:text-base">
              {pageTitle}
            </h1>
            <p className="hidden text-xs text-slate-400 sm:block">{formatDateTime()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label={
                unreadAlerts > 0
                  ? `Alertas internas, ${unreadAlerts} sin leer`
                  : 'Alertas internas, ninguna sin leer'
              }
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => navigate('/alertas')}
              type="button"
            >
              <Bell aria-hidden="true" size={17} />
              {unreadAlerts > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-5 text-white"
                >
                  {unreadAlerts > 99 ? '99+' : unreadAlerts}
                </span>
              )}
            </button>
          </div>
        </header>

        <main
          className="scrollbar-thin min-h-0 flex-1 overflow-y-auto focus:outline-none"
          id="contenido-principal"
          ref={mainRef}
          tabIndex={-1}
        >
          <Outlet />
        </main>

        <footer className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-400">
          Prototipo académico — Datos simulados
        </footer>
      </div>
    </div>
  )
}
