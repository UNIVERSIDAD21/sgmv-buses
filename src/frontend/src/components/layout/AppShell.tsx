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
import { preloadRoute } from '../../lib/route-preload'
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
  id: AppRouteId | 'alertas' | 'inicio'
  label: string
  path: string
  roles: RoleCode[]
  section: 'general' | 'operacion' | 'taller' | 'trazabilidad'
  shortLabel: string
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
const sidebarPreferenceKey = 'sgmv:sidebar-expanded'

const shortLabelById: Record<RequirementRouteId, string> = {
  flota: 'Flota vehicular',
  historial: 'Historial e informes',
  'mantenimiento-preventivo': 'Mantenimiento preventivo',
  novedades: 'Novedades operativas',
  'ordenes-trabajo': 'Órdenes de trabajo',
  'ordenes-despacho': 'Disponibilidad técnica',
  repuestos: 'Repuestos e inventario',
}

const sectionById: Record<RequirementRouteId, NavigationItem['section']> = {
  flota: 'operacion',
  historial: 'trazabilidad',
  'mantenimiento-preventivo': 'taller',
  novedades: 'operacion',
  'ordenes-trabajo': 'taller',
  'ordenes-despacho': 'operacion',
  repuestos: 'taller',
}

const sectionLabels: Record<NavigationItem['section'], string> = {
  general: 'General',
  operacion: 'Operación',
  taller: 'Gestión técnica',
  trazabilidad: 'Seguimiento',
}

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
  mobile = false,
  onNavigate,
}: {
  compact: boolean
  items: NavigationItem[]
  mobile?: boolean
  onNavigate: () => void
}) {
  const groups = items.reduce<Partial<Record<NavigationItem['section'], NavigationItem[]>>>(
    (result, item) => ({ ...result, [item.section]: [...(result[item.section] ?? []), item] }),
    {},
  )

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([section, groupItems]) => (
        <div key={section}>
          {!compact && (
            <p
              className={`mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ${mobile ? '' : 'hidden xl:block'}`}
            >
              {sectionLabels[section as NavigationItem['section']]}
            </p>
          )}
          <div className="space-y-0.5">
            {groupItems?.map((item) => (
              <NavLink
                aria-label={item.label}
                className={({ isActive }) =>
                  `group relative flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 shadow-[inset_3px_0_0_#047857]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  } ${compact || !mobile ? 'md:justify-center xl:justify-start' : ''} ${compact ? 'xl:justify-center' : ''}`
                }
                end={item.path === '/ordenes-trabajo'}
                key={item.path}
                onClick={onNavigate}
                onFocus={() => preloadRoute(item.path)}
                onMouseEnter={() => preloadRoute(item.path)}
                to={item.path}
              >
                <span className="shrink-0" aria-hidden="true">
                  {item.icon}
                </span>
                <span
                  className={
                    mobile ? 'leading-5' : compact ? 'hidden' : 'hidden leading-5 xl:block'
                  }
                >
                  {item.shortLabel}
                </span>
                {!mobile && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden w-80 -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 shadow-lg group-hover:block group-focus-visible:block">
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AppShell({ onLogout, user }: AppShellProps) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return window.localStorage.getItem(sidebarPreferenceKey) !== 'false'
    } catch {
      return true
    }
  })
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
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshUnreadAlerts()
    }
    const initialRefresh = window.setTimeout(refreshWhenVisible, 0)
    const interval = window.setInterval(refreshWhenVisible, 60_000)
    window.addEventListener(ALERTS_UPDATED_EVENT, refreshUnreadAlerts)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(interval)
      window.removeEventListener(ALERTS_UPDATED_EVENT, refreshUnreadAlerts)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshUnreadAlerts])

  const navigationItems = useMemo<NavigationItem[]>(() => {
    const requirements = REQUIREMENT_NAV_ITEMS.map((item) => ({
      ...item,
      icon: iconById[item.id],
      section: sectionById[item.id],
      shortLabel: shortLabelById[item.id],
    }))

    return [
      {
        icon: <LayoutDashboard size={18} />,
        id: 'inicio',
        label: 'Inicio',
        path: '/inicio',
        roles: allRoles,
        section: 'general' as const,
        shortLabel: 'Inicio',
      },
      {
        icon: <ClipboardList size={18} />,
        id: 'jornadas',
        label: 'Jornadas operativas',
        path: '/jornadas',
        roles: ['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'],
        section: 'operacion' as const,
        shortLabel: 'Jornadas',
      },
      ...requirements,
      {
        icon: <Bell size={18} />,
        id: 'alertas' as const,
        label: 'Alertas internas',
        path: '/alertas',
        roles: allRoles,
        section: 'trazabilidad' as const,
        shortLabel: 'Alertas',
      },
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

  const toggleSidebar = () => {
    setExpanded((value) => {
      const next = !value
      try {
        window.localStorage.setItem(sidebarPreferenceKey, String(next))
      } catch {
        // The preference is optional; navigation remains fully usable.
      }
      return next
    })
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
        className={`relative hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 md:flex ${
          expanded ? 'w-[72px] xl:w-[248px]' : 'w-[72px]'
        }`}
      >
        <div
          className={`flex h-14 items-center gap-2.5 border-b border-slate-100 px-3 ${expanded ? 'md:justify-center xl:justify-start' : 'justify-center'}`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">
            <Bus size={18} />
          </div>
          {expanded && (
            <div className="hidden min-w-0 xl:block">
              <p className="text-sm font-semibold text-slate-900">SGMV</p>
              <p className="text-xs text-slate-600">Mantenimiento vehicular</p>
            </div>
          )}
        </div>

        <nav
          aria-label="Navegación principal"
          className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3"
        >
          <NavigationList
            compact={!expanded}
            items={visibleNav}
            onNavigate={() => setMobileOpen(false)}
          />
        </nav>

        <div className="border-t border-slate-100 p-2">
          <div
            className={`mb-1 flex items-center gap-2 rounded-lg px-1.5 py-2 ${expanded ? 'md:justify-center xl:justify-start' : 'justify-center'}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">
              {initials(user.nombre)}
            </div>
            {expanded && (
              <div className="hidden min-w-0 xl:block">
                <p className="text-xs font-semibold text-slate-800">{user.nombre}</p>
                <p className="text-xs leading-5 text-slate-600">{ROLE_LABELS[user.rol.codigo]}</p>
              </div>
            )}
          </div>
          <Button
            aria-label="Cerrar sesión"
            className={`w-full ${expanded ? 'md:px-0 xl:px-3' : 'px-0'}`}
            icon={<LogOut size={15} />}
            loading={loggingOut}
            onClick={handleLogout}
            variant="ghost"
          >
            {expanded && <span className="hidden xl:inline">Cerrar sesión</span>}
          </Button>
          <button
            aria-expanded={expanded}
            aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
            className="mt-1 hidden min-h-10 w-full items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 xl:flex"
            onClick={toggleSidebar}
            type="button"
          >
            {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {mobileOpen && (
        <aside
          aria-labelledby="menu-movil-titulo"
          aria-modal="true"
          className="fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[88vw] flex-col border-r border-slate-200 bg-white shadow-2xl md:hidden"
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
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </nav>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 md:px-5">
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
            <h1 className="truncate text-sm font-semibold leading-5 text-slate-950 md:text-base">
              {pageTitle}
            </h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">{formatDateTime()}</p>
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

        <footer className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-center text-[10px] text-slate-500">
          Prototipo académico — Datos simulados
        </footer>
      </div>
    </div>
  )
}
