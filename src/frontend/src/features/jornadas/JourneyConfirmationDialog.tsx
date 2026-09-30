import { useRef, useState, type FormEvent } from 'react'

import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import { formatDateTime, formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import { finishJourney, startJourney } from './journey.api'
import type { JourneyDto } from './journey.types'

function localDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export default function JourneyConfirmationDialog({
  action,
  journey,
  onClose,
  onCompleted,
}: {
  action: 'start' | 'finish'
  journey: JourneyDto
  onClose: () => void
  onCompleted: (message: string) => Promise<void>
}) {
  const { user } = useSession()
  const backup = user?.rol.codigo !== 'CONDUCTOR'
  const [observerChoice, setObserverChoice] = useState<'self' | 'driver' | ''>('')
  const [backupReason, setBackupReason] = useState('')
  const [fechaEvento, setFechaEvento] = useState(localDate(new Date()))
  const [kilometraje, setKilometraje] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const attempt = useRef<{ body: string; key: string } | null>(null)
  const title = action === 'start' ? 'Confirmar salida' : 'Confirmar llegada'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const mileage = Number(kilometraje)
    const date = new Date(fechaEvento)
    if (
      !kilometraje.trim() ||
      !Number.isSafeInteger(mileage) ||
      mileage < 0 ||
      !Number.isFinite(date.getTime())
    ) {
      setError('Registre la hora real y una lectura entera observada del odómetro.')
      return
    }
    if (
      backup &&
      (!observerChoice || (observerChoice === 'driver' && backupReason.trim().length < 3))
    ) {
      setError('Identifique quién observó el odómetro y el motivo del respaldo.')
      return
    }
    const provenance = backup
      ? {
          observadoPorId: observerChoice === 'self' ? user!.id : journey.conductor.id,
          ...(observerChoice === 'driver' ? { motivoRespaldo: backupReason.trim() } : {}),
        }
      : undefined
    const body = JSON.stringify([date.toISOString(), mileage, provenance])
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() }
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    try {
      const result = await (action === 'start' ? startJourney : finishJourney)(
        journey.id,
        date.toISOString(),
        mileage,
        attempt.current.key,
        provenance,
      )
      const initial = result.jornada.lecturaInicial
      const final = result.jornada.lecturaFinal
      const message =
        action === 'start'
          ? 'Salida confirmada con lectura real.'
          : `Llegada confirmada.${initial && final ? ` Distancia confirmada: ${formatNumber(final.kilometraje - initial.kilometraje)} km.` : ''} Las restricciones técnicas se mantienen hasta resolver su causa.`
      await onCompleted(message)
      onClose()
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No se pudo confirmar. Puede reintentar con los mismos datos.',
      )
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={() => {
        if (!inFlight.current) onClose()
      }}
      title={title}
      subtitle={`${journey.bus.codigoInterno} · ${journey.bus.placa}`}
    >
      <form className="space-y-4 p-5" onSubmit={submit}>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            {journey.ruta
              ? `${journey.ruta.codigo} · ${journey.ruta.nombre}`
              : 'Sin ruta contextual'}
          </p>
          <p>
            Horario programado: {formatDateTime(new Date(journey.inicioProgramado))} —{' '}
            {formatDateTime(new Date(journey.finProgramado))}
          </p>
          <p className="mt-2">
            {journey.lecturaReferencia
              ? `Último odómetro registrado: ${formatNumber(journey.lecturaReferencia.kilometraje)} km · ${formatDateTime(new Date(journey.lecturaReferencia.fechaLectura))}.`
              : 'No hay una lectura física fechada de referencia.'}
          </p>
          <p className="mt-1 text-xs">
            Es una referencia, no la lectura de esta confirmación. Si captura tarde, indique la hora
            real del hecho.
          </p>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Fecha y hora real de {action === 'start' ? 'salida' : 'llegada'}
          <input
            className="field-control"
            type="datetime-local"
            required
            max={localDate(new Date())}
            value={fechaEvento}
            onChange={(event) => setFechaEvento(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Lectura observada del odómetro
          <input
            className="field-control"
            type="number"
            min={journey.lecturaInicial?.kilometraje ?? 0}
            step="1"
            required
            value={kilometraje}
            onChange={(event) => setKilometraje(event.target.value)}
          />
        </label>
        <p className="text-xs text-slate-600">
          Confirme solo cuando esté detenido y pueda observar el odómetro. No use una estimación ni
          la proyección simulada.
        </p>
        {backup && (
          <>
            <label className="block text-sm font-medium text-slate-700">
              ¿Quién observó físicamente el odómetro?
              <select
                className="field-control"
                value={observerChoice}
                onChange={(event) => setObserverChoice(event.target.value as typeof observerChoice)}
                required
              >
                <option value="">Seleccione</option>
                <option value="self">Yo lo observé</option>
                <option value="driver">
                  El Conductor {journey.conductor.nombre} me comunicó la lectura
                </option>
              </select>
            </label>
            {observerChoice === 'driver' && (
              <label className="block text-sm font-medium text-slate-700">
                Motivo del respaldo
                <textarea
                  className="field-control"
                  value={backupReason}
                  onChange={(event) => setBackupReason(event.target.value)}
                  required
                />
              </label>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Confirmando…' : title}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
