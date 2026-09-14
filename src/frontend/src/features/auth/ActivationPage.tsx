import { useState } from 'react'
import { Link } from 'react-router-dom'

import Button from '../../components/ui/Button'
import { Bus, CheckCircle } from '../../components/ui/Icons'
import { ApiError } from '../../lib/api'
import { activateAccount } from '../usuarios/user.api'

function validPassword(value: string) {
  return (
    value.length >= 12 &&
    value.length <= 72 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  )
}

export default function ActivationPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activated, setActivated] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!/^[A-Za-z0-9_-]{43}$/.test(token.trim())) {
      setError('Ingrese el código temporal completo.')
      return
    }
    if (!validPassword(password)) {
      setError('La contraseña no cumple los requisitos de seguridad.')
      return
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      await activateAccount({ contrasena: password, token: token.trim() })
      setActivated(true)
      setPassword('')
      setConfirmation('')
      setToken('')
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'No fue posible activar la cuenta en este momento.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F7F4] px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(4,120,87,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_30%)]"
      />
      <section className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm shadow-emerald-950/20">
            <Bus size={24} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Activar cuenta SGMV</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
            Solo puede activar una cuenta creada previamente por un Administrador.
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/95 p-6 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
          {activated ? (
            <div className="text-center" role="status">
              <CheckCircle className="mx-auto text-emerald-700" size={42} />
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Cuenta activada</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Su contraseña quedó protegida y ya puede iniciar sesión normalmente.
              </p>
              <Link
                className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
                to="/login"
              >
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form className="space-y-4" noValidate onSubmit={submit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="token">
                  Código temporal de activación
                </label>
                <input
                  autoComplete="one-time-code"
                  className="field-control font-mono"
                  id="token"
                  onChange={(event) => setToken(event.target.value)}
                  required
                  type="password"
                  value={token}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                  htmlFor="password"
                >
                  Nueva contraseña
                </label>
                <input
                  autoComplete="new-password"
                  className="field-control"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                  htmlFor="confirmation"
                >
                  Confirmar contraseña
                </label>
                <input
                  autoComplete="new-password"
                  className="field-control"
                  id="confirmation"
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </div>
              <p className="text-xs leading-5 text-slate-600">
                Use entre 12 y 72 caracteres con mayúscula, minúscula, número y símbolo.
              </p>
              {error && (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <Button className="w-full" loading={submitting} size="lg" type="submit">
                Establecer contraseña y activar
              </Button>
            </form>
          )}
        </div>

        {!activated && (
          <p className="mt-5 text-center text-sm text-slate-600">
            ¿Ya activó su cuenta?{' '}
            <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/login">
              Iniciar sesión
            </Link>
          </p>
        )}
      </section>
    </main>
  )
}
