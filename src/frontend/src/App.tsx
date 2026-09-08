import { lazy } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'

import AppShell from './components/layout/AppShell'
import { LazyRoute } from './components/routing/RouteBoundary'
import AccessDeniedPage from './features/auth/AccessDeniedPage'
import LoginPage from './features/auth/LoginPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import { useSession } from './features/auth/session.context'
import { SessionProvider } from './features/auth/session'

const AlertsPage = lazy(() => import('./features/alertas/AlertsPage'))
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const BusFormPage = lazy(() => import('./features/flota/BusFormPage'))
const FleetCatalogPage = lazy(() => import('./features/flota/FleetCatalogPage'))
const FleetPage = lazy(() => import('./features/flota/FleetPage'))
const HistoryReportsPage = lazy(() => import('./features/historial/HistoryReportsPage'))
const JourneyPage = lazy(() => import('./features/jornadas/JourneyPage'))
const NoveltyPage = lazy(() => import('./features/novedades/NoveltyPage'))
const DispatchWorkOrdersPage = lazy(
  () => import('./features/ordenes-trabajo/DispatchWorkOrdersPage'),
)
const WorkOrderPage = lazy(() => import('./features/ordenes-trabajo/WorkOrderPage'))
const PreventivePage = lazy(() => import('./features/preventivo/PreventivePage'))
const SparePartsPage = lazy(() => import('./features/repuestos/SparePartsPage'))

function ShellRoute() {
  const { logout, user } = useSession()

  if (!user) {
    return <Navigate replace to="/login" />
  }

  return <AppShell onLogout={logout} user={user} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <ProtectedRoute>
            <ShellRoute />
          </ProtectedRoute>
        }
      >
        <Route element={<Navigate replace to="/inicio" />} index />
        <Route
          element={
            <LazyRoute>
              <DashboardPage />
            </LazyRoute>
          }
          path="/inicio"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR']}>
              <LazyRoute>
                <AlertsPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/alertas"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR']}>
              <LazyRoute>
                <FleetCatalogPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/flota/catalogos"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR']}>
              <LazyRoute>
                <FleetPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/flota"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR']}>
              <LazyRoute>
                <JourneyPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/jornadas"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <LazyRoute>
                <BusFormPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/flota/nuevo"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <LazyRoute>
                <BusFormPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/flota/:busId/editar"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR']}>
              <LazyRoute>
                <NoveltyPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/novedades"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR']}>
              <LazyRoute>
                <PreventivePage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/mantenimiento-preventivo"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'MECANICO']}>
              <LazyRoute>
                <WorkOrderPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/ordenes-trabajo"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR']}>
              <LazyRoute>
                <DispatchWorkOrdersPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/ordenes-trabajo/despacho"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <LazyRoute>
                <SparePartsPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/repuestos"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR']}>
              <LazyRoute>
                <HistoryReportsPage />
              </LazyRoute>
            </ProtectedRoute>
          }
          path="/historial"
        />
        <Route element={<AccessDeniedPage />} path="/acceso-denegado" />
      </Route>
      <Route element={<Navigate replace to="/inicio" />} path="*" />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </Router>
  )
}

export default App
