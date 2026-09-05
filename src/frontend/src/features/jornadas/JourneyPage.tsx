import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'
import { BUS_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import {
  cancelJourney,
  createJourney,
  finishJourney,
  getJourneyOptions,
  getMyJourney,
  listJourneys,
  reassignJourney,
  startJourney,
} from './journey.api'
import type {
  JourneyDto,
  JourneyListResponse,
  JourneyOptionsResponse,
  JourneyStatus,
  MyJourneyResponse,
} from './journey.types'

const JOURNEY_LABELS: Record<JourneyStatus, string> = {
  CANCELADA: 'Cancelada',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  PROGRAMADA: 'Programada',
  REASIGNADA: 'Reasignada',
}

const JOURNEY_TONES: Record<JourneyStatus, 'amber' | 'emerald' | 'red' | 'slate' | 'teal'> = {
  CANCELADA: 'red',
  EN_CURSO: 'teal',
  FINALIZADA: 'emerald',
  PROGRAMADA: 'amber',
  REASIGNADA: 'slate',
}

type JourneyAction = 'cancel' | 'finish' | 'reassign' | 'start'

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operacion'
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin registrar'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toLocalInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function defaultSchedule(hours: number) {
  return toLocalInput(new Date(Date.now() + hours * 60 * 60_000))
}

function toIso(value: string) {
  return new Date(value).toISOString()
}

function JourneyCard({
  journey,
  onAction,
}: {
  journey: JourneyDto
  onAction: (action: JourneyAction, journey: JourneyDto) => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {journey.bus.codigoInterno} · {journey.bus.placa}
            </h3>
            <Badge tone={JOURNEY_TONES[journey.estado]}>{JOURNEY_LABELS[journey.estado]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">Conductor: {journey.conductor.nombre}</p>
          <p className="mt-1 text-xs text-slate-500">
            {journey.ruta
              ? `${journey.ruta.codigo} · ${journey.ruta.origen} → ${journey.ruta.destino}`
              : 'Sin ruta contextual'}
          </p>
        </div>
        <Badge tone={journey.bus.estadoOperativo === 'OPERATIVO' ? 'emerald' : 'amber'}>
          {BUS_STATUS_LABELS[journey.bus.estadoOperativo]}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase text-slate-400">Horario programado</p>
          <p className="mt-1 text-slate-700">{formatDateTime(journey.inicioProgramado)}</p>
          <p className="text-slate-700">{formatDateTime(journey.finProgramado)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase text-slate-400">Odometro real</p>
          <p className="mt-1 text-slate-700">
            Inicio:{' '}
            {journey.lecturaInicial
              ? `${formatNumber(journey.lecturaInicial.kilometraje)} km`
              : 'Pendiente'}
          </p>
          <p className="text-slate-700">
            Fin:{' '}
            {journey.lecturaFinal
              ? `${formatNumber(journey.lecturaFinal.kilometraje)} km`
              : 'Pendiente'}
          </p>
        </div>
      </div>

      {journey.causasDisponibilidad.length > 0 && journey.estado === 'PROGRAMADA' && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">No disponible para iniciar</p>
          {journey.causasDisponibilidad.map((cause) => (
            <p className="mt-1 text-xs text-amber-700" key={`${cause.codigo}-${cause.origenId}`}>
              {cause.mensaje}
            </p>
          ))}
        </div>
      )}

      {journey.motivoCambio && (
        <p className="mt-3 text-xs text-slate-500">Cambio: {journey.motivoCambio}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {journey.acciones.puedeIniciar && (
          <Button onClick={() => onAction('start', journey)} size="sm">
            Iniciar jornada
          </Button>
        )}
        {journey.acciones.puedeFinalizar && (
          <Button onClick={() => onAction('finish', journey)} size="sm" variant="secondary">
            Finalizar jornada
          </Button>
        )}
        {journey.acciones.puedeReasignar && (
          <Button onClick={() => onAction('reassign', journey)} size="sm" variant="outline">
            Crear sucesora
          </Button>
        )}
        {journey.acciones.puedeCancelar && (
          <Button onClick={() => onAction('cancel', journey)} size="sm" variant="danger">
            Cancelar jornada
          </Button>
        )}
      </div>
    </article>
  )
}

function ScheduleForm({
  onCreated,
  options,
}: {
  onCreated: () => Promise<void>
  options: JourneyOptionsResponse
}) {
  const [busId, setBusId] = useState('')
  const [conductorId, setConductorId] = useState('')
  const [rutaId, setRutaId] = useState('')
  const [inicio, setInicio] = useState(defaultSchedule(1))
  const [fin, setFin] = useState(defaultSchedule(9))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!busId || !conductorId) {
      setError('Seleccione bus y conductor.')
      return
    }
    if (new Date(inicio) >= new Date(fin)) {
      setError('El inicio debe ser anterior al fin programado.')
      return
    }

    setSubmitting(true)
    try {
      await createJourney({
        busId,
        conductorId,
        finProgramado: toIso(fin),
        inicioProgramado: toIso(inicio),
        ...(rutaId ? { rutaId } : {}),
      })
      setBusId('')
      setConductorId('')
      setRutaId('')
      await onCreated()
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
      <h2 className="text-base font-semibold text-slate-900">Programar jornada</h2>
      <p className="mt-1 text-sm text-slate-500">
        El responsable se deriva de la sesion y la agenda queda protegida contra solapamientos.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">
          Bus
          <select
            aria-label="Bus de jornada"
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            onChange={(event) => setBusId(event.target.value)}
            value={busId}
          >
            <option value="">Seleccione bus</option>
            {options.buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.codigoInterno} · {bus.placa} · {BUS_STATUS_LABELS[bus.estadoOperativo]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Conductor
          <select
            aria-label="Conductor de jornada"
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            onChange={(event) => setConductorId(event.target.value)}
            value={conductorId}
          >
            <option value="">Seleccione conductor</option>
            {options.conductores.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Ruta contextual
          <select
            aria-label="Ruta de jornada"
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            onChange={(event) => setRutaId(event.target.value)}
            value={rutaId}
          >
            <option value="">Sin ruta</option>
            {options.rutas.map((route) => (
              <option key={route.id} value={route.id}>
                {route.codigo} · {route.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Inicio programado
          <input
            aria-label="Inicio programado"
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            onChange={(event) => setInicio(event.target.value)}
            type="datetime-local"
            value={inicio}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Fin programado
          <input
            aria-label="Fin programado"
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            onChange={(event) => setFin(event.target.value)}
            type="datetime-local"
            value={fin}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button loading={submitting} type="submit">
          Programar jornada
        </Button>
      </div>
    </form>
  )
}

function ActionDialog({
  action,
  journey,
  onClose,
  onCompleted,
  options,
}: {
  action: JourneyAction
  journey: JourneyDto
  onClose: () => void
  onCompleted: (message: string) => Promise<void>
  options: JourneyOptionsResponse | null
}) {
  const now = new Date()
  const suggestedEnd = new Date(
    Math.max(new Date(journey.finProgramado).getTime(), now.getTime() + 8 * 60 * 60_000),
  )
  const [fechaEvento, setFechaEvento] = useState(toLocalInput(now))
  const [kilometraje, setKilometraje] = useState(String(journey.lecturaInicial?.kilometraje ?? 0))
  const [motivo, setMotivo] = useState('')
  const [busId, setBusId] = useState(journey.bus.id)
  const [conductorId, setConductorId] = useState(journey.conductor.id)
  const [rutaId, setRutaId] = useState(journey.ruta?.id ?? '')
  const [inicioProgramado, setInicioProgramado] = useState(
    journey.estado === 'EN_CURSO'
      ? toLocalInput(now)
      : toLocalInput(new Date(journey.inicioProgramado)),
  )
  const [finProgramado, setFinProgramado] = useState(toLocalInput(suggestedEnd))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const needsMileage = action === 'start' || action === 'finish' || journey.estado === 'EN_CURSO'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const mileageValue = Number(kilometraje)
    if (needsMileage && (!Number.isInteger(mileageValue) || mileageValue < 0)) {
      setError('Registre un kilometraje entero valido.')
      return
    }
    if ((action === 'cancel' || action === 'reassign') && motivo.trim().length < 3) {
      setError('El motivo debe tener al menos 3 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      if (action === 'start') {
        await startJourney(journey.id, toIso(fechaEvento), mileageValue)
        await onCompleted('Jornada iniciada con lectura inicial')
      } else if (action === 'finish') {
        await finishJourney(journey.id, toIso(fechaEvento), mileageValue)
        await onCompleted('Jornada finalizada con lectura final')
      } else if (action === 'cancel') {
        await cancelJourney(journey.id, {
          fechaEvento: toIso(fechaEvento),
          ...(journey.estado === 'EN_CURSO' ? { kilometrajeFinal: mileageValue } : {}),
          motivo: motivo.trim(),
        })
        await onCompleted('Jornada cancelada sin borrar su historial')
      } else {
        if (!busId || !conductorId || new Date(inicioProgramado) >= new Date(finProgramado)) {
          setError('La sucesora requiere bus, conductor y un horario valido.')
          return
        }
        await reassignJourney(journey.id, {
          busId,
          conductorId,
          fechaEvento: toIso(fechaEvento),
          finProgramado: toIso(finProgramado),
          inicioProgramado: toIso(inicioProgramado),
          ...(journey.estado === 'EN_CURSO' ? { kilometrajeFinal: mileageValue } : {}),
          motivo: motivo.trim(),
          rutaId: rutaId || null,
        })
        await onCompleted('Cambio registrado mediante una jornada sucesora')
      }
      onClose()
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const title = {
    cancel: 'Cancelar jornada',
    finish: 'Finalizar jornada',
    reassign: 'Crear jornada sucesora',
    start: 'Iniciar jornada',
  }[action]

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <div
        aria-label={title}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {journey.bus.codigoInterno} · {journey.conductor.nombre}
          </p>
        </div>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Fecha real del evento
            <input
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              max={toLocalInput(new Date())}
              onChange={(event) => setFechaEvento(event.target.value)}
              required
              type="datetime-local"
              value={fechaEvento}
            />
          </label>
          {needsMileage && (
            <label className="block text-sm font-medium text-slate-700">
              Kilometraje {journey.estado === 'EN_CURSO' ? 'final' : ''}
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                min={journey.lecturaInicial?.kilometraje ?? 0}
                onChange={(event) => setKilometraje(event.target.value)}
                required
                type="number"
                value={kilometraje}
              />
            </label>
          )}
          {(action === 'cancel' || action === 'reassign') && (
            <label className="block text-sm font-medium text-slate-700">
              Motivo
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setMotivo(event.target.value)}
                required
                value={motivo}
              />
            </label>
          )}
          {action === 'reassign' && options && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Bus de la sucesora
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  onChange={(event) => setBusId(event.target.value)}
                  value={busId}
                >
                  {options.buses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.codigoInterno} · {bus.placa}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Conductor de la sucesora
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  onChange={(event) => setConductorId(event.target.value)}
                  value={conductorId}
                >
                  {options.conductores.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Ruta contextual
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  onChange={(event) => setRutaId(event.target.value)}
                  value={rutaId}
                >
                  <option value="">Sin ruta</option>
                  {options.rutas.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.codigo} · {route.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Inicio de la sucesora
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  onChange={(event) => setInicioProgramado(event.target.value)}
                  type="datetime-local"
                  value={inicioProgramado}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Fin de la sucesora
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  onChange={(event) => setFinProgramado(event.target.value)}
                  type="datetime-local"
                  value={finProgramado}
                />
              </label>
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
              Volver
            </Button>
            <Button loading={submitting} type="submit">
              Confirmar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function JourneyPage() {
  const { user } = useSession()
  const isDriver = user?.rol.codigo === 'CONDUCTOR'
  const [list, setList] = useState<JourneyListResponse | null>(null)
  const [own, setOwn] = useState<MyJourneyResponse | null>(null)
  const [options, setOptions] = useState<JourneyOptionsResponse | null>(null)
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState<JourneyStatus | ''>('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [operation, setOperation] = useState<{ action: JourneyAction; journey: JourneyDto } | null>(
    null,
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDriver) {
        setOwn(await getMyJourney())
        return
      }
      const [journeys, journeyOptions] = await Promise.all([
        listJourneys({ buscar, estado, pagina }),
        getJourneyOptions(),
      ])
      setList(journeys)
      setOptions(journeyOptions)
    } finally {
      setLoading(false)
    }
  }, [buscar, estado, isDriver, pagina])

  useEffect(() => {
    let active = true
    void Promise.resolve()
      .then(refresh)
      .catch((loadError) => active && setError(getErrorMessage(loadError)))
    return () => {
      active = false
    }
  }, [refresh])

  async function completeOperation(message: string) {
    setFeedback(message)
    await refresh()
  }

  const driverJourney = own?.jornadaActual ?? own?.proximaJornada ?? null

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone={isDriver ? 'emerald' : 'teal'}>
              {isDriver ? 'Conductor' : 'Despacho operativo'}
            </Badge>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              {isDriver ? 'Mi jornada' : 'Jornadas operativas'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Bus, conductor, ruta, horario y kilometraje unidos en una sola trazabilidad.
            </p>
          </div>
          {!isDriver && (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
              to="/flota"
            >
              Consultar flota
            </Link>
          )}
        </div>
      </section>

      {feedback && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </p>
      )}
      {loading && (
        <StatePanel
          description="Consultando la agenda operativa."
          title="Cargando jornadas"
          tone="loading"
        />
      )}
      {error && !loading && (
        <StatePanel description={error} title="No fue posible cargar las jornadas" tone="error" />
      )}

      {!loading && !error && isDriver && !driverJourney && (
        <StatePanel
          description="No tiene una jornada en curso ni una proxima jornada programada."
          title="Sin jornada asignada"
          tone="empty"
        />
      )}
      {!loading && !error && isDriver && driverJourney && (
        <div className="space-y-3">
          {own?.jornadaActual ? (
            <Badge tone="teal">Tramo actual</Badge>
          ) : (
            <Badge tone="amber">Proxima jornada</Badge>
          )}
          <JourneyCard
            journey={driverJourney}
            onAction={(action, journey) => setOperation({ action, journey })}
          />
        </div>
      )}

      {!loading && !error && !isDriver && options && (
        <ScheduleForm
          onCreated={async () => {
            setFeedback('Jornada programada')
            await refresh()
          }}
          options={options}
        />
      )}
      {!loading && !error && !isDriver && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Buscar jornadas</span>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                onChange={(event) => {
                  setBuscar(event.target.value)
                  setPagina(1)
                }}
                placeholder="Buscar bus, placa, conductor o ruta"
                type="search"
                value={buscar}
              />
            </label>
            <select
              aria-label="Filtrar estado de jornada"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              onChange={(event) => {
                setEstado(event.target.value as JourneyStatus | '')
                setPagina(1)
              }}
              value={estado}
            >
              <option value="">Todos los estados</option>
              {Object.entries(JOURNEY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {list?.jornadas.length === 0 ? (
            <StatePanel
              description="Programe la primera jornada o cambie los filtros."
              title="Sin jornadas"
              tone="empty"
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {list?.jornadas.map((journey) => (
                <JourneyCard
                  journey={journey}
                  key={journey.id}
                  onAction={(action, selected) => setOperation({ action, journey: selected })}
                />
              ))}
            </div>
          )}
          {list && list.paginacion.paginas > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                disabled={pagina <= 1}
                onClick={() => setPagina((value) => value - 1)}
                size="sm"
                variant="outline"
              >
                Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Pagina {pagina} de {list.paginacion.paginas}
              </span>
              <Button
                disabled={pagina >= list.paginacion.paginas}
                onClick={() => setPagina((value) => value + 1)}
                size="sm"
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          )}
        </section>
      )}

      {operation && (
        <ActionDialog
          action={operation.action}
          journey={operation.journey}
          onClose={() => setOperation(null)}
          onCompleted={completeOperation}
          options={options}
        />
      )}
    </div>
  )
}
