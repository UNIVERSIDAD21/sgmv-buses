import { useState } from 'react'

import Button from '../../components/ui/Button'
import PageHeader from '../../components/ui/PageHeader'
import { ApiError } from '../../lib/api'
import { changeOwnPassword } from '../usuarios/user.api'

export default function AccountSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword !== confirmation) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      await changeOwnPassword({
        contrasenaActual: currentPassword,
        contrasenaNueva: newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setSuccess('Contraseña actualizada de forma segura.')
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'No fue posible actualizar la contraseña.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <PageHeader
        description="Actualice su contraseña sin modificar el rol ni el estado de su cuenta."
        eyebrow="Seguridad personal"
        title="Mi cuenta"
      />
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-base font-semibold text-slate-900">Cambiar contraseña</h2>
        <form className="mt-5 max-w-lg space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="actual">
              Contraseña actual
            </label>
            <input
              autoComplete="current-password"
              className="field-control"
              id="actual"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="nueva">
              Nueva contraseña
            </label>
            <input
              autoComplete="new-password"
              className="field-control"
              id="nueva"
              minLength={12}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="confirmar-nueva"
            >
              Confirmar nueva contraseña
            </label>
            <input
              autoComplete="new-password"
              className="field-control"
              id="confirmar-nueva"
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          </div>
          <p className="text-xs leading-5 text-slate-600">
            Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.
          </p>
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-700" role="status">
              {success}
            </p>
          )}
          <Button loading={submitting} type="submit">
            Actualizar contraseña
          </Button>
        </form>
      </section>
    </div>
  )
}
