import { useState, type FormEvent } from 'react'

import Button from '../../components/ui/Button'
import { BUS_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import {
  confirmJourneyPeriod,
  createJourney,
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

function bogotaDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00-05:00`).toISOString()
}

function nextDate(date: string) {
  const following = new Date(`${date}T00:00:00.000Z`)
  following.setUTCDate(following.getUTCDate() + 1)
  return following.toISOString().slice(0, 10)
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof ApiError ? cause.message : fallback
}

export default function JourneyScheduleForm({
  onCreated,
  options,
}: {
  onCreated: (count: number) => Promise<void>
  options: JourneyOptionsResponse
}) {
  const [frequency, setFrequency] = useState<'single' | 'period'>('single')
  const [busId, setBusId] = useState('')
  const [conductorId, setConductorId] = useState('')
  const [rutaId, setRutaId] = useState('')
  const [fecha, setFecha] = useState(bogotaDate(1))
  const [fechaInicio, setFechaInicio] = useState(bogotaDate(1))
  const [fechaFin, setFechaFin] = useState(bogotaDate(7))
  const [diasSemana, setDiasSemana] = useState([1, 2, 3, 4, 5])
  const [horaInicio, setHoraInicio] = useState('06:00')
  const [horaFin, setHoraFin] = useState('14:00')
  const [simulate, setSimulate] = useState(false)
  const [cycles, setCycles] = useState('6')
  const [nonCommercial, setNonCommercial] = useState('8')
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [review, setReview] = useState<{
    input: JourneyPeriodInput
    preview: JourneyPeriodPreview
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedRoute = options.rutas.find((route) => route.id === Number(rutaId))
  const selectedBus = options.buses.find((bus) => bus.id === Number(busId))
  const cyclesNumber = Number(cycles)
  const nonCommercialNumber = Number(nonCommercial)
  const projectedKm =
    (selectedRoute?.longitudKmOficial ?? 0) * (Number.isFinite(cyclesNumber) ? cyclesNumber : 0) +
    (Number.isFinite(nonCommercialNumber) ? nonCommercialNumber : 0)

  function invalidate() {
    setReview(null)
    setError(null)
    setRequestKey(crypto.randomUUID())
  }

  function getPeriodInput(): JourneyPeriodInput {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)
    setReview(null)
    if (!busId || !conductorId) {
      setError('Seleccione bus y conductor.')
      return
    }
    if (frequency === 'period' && !diasSemana.length) {
      setError('Seleccione al menos un día de la semana.')
      return
    }
    if (
      frequency === 'single' &&
      simulate &&
      (!Number.isInteger(cyclesNumber) ||
        cyclesNumber < 1 ||
        cyclesNumber > 100 ||
        !Number.isFinite(nonCommercialNumber) ||
        nonCommercialNumber < 0 ||
        nonCommercialNumber > 1000)
    ) {
      setError('Ingrese entre 1 y 100 ciclos y entre 0 y 1.000 km no comerciales.')
      return
    }
    setBusy(true)
    try {
      if (frequency === 'single') {
        await createJourney({
          busId: Number(busId),
          conductorId: Number(conductorId),
          inicioProgramado: bogotaDateTime(fecha, horaInicio),
          finProgramado: bogotaDateTime(horaFin <= horaInicio ? nextDate(fecha) : fecha, horaFin),
          ...(rutaId ? { rutaId: Number(rutaId) } : {}),
          ...(simulate && selectedRoute?.longitudKmOficial
            ? {
                simulacion: {
                  ciclosCompletosSimulados: cyclesNumber,
                  kmNoComercialesSimulados: nonCommercialNumber,
                },
              }
            : {}),
        })
        setBusId('')
        setConductorId('')
        setRutaId('')
        await onCreated(1)
      } else {
        const input = getPeriodInput()
        const preview = await previewJourneyPeriod(input)
        setReview({ input, preview })
      }
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo programar la jornada.'))
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
      setError(errorMessage(cause, 'No se pudo confirmar la programación.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="surface overflow-hidden" onSubmit={handleSubmit}>
      <div className="border-b border-slate-100 px-4 py-3.5 md:px-5">
        <h3 className="text-base font-semibold text-slate-950">Programar jornada</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Elige una fecha o varios días. Horarios de Bogotá; la disponibilidad se valida al
          confirmar la salida.
        </p>
      </div>
      <div className="space-y-4 p-4 md:p-5">
        <label className="field-label max-w-xs">
          Frecuencia
          <select
            aria-label="Frecuencia"
            className="field-control"
            value={frequency}
            onChange={(event) => {
              setFrequency(event.target.value as 'single' | 'period')
              invalidate()
            }}
          >
            <option value="single">Un solo día</option>
            <option value="period">Varios días</option>
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="field-label">
            Bus
            <select
              aria-label="Bus de jornada"
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
                <option
                  key={bus.id}
                  value={bus.id}
                  disabled={
                    frequency === 'single' && bus.disponibilidadTecnica?.disponible === false
                  }
                >
                  {bus.codigoInterno} · {bus.placa}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Conductor
            <select
              aria-label="Conductor de jornada"
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
              aria-label="Ruta de jornada"
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
          {frequency === 'single' ? (
            <label className="field-label">
              Fecha
              <input
                aria-label="Fecha de jornada"
                className="field-control"
                type="date"
                required
                value={fecha}
                onChange={(event) => {
                  setFecha(event.target.value)
                  invalidate()
                }}
              />
            </label>
          ) : (
            <>
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
            </>
          )}
          <label className="field-label">
            Hora de salida
            <input
              aria-label="Hora de salida"
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
              aria-label="Hora de llegada"
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
        {selectedBus && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold">Bus: </span>
            {BUS_STATUS_LABELS[selectedBus.estadoOperativo]} ·{' '}
            {selectedBus.disponibilidadTecnica?.disponible === false
              ? 'Disponibilidad restringida'
              : 'Disponible'}{' '}
            · {formatNumber(selectedBus.kilometrajeActual)} km
            {selectedBus.mantenimientos?.[0] && (
              <span> · Próximo preventivo: {selectedBus.mantenimientos[0].estado}</span>
            )}
            {selectedBus.disponibilidadTecnica?.causas.map((cause) => (
              <p className="text-xs text-amber-700" key={`${cause.codigo}-${cause.origenId}`}>
                {cause.mensaje}
              </p>
            ))}
          </div>
        )}
        {frequency === 'period' && (
          <fieldset>
            <legend className="field-label">Días de la semana</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {weekdays.map((day) => (
                <label
                  key={day.number}
                  className="flex items-center gap-1.5 text-sm text-slate-700"
                >
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
        )}
        {frequency === 'single' && selectedRoute?.longitudKmOficial && (
          <fieldset className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 text-sm text-slate-700">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-cyan-800">
              Ruta y proyección
            </legend>
            <p>
              {formatNumber(selectedRoute.longitudKmOficial)} km oficiales ·{' '}
              {selectedRoute.operador} · semántica no determinada
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={simulate}
                onChange={(event) => setSimulate(event.target.checked)}
              />
              Usar proyección simulada SGMV
            </label>
            {simulate && (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="field-label">
                  Ciclos completos simulados
                  <input
                    aria-label="Ciclos completos simulados"
                    className="field-control"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={cycles}
                    onChange={(event) => setCycles(event.target.value)}
                    required
                  />
                </label>
                <label className="field-label">
                  Km no comerciales simulados
                  <input
                    aria-label="Km no comerciales simulados"
                    className="field-control"
                    type="number"
                    min="0"
                    max="1000"
                    step="0.001"
                    value={nonCommercial}
                    onChange={(event) => setNonCommercial(event.target.value)}
                    onBlur={() => {
                      if (!nonCommercial.trim()) setNonCommercial('0')
                    }}
                    required
                  />
                </label>
                <p className="sm:col-span-2">
                  Jornada proyectada: {formatNumber(projectedKm)} km
                  {selectedBus
                    ? ` · Cierre estimado: ${formatNumber(selectedBus.kilometrajeActual + projectedKm)} km`
                    : ''}
                  . No cambia el odómetro.
                </p>
              </div>
            )}
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        {!review && (
          <div className="flex justify-end">
            <Button disabled={busy} type="submit">
              Programar jornada
            </Button>
          </div>
        )}
        {review && (
          <section
            aria-label="Confirmar programación"
            className="space-y-3 rounded-xl border border-slate-200 p-3"
          >
            <p className="text-sm font-semibold text-slate-900">
              {review.preview.total} jornadas propuestas · {review.preview.aptas} sin conflictos
            </p>
            <p className="text-sm text-slate-700">
              {selectedBus?.codigoInterno} ·{' '}
              {options.conductores.find((driver) => driver.id === review.input.conductorId)?.nombre}{' '}
              · {selectedRoute?.nombre ?? 'Sin ruta'} · {review.input.horaInicio}–
              {review.input.horaFin}
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
                  –
                  {new Date(journey.finProgramado).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Bogota',
                  })}{' '}
                  · {journey.conflictos.length ? 'Conflicto' : 'Disponible'}
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
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReview(null)}>
                Volver
              </Button>
              <Button
                disabled={busy || !review.preview.puedeConfirmar}
                onClick={confirm}
                type="button"
              >
                Confirmar programación
              </Button>
            </div>
          </section>
        )}
      </div>
    </form>
  )
}
