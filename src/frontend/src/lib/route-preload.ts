const loadedRoutes = new Set<string>()

const loaders: Record<string, () => Promise<unknown>> = {
  '/alertas': () => import('../features/alertas/AlertsPage'),
  '/mi-cuenta': () => import('../features/auth/AccountSecurityPage'),
  '/flota': () => import('../features/flota/FleetPage'),
  '/historial': () => import('../features/historial/HistoryReportsPage'),
  '/inicio': () => import('../features/dashboard/DashboardPage'),
  '/jornadas': () => import('../features/jornadas/JourneyPage'),
  '/mantenimiento-preventivo': () => import('../features/preventivo/PreventivePage'),
  '/novedades': () => import('../features/novedades/NoveltyPage'),
  '/ordenes-trabajo': () => import('../features/ordenes-trabajo/WorkOrderPage'),
  '/ordenes-trabajo/despacho': () => import('../features/ordenes-trabajo/DispatchWorkOrdersPage'),
  '/repuestos': () => import('../features/repuestos/SparePartsPage'),
  '/usuarios': () => import('../features/usuarios/UserManagementPage'),
}

export function preloadRoute(path: string) {
  if (loadedRoutes.has(path)) return

  const load = loaders[path]
  if (!load) return

  loadedRoutes.add(path)
  void load().catch(() => loadedRoutes.delete(path))
}
