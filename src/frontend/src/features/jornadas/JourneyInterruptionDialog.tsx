import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import { useSession } from '../auth/session.context'
import {
  interruptJourney,
  markJourneyReadingUnrecoverable,
  reconcileJourneyReading,
} from './journey.api'
import type { JourneyDto } from './journey.types'

type Action = 'interrupt' | 'reconcile' | 'unrecoverable'

function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export default function JourneyInterruptionDialog({
  action,
  journey,
  onClose,
  onCompleted,
}: {
  action: Action
  journey: JourneyDto
  onClose: () => void
  onCompleted: (message: string) => Promise<void>
}) {
  const { user } = useSession()
  const [fechaEvento, setFechaEvento] = useState(localDateTime(new Date()))
  const [motivo, setMotivo] = useState('')
  const [mode, setMode] = useState<'reading' | 'missing'>('missing')
  const [kilometraje, setKilometraje] = useState('')
  const [observer, setObserver] = useState<'self' | 'driver' | ''>('')
  const [backupReason, setBackupReason] = useState('')
  const [declaration, setDeclaration] = useState('')
  const [confirmedAtInterruption, setConfirmedAtInterruption] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const needsReading = action === 'reconcile' || (action === 'interrupt' && mode === 'reading')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    const mileage = Number(kilometraje)
    if (
      needsReading &&
      (!kilometraje.trim() || !Number.isSafeInteger(mileage) || mileage < 0 || !observer)
    ) {
      setError('Indique una lectura entera y quién observó físicamente el odómetro.')
      return
    }
    if (needsReading && observer === 'driver' && backupReason.trim().length < 3) {
      setError('Indique por qué se transcribe la lectura del Conductor.')
      return
    }
    if (action === 'interrupt' && motivo.trim().length < 10) {
      setError('Describa el motivo de la interrupción con al menos 10 caracteres.')
      return
    }
    if (action === 'interrupt' && mode === 'missing' && declaration.trim().length < 3) {
      setError('Explique por qué no existe una lectura final física.')
      return
    }
    if (action === 'reconcile' && declaration.trim().length < 20) {
      setError('Declare cómo se constató la lectura al momento exacto de la interrupción.')
      return
    }
    if (action === 'reconcile' && !confirmedAtInterruption) {
      setError('Confirme que el valor fue observado físicamente al interrumpir, no después.')
      return
    }
    if (action === 'unrecoverable' && motivo.trim().length < 10) {
      setError('Explique por qué el dato final ya no puede recuperarse.')
      return
    }
    const provenance = needsReading
      ? {
          observadoPorId: observer === 'self' ? user!.id : journey.conductor.id,
          ...(observer === 'driver' ? { motivoRespaldo: backupReason.trim() } : {}),
        }
      : undefined
    setSubmitting(true)
    try {
      if (action === 'interrupt') {
        await interruptJourney(journey.id, {
          fechaEvento: new Date(fechaEvento).toISOString(),
          motivo: motivo.trim(),
          ...(mode === 'reading'
            ? { kilometrajeFinal: mileage, ...provenance }
            : { motivoSinLectura: declaration.trim() }),
        })
        await onCompleted(
          'Jornada interrumpida. El Conductor quedó liberado; el bus requiere revisión de disponibilidad.',
        )
      } else if (action === 'reconcile') {
        await reconcileJourneyReading(journey.id, {
          kilometraje: mileage,
          observadoPorId: provenance!.observadoPorId,
          ...(provenance!.motivoRespaldo ? { motivoRespaldo: provenance!.motivoRespaldo } : {}),
          declaracionObservacion: declaration.trim(),
          confirmadaEnInterrupcion: true,
        })
        await onCompleted('Lectura física final conciliada con la jornada interrumpida.')
      } else {
        await markJourneyReadingUnrecoverable(journey.id, motivo.trim())
        await onCompleted('Dato final declarado no recuperable sin crear kilometraje ficticio.')
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo completar la operación')
    } finally {
      setSubmitting(false)
    }
  }

  const title = {
    interrupt: 'Interrumpir jornada',
    reconcile: 'Conciliar lectura final observada',
    unrecoverable: 'Declarar lectura no recuperable',
  }[action]
  return (
    <Modal
      onClose={onClose}
      title={title}
      subtitle={`${journey.bus.codigoInterno} · ${journey.conductor.nombre}`}
    >
      <form className="space-y-4 p-5" onSubmit={submit}>
        {action === 'interrupt' && (
          <>
            <p className="text-sm text-slate-700">
              El tramo dejará de operar a la hora real indicada. El Conductor queda libre para otra
              jornada, pero el bus no se habilita automáticamente.
            </p>
            <label className="block text-sm font-medium text-slate-700">
              Momento real de interrupción
              <input
                className="field-control"
                type="datetime-local"
                value={fechaEvento}
                max={localDateTime(new Date())}
                min={journey.inicioReal ? localDateTime(new Date(journey.inicioReal)) : undefined}
                onChange={(event) => setFechaEvento(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Motivo operacional
              <textarea
                className="field-control min-h-20"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                required
              />
            </label>
            <fieldset className="space-y-2 text-sm text-slate-700">
              <legend className="font-medium">Lectura final física</legend>
              <label className="flex items-center gap-2">
                <input
                  checked={mode === 'reading'}
                  type="radio"
                  onChange={() => setMode('reading')}
                />{' '}
                Sí, se observó al interrumpir
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={mode === 'missing'}
                  type="radio"
                  onChange={() => setMode('missing')}
                />{' '}
                No fue posible obtenerla
              </label>
            </fieldset>
          </>
        )}
        {action === 'reconcile' && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Solo use esta opción si la lectura fue observada físicamente al interrumpir el tramo.
            Una lectura tomada después en taller debe registrarse con su fecha real allí; no se
            copia retrospectivamente como final.
          </p>
        )}
        {needsReading && (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Kilometraje observado
              <input
                className="field-control"
                type="number"
                min={journey.lecturaInicial?.kilometraje ?? 0}
                step="1"
                value={kilometraje}
                onChange={(event) => setKilometraje(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              ¿Quién observó el odómetro?
              <select
                className="field-control"
                value={observer}
                onChange={(event) => setObserver(event.target.value as typeof observer)}
                required
              >
                <option value="">Seleccione</option>
                <option value="self">Yo lo observé</option>
                <option value="driver">El Conductor me comunicó la lectura</option>
              </select>
            </label>
            {observer === 'driver' && (
              <label className="block text-sm font-medium text-slate-700">
                Motivo de transcripción
                <textarea
                  className="field-control min-h-20"
                  value={backupReason}
                  onChange={(event) => setBackupReason(event.target.value)}
                  required
                />
              </label>
            )}
          </>
        )}
        {action === 'interrupt' && mode === 'missing' && (
          <label className="block text-sm font-medium text-slate-700">
            Por qué falta la lectura
            <textarea
              className="field-control min-h-20"
              value={declaration}
              onChange={(event) => setDeclaration(event.target.value)}
              required
            />
          </label>
        )}
        {action === 'reconcile' && (
          <label className="block text-sm font-medium text-slate-700">
            Declaración de observación al interrumpir
            <textarea
              className="field-control min-h-20"
              value={declaration}
              onChange={(event) => setDeclaration(event.target.value)}
              required
            />
          </label>
        )}
        {action === 'reconcile' && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmedAtInterruption}
              onChange={(event) => setConfirmedAtInterruption(event.target.checked)}
              required
            />
            <span>
              Confirmo que este valor fue observado físicamente al momento exacto de la
              interrupción. No corresponde a una lectura posterior de taller.
            </span>
          </label>
        )}
        {action === 'unrecoverable' && (
          <>
            <p className="text-sm text-slate-700">
              Esta decisión administrativa cierra solo la conciliación del dato. No crea kilómetros
              ni cambia la disponibilidad del bus.
            </p>
            <label className="block text-sm font-medium text-slate-700">
              Motivo de no recuperación
              <textarea
                className="field-control min-h-20"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                required
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" loading={submitting}>
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
