import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'

import AppShell from './components/layout/AppShell'
import AccessDeniedPage from './features/auth/AccessDeniedPage'
import LoginPage from './features/auth/LoginPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import { useSession } from './features/auth/session.context'
import { SessionProvider } from './features/auth/session'
import DashboardPage from './features/dashboard/DashboardPage'
import BusFormPage from './features/flota/BusFormPage'
import FleetCatalogPage from './features/flota/FleetCatalogPage'
import FleetPage from './features/flota/FleetPage'
import HistoryReportsPage from './features/historial/HistoryReportsPage'
import JourneyPage from './features/jornadas/JourneyPage'
import NoveltyPage from './features/novedades/NoveltyPage'
import WorkOrderPage from './features/ordenes-trabajo/WorkOrderPage'
import PreventivePage from './features/preventivo/PreventivePage'
import SparePartsPage from './features/repuestos/SparePartsPage'

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
        <Route element={<DashboardPage />} path="/inicio" />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR']}>
              <FleetCatalogPage />
            </ProtectedRoute>
          }
          path="/flota/catalogos"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR']}>
              <FleetPage />
            </ProtectedRoute>
          }
          path="/flota"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR']}>
              <JourneyPage />
            </ProtectedRoute>
          }
          path="/jornadas"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <BusFormPage />
            </ProtectedRoute>
          }
          path="/flota/nuevo"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <BusFormPage />
            </ProtectedRoute>
          }
          path="/flota/:busId/editar"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR']}>
              <NoveltyPage />
            </ProtectedRoute>
          }
          path="/novedades"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <PreventivePage />
            </ProtectedRoute>
          }
          path="/mantenimiento-preventivo"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'MECANICO']}>
              <WorkOrderPage />
            </ProtectedRoute>
          }
          path="/ordenes-trabajo"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <SparePartsPage />
            </ProtectedRoute>
          }
          path="/repuestos"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR']}>
              <HistoryReportsPage />
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
