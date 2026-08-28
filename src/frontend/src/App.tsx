import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'

import AppShell from './components/layout/AppShell'
import AccessDeniedPage from './features/auth/AccessDeniedPage'
import LoginPage from './features/auth/LoginPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import { useSession } from './features/auth/session.context'
import { SessionProvider } from './features/auth/session'
import DashboardPage from './features/dashboard/DashboardPage'
import BusFormPage from './features/flota/BusFormPage'
import FleetPage from './features/flota/FleetPage'
import PendingModulePage from './features/modules/PendingModulePage'
import NoveltyPage from './features/novedades/NoveltyPage'
import PreventivePage from './features/preventivo/PreventivePage'

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
            <ProtectedRoute roles={['ADMINISTRADOR', 'CONDUCTOR']}>
              <FleetPage />
            </ProtectedRoute>
          }
          path="/flota"
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
            <ProtectedRoute roles={['ADMINISTRADOR', 'CONDUCTOR']}>
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
              <PendingModulePage moduleId="ordenes-trabajo" />
            </ProtectedRoute>
          }
          path="/ordenes-trabajo"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'MECANICO']}>
              <PendingModulePage moduleId="repuestos" />
            </ProtectedRoute>
          }
          path="/repuestos"
        />
        <Route
          element={
            <ProtectedRoute roles={['ADMINISTRADOR', 'MECANICO', 'CONDUCTOR']}>
              <PendingModulePage moduleId="historial" />
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
