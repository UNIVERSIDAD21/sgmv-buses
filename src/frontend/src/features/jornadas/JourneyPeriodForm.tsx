import { useState, type FormEvent } from 'react'

import Button from '../../components/ui/Button'
import { ApiError } from '../../lib/api'
import {
  confirmJourneyPeriod,
  previewJourneyPeriod,
  type JourneyPeriodInput,
  type JourneyPeriodPreview,
} from './journey.api'
import type { JourneyOptionsResponse } from './journey.types'

const weekdays = [
  { number: 1, name: 'Lun' },
  { number: 2, name: 'Mar' },
  { number: 3, name: 'Mié' },
  { number: 4, name: 'Jue' },
  { number: 5, name: 'Vie' },
  { number: 6, name: 'Sáb' },
  { number: 7, name: 'Dom' },
]

function bogotaDate(daysAhead: number) {
  return new Intl.DateTimeFormat('sv-SE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Bogota',
    year: 'numeric',
  }).format(new Date(Date.now() + daysAhead * 86_400_000))
}

export default function JourneyPeriodForm({
  onCreated,
  options,
}: {
  onCreated: (count: number) => Promise<void>
  options: JourneyOptionsResponse
}) {
  const [busId, setBusId] = useState('')
  const [conductorId, setConductorId] = useState('')
  const [rutaId, setRutaId] = useState('')
  const [fechaInicio, setFechaInicio] = useState(bogotaDate(1))
  const [fechaFin, setFechaFin] = useState(bogotaDate(7))
  const [diasSemana, setDiasSemana] = useState([1, 2, 3, 4, 5])
  const [horaInicio, setHoraInicio] = useState('06:00')
  const [horaFin, setHoraFin] = useState('14:00')
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [review, setReview] = useState<{
    input: JourneyPeriodInput
    preview: JourneyPeriodPreview
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function invalidate() {
    setReview(null)
    setError(null)
    setRequestKey(crypto.randomUUID())
  }

  function getInput(): JourneyPeriodInput {
    return {
      busId: Number(busId),
      conductorId: Number(conductorId),
      ...(rutaId ? { rutaId: Number(rutaId) } : {}),
      fechaInicio,
      fechaFin,
      diasSemana,
      horaInicio,
      horaFin,
      claveIdempotencia: requestKey,
    }
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)
    setReview(null)
    if (!busId || !conductorId || !diasSemana.length) {
      setError('Seleccione bus, conductor y al menos un día de la semana.')
      return
    }
    setBusy(true)
    try {
      const input = getInput()
      const result = await previewJourneyPeriod(input)
      setReview({ input, preview: result })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo previsualizar el período.')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!review?.preview.puedeConfirmar || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await confirmJourneyPeriod(review.input)
      setReview(null)
      setRequestKey(crypto.randomUUID())
      await onCreated(result.creadas)
    } catch (cause) {
      setReview(null)
      setError(cause instanceof ApiError ? cause.message : 'No se pudo confirmar el período.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="surface overflow-hidden" onSubmit={preview}>
      <div className="border-b border-slate-100 px-4 py-3.5 md:px-5">
        <h3 className="text-base font-semibold text-slate-950">Programar período</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Se crearán jornadas independientes. El bus propuesto puede sustituirse en un solo día y su
          disponibilidad se comprobará de nuevo al confirmar la salida. Horario de Bogotá.
        </p>
      </div>
      <div className="space-y-4 p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="field-label">
            Bus propuesto
            <select
              aria-label="Bus del período"
              className="field-control"
              required
              value={busId}
              onChange={(event) => {
                setBusId(event.target.value)
                invalidate()
              }}
            >
              <option value="">Seleccione bus</option>
              {options.buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.codigoInterno} · {bus.placa}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Conductor
            <select
              aria-label="Conductor del período"
              className="field-control"
              required
              value={conductorId}
              onChange={(event) => {
                setConductorId(event.target.value)
                invalidate()
              }}
            >
              <option value="">Seleccione conductor</option>
              {options.conductores.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Ruta contextual
            <select
              aria-label="Ruta del período"
              className="field-control"
              value={rutaId}
              onChange={(event) => {
                setRutaId(event.target.value)
                invalidate()
              }}
            >
              <option value="">Sin ruta</option>
              {options.rutas.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.codigo} · {route.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Desde
            <input
              aria-label="Inicio del período"
              className="field-control"
              type="date"
              required
              value={fechaInicio}
              onChange={(event) => {
                setFechaInicio(event.target.value)
                invalidate()
              }}
            />
          </label>
          <label className="field-label">
            Hasta
            <input
              aria-label="Fin del período"
              className="field-control"
              type="date"
              required
              value={fechaFin}
              onChange={(event) => {
                setFechaFin(event.target.value)
                invalidate()
              }}
            />
          </label>
          <label className="field-label">
            Hora de salida
            <input
              aria-label="Hora de salida del período"
              className="field-control"
              type="time"
              required
              value={horaInicio}
              onChange={(event) => {
                setHoraInicio(event.target.value)
                invalidate()
              }}
            />
          </label>
          <label className="field-label">
            Hora de llegada
            <input
              aria-label="Hora de llegada del período"
              className="field-control"
              type="time"
              required
              value={horaFin}
              onChange={(event) => {
                setHoraFin(event.target.value)
                invalidate()
              }}
            />
          </label>
        </div>
        <fieldset>
          <legend className="field-label">Días de la semana</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {weekdays.map((day) => (
              <label key={day.number} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={diasSemana.includes(day.number)}
                  aria-label={day.name}
                  onChange={(event) => {
                    setDiasSemana((current) =>
                      event.target.checked
                        ? [...current, day.number].sort((left, right) => left - right)
                        : current.filter((number) => number !== day.number),
                    )
                    invalidate()
                  }}
                />
                {day.name}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit" variant="outline">
          Previsualizar período
        </Button>
        {review && (
          <section
            aria-label="Previsualización del período"
            className="space-y-3 rounded-xl border border-slate-200 p-3"
          >
            <p className="text-sm font-semibold text-slate-900">
              {review.preview.total} jornadas propuestas · {review.preview.aptas} sin conflictos
            </p>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm">
              {review.preview.jornadas.map((journey) => (
                <li key={journey.fecha} className="rounded-lg bg-slate-50 px-3 py-2">
                  <strong>{journey.fecha}</strong> ·{' '}
                  {new Date(journey.inicioProgramado).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Bogota',
                  })}
                  {'–'}
                  {new Date(journey.finProgramado).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Bogota',
                  })}
                  {journey.conflictos.length > 0 && (
                    <ul className="mt-1 text-rose-700">
                      {journey.conflictos.map((conflict, index) => (
                        <li key={`${conflict.codigo}-${index}`}>{conflict.mensaje}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <Button
              disabled={busy || !review.preview.puedeConfirmar}
              onClick={confirm}
              type="button"
            >
              Confirmar {review.preview.total} jornadas
            </Button>
          </section>
        )}
      </div>
    </form>
  )
}
