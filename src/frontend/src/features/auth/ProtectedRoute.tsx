import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import type { RoleCode } from '../../domain/labels'
import StatePanel from '../../components/ui/StatePanel'
import { useSession } from './session.context'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: RoleCode[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation()
  const { status, user } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F7F8F6] p-6">
        <StatePanel
          description="Estamos recuperando la sesión activa desde el backend."
          title="Cargando sesión"
          tone="loading"
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  if (roles && !roles.includes(user.rol.codigo)) {
    return <Navigate replace to="/acceso-denegado" />
  }

  return <>{children}</>
}
