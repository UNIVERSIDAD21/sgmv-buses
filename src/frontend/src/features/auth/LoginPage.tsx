import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

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
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const { login, status, user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  if (user) {
    return <Navigate replace to={state?.from ?? getDefaultPathForRole()} />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (status === 'loading') {
      return
    }

    setFormError(null)

    if (!email.trim()) {
      setFormError('Ingrese correo y contraseña para continuar.')
      window.requestAnimationFrame(() => emailRef.current?.focus())
      return
    }

    if (!contrasena) {
      setFormError('Ingrese correo y contraseña para continuar.')
      window.requestAnimationFrame(() => passwordRef.current?.focus())
      return
    }

    try {
      await login({ contrasena, email })
      navigate(state?.from ?? '/inicio', { replace: true })
    } catch {
      setFormError('No fue posible iniciar sesión con esas credenciales.')
      window.requestAnimationFrame(() => errorRef.current?.focus())
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F7F4] px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(4,120,87,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_30%)]"
      />
      <section className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm shadow-emerald-950/20">
            <Bus size={24} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">SGMV</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">
            Sistema de Gestión de Mantenimiento Vehicular
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/95 p-6 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
          <h2 className="text-base font-semibold text-slate-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Acceso protegido por rol con sesión segura en cookie HttpOnly.
          </p>

          <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                Correo electrónico
              </label>
              <input
                aria-describedby={formError ? 'login-error' : undefined}
                aria-invalid={Boolean(formError)}
                autoComplete="email"
                className="field-control"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@sgmv.local"
                ref={emailRef}
                required
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
                aria-describedby={formError ? 'login-error' : undefined}
                aria-invalid={Boolean(formError)}
                autoComplete="current-password"
                className="field-control"
                id="contrasena"
                onChange={(event) => setContrasena(event.target.value)}
                placeholder="Ingrese su contraseña"
                ref={passwordRef}
                required
                type="password"
                value={contrasena}
              />
            </div>

            {formError && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 focus:outline-none"
                id="login-error"
                ref={errorRef}
                role="alert"
                tabIndex={-1}
              >
                {formError}
              </div>
            )}

            <Button className="w-full" loading={status === 'loading'} size="lg" type="submit">
              Ingresar
            </Button>
            <div className="border-t border-slate-100 pt-4 text-center">
              <Link
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                to="/activar-cuenta"
              >
                Activar una cuenta creada por el Administrador
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-slate-600">
          Prototipo académico — Datos simulados
        </p>
      </section>
    </main>
  )
}
