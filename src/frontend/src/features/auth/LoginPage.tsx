import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { getDefaultPathForRole } from '../../domain/labels'
import Button from '../../components/ui/Button'
import { Bus } from '../../components/ui/Icons'
import { useSession } from './session.context'

interface LocationState {
  from?: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const { login, status, user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  if (user) {
    return <Navigate replace to={state?.from ?? getDefaultPathForRole()} />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!email.trim() || !contrasena) {
      setFormError('Ingrese correo y contraseña para continuar.')
      return
    }

    try {
      await login({ contrasena, email })
      navigate(state?.from ?? '/inicio', { replace: true })
    } catch {
      setFormError('No fue posible iniciar sesión con esas credenciales.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8F6] px-4 py-10">
      <section className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">
            <Bus size={24} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">SGMV</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
            Sistema de Gestión de Mantenimiento Vehicular
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Acceso protegido por rol con sesión segura en cookie HttpOnly.
          </p>

          <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                Correo electrónico
              </label>
              <input
                autoComplete="email"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors placeholder:text-slate-300 hover:border-slate-300 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@sgmv.local"
                type="email"
                value={email}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-slate-700"
                htmlFor="contrasena"
              >
                Contraseña
              </label>
              <input
                autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors placeholder:text-slate-300 hover:border-slate-300 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                id="contrasena"
                onChange={(event) => setContrasena(event.target.value)}
                placeholder="Ingrese su contraseña"
                type="password"
                value={contrasena}
              />
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <Button className="w-full" loading={status === 'loading'} size="lg" type="submit">
              Ingresar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          Prototipo académico — Datos simulados
        </p>
      </section>
    </main>
  )
}
