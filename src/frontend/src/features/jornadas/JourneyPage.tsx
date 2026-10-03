import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import JourneyCard from './JourneyCard'
import JourneyAttentionQueue from './JourneyAttentionQueue'
import JourneyDecisionDialog from './JourneyDecisionDialog'
import JourneyAgenda from './JourneyAgenda'
import type { JourneyGroupBy } from './JourneyAgenda'
import JourneyConfirmationDialog from './JourneyConfirmationDialog'
import JourneyInterruptionDialog from './JourneyInterruptionDialog'
import JourneyScheduleForm from './JourneyScheduleForm'
import { JOURNEY_LABELS, closureOverdue, type JourneyAction } from './journey.view'
import Button from '../../components/ui/Button'
import ContextHint from '../../components/ui/ContextHint'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatePanel from '../../components/ui/StatePanel'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useCurrentTime } from '../../hooks/useCurrentTime'
import { ApiError } from '../../lib/api'
import { useSession } from '../auth/session.context'
import {
  cancelJourney,
  getJourney,
  getJourneyOptions,
  getMyJourney,
  listJourneyAttention,
  listJourneys,
  reassignJourney,
  reportJourneyClosureProblem,
} from './journey.api'
import type {
  JourneyDto,
  JourneyAttentionCategory,
  JourneyAttentionResponse,
  JourneyListResponse,
  JourneyOptionsResponse,
  JourneyStatus,
  MyJourneyResponse,
} from './journey.types'

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

function toIso(value: string) {
  return new Date(value).toISOString()
}

function getJourneyIdFromSearch(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null
  const journeyId = Number(value)
  return Number.isSafeInteger(journeyId) && journeyId > 0 ? journeyId : null
}

function ActionDialog({
  action,
  journey,
  onClose,
  onCompleted,
  options,
}: {
  action: Exclude<JourneyAction, 'start' | 'finish' | 'interrupt' | 'reconcile' | 'unrecoverable'>
  journey: JourneyDto
  onClose: () => void
  onCompleted: (message: string) => Promise<void>
  options: JourneyOptionsResponse | null
}) {
  const { user } = useSession()
  const now = new Date()
  const suggestedEnd = new Date(
    Math.max(new Date(journey.finProgramado).getTime(), now.getTime() + 8 * 60 * 60_000),
  )
  const [fechaEvento, setFechaEvento] = useState(toLocalInput(now))
  const [kilometraje, setKilometraje] = useState('')
  const [observerChoice, setObserverChoice] = useState<'self' | 'driver' | ''>('')
  const [backupReason, setBackupReason] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busId, setBusId] = useState(
    journey.estado === 'INTERRUMPIDA' ? '' : String(journey.bus.id),
  )
  const [conductorId, setConductorId] = useState(String(journey.conductor.id))
  const [rutaId, setRutaId] = useState(journey.ruta?.id ?? '')
  const [inicioProgramado, setInicioProgramado] = useState(
    journey.estado === 'EN_CURSO' || journey.estado === 'INTERRUMPIDA'
      ? toLocalInput(now)
      : toLocalInput(new Date(journey.inicioProgramado)),
  )
  const [finProgramado, setFinProgramado] = useState(toLocalInput(suggestedEnd))
  const [recalcularProyeccion, setRecalcularProyeccion] = useState(false)
  const [ciclosSimulados, setCiclosSimulados] = useState('1')
  const [kmNoComerciales, setKmNoComerciales] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const needsMileage = action === 'reassign' && journey.estado === 'EN_CURSO'
  const provenance =
    needsMileage && observerChoice
      ? {
          observadoPorId: observerChoice === 'self' ? user!.id : journey.conductor.id,
          ...(observerChoice === 'driver' ? { motivoRespaldo: backupReason.trim() } : {}),
        }
      : undefined
  const selectedReplacementBus = options?.buses.find((bus) => bus.id === Number(busId))
  const selectedReplacementDriver = options?.conductores.find(
    (driver) => driver.id === Number(conductorId),
  )
  const selectedReplacementRoute = options?.rutas.find((route) => route.id === Number(rutaId))
  const cyclesValue = Number(ciclosSimulados)
  const nonCommercialValue = Number(kmNoComerciales)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    const mileageValue = Number(kilometraje)
    if (
      needsMileage &&
      (!kilometraje.trim() || !Number.isInteger(mileageValue) || mileageValue < 0)
    ) {
      setError('Registre un kilometraje entero valido.')
      return
    }
    if (
      needsMileage &&
      (!observerChoice || (observerChoice === 'driver' && backupReason.trim().length < 3))
    ) {
      setError('Identifique quién observó el odómetro y el motivo del respaldo.')
      return
    }
    if (
      (action === 'cancel' || action === 'reassign' || action === 'report') &&
      motivo.trim().length < (action === 'report' ? 10 : 3)
    ) {
      setError(`El motivo debe tener al menos ${action === 'report' ? 10 : 3} caracteres.`)
      return
    }
    if (
      action === 'reassign' &&
      recalcularProyeccion &&
      (!selectedReplacementRoute?.longitudKmOficial ||
        !Number.isInteger(cyclesValue) ||
        cyclesValue < 1 ||
        cyclesValue > 100 ||
        !Number.isFinite(nonCommercialValue) ||
        nonCommercialValue < 0 ||
        nonCommercialValue > 1000)
    ) {
      setError('Para recalcular la estimación indique una ruta y valores válidos de simulación.')
      return
    }

    setSubmitting(true)
    try {
      if (action === 'report') {
        await reportJourneyClosureProblem(journey.id, motivo.trim())
        await onCompleted(
          'Informe enviado a la bandeja interna de Despacho. El bus sigue bloqueado hasta registrar el cierre o una cancelación justificada.',
        )
      } else if (action === 'cancel') {
        await cancelJourney(journey.id, {
          fechaEvento: toIso(fechaEvento),
          motivo: motivo.trim(),
        })
        await onCompleted('Jornada cancelada sin borrar su historial')
      } else {
        if (!busId || !conductorId || new Date(inicioProgramado) >= new Date(finProgramado)) {
          setError('Seleccione bus, conductor y un horario válido para el nuevo tramo.')
          return
        }
        if (journey.estado === 'INTERRUMPIDA' && Number(busId) === journey.bus.id) {
          setError('Seleccione un bus sustituto distinto del bus interrumpido.')
          return
        }
        await reassignJourney(journey.id, {
          busId: Number(busId),
          conductorId: Number(conductorId),
          fechaEvento: toIso(fechaEvento),
          finProgramado: toIso(finProgramado),
          inicioProgramado: toIso(inicioProgramado),
          ...(journey.estado === 'EN_CURSO' ? { kilometrajeFinal: mileageValue } : {}),
          ...provenance,
          motivo: motivo.trim(),
          rutaId: rutaId ? Number(rutaId) : null,
          ...(recalcularProyeccion
            ? {
                simulacion: {
                  ciclosCompletosSimulados: cyclesValue,
                  kmNoComercialesSimulados: nonCommercialValue,
                },
              }
            : {}),
        })
        await onCompleted(
          journey.estado === 'INTERRUMPIDA'
            ? 'Tramo sucesor creado con bus sustituto, sin alterar la interrupción'
            : 'Cambio de bus o conductor registrado sin perder el historial',
        )
      }
      onClose()
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const title = {
    report: 'Informar cierre pendiente',
    cancel: 'Cancelar jornada',
    reassign:
      journey.estado === 'INTERRUMPIDA'
        ? 'Crear tramo con bus sustituto'
        : 'Cambiar bus o conductor',
  }[action]

  return (
    <Modal
      onClose={onClose}
      subtitle={`${journey.bus.codigoInterno} · ${journey.conductor.nombre}`}
      title={title}
    >
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        {action === 'report' && (
          <p className="text-sm text-slate-600">
            Explica por qué no puedes obtener la lectura final. Despacho podrá ver tu informe dentro
            del sistema. No se enviará correo, WhatsApp ni SMS y la jornada no se cerrará sola.
          </p>
        )}
        {action !== 'report' && (
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
        )}
        {needsMileage && (
          <label className="block text-sm font-medium text-slate-700">
            Lectura observada del odómetro {journey.estado === 'EN_CURSO' ? 'al finalizar' : ''}
            <input
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              min={journey.lecturaInicial?.kilometraje ?? 0}
              onChange={(event) => setKilometraje(event.target.value)}
              required
              type="number"
              value={kilometraje}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Se registrará como lectura real de este evento y no como proyección académica.
            </span>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Quedará registrada a nombre de {user?.nombre ?? 'la persona autenticada'}.
            </span>
          </label>
        )}
        {needsMileage && (
          <>
            <label className="block text-sm font-medium text-slate-700">
              ¿Quién observó físicamente el odómetro?
              <select
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
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
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={backupReason}
                  onChange={(event) => setBackupReason(event.target.value)}
                  required
                />
              </label>
            )}
          </>
        )}
        {(action === 'cancel' || action === 'reassign' || action === 'report') && (
          <label className="block text-sm font-medium text-slate-700">
            {action === 'reassign' ? 'Motivo del cambio' : 'Motivo'}
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => setMotivo(event.target.value)}
              required
              value={motivo}
            />
          </label>
        )}
        {action === 'reassign' && (
          <>
            <ol className="grid gap-2 text-xs sm:grid-cols-3" aria-label="Pasos para cambiar tramo">
              <li className="rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                1. Cerrar tramo actual
              </li>
              <li className="rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                2. Definir reemplazo
              </li>
              <li className="rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                3. Confirmar trazabilidad
              </li>
            </ol>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Estado del tramo actual</p>
              <p className="mt-1">
                {journey.estado === 'INTERRUMPIDA'
                  ? 'El tramo interrumpido conserva su estado y su conciliación. Se creará un tramo sucesor con otro bus.'
                  : journey.estado === 'EN_CURSO'
                    ? 'Está en curso: se cerrará con la lectura final que registre ahora.'
                    : 'Aún no inició: se conservará como tramo programado reemplazado.'}
              </p>
            </div>
          </>
        )}
        {action === 'reassign' && options && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ContextHint title="¿Para qué sirve este cambio?">
                Use esta opción cuando la jornada debe continuar con otro bus o conductor. La
                jornada original conserva su historial y el sistema crea un nuevo tramo vinculado.
              </ContextHint>
            </div>
            {journey.proyeccionDemo && (
              <p className="text-sm text-slate-600 sm:col-span-2">
                La proyección académica queda en el historial del tramo original. El nuevo tramo no
                copia kilómetros simulados porque debe calcularse por separado.
              </p>
            )}
            <label className="text-sm font-medium text-slate-700">
              Bus para continuar
              <select
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                onChange={(event) => setBusId(event.target.value)}
                required
                value={busId}
              >
                {journey.estado === 'INTERRUMPIDA' && (
                  <option value="">Seleccione bus sustituto</option>
                )}
                {options.buses
                  .filter((bus) => journey.estado !== 'INTERRUMPIDA' || bus.id !== journey.bus.id)
                  .map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.codigoInterno} · {bus.placa}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Conductor para continuar
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
              Inicio del nuevo tramo
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                onChange={(event) => setInicioProgramado(event.target.value)}
                type="datetime-local"
                value={inicioProgramado}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fin del nuevo tramo
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                onChange={(event) => setFinProgramado(event.target.value)}
                type="datetime-local"
                value={finProgramado}
              />
            </label>
            <fieldset className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3 text-sm text-slate-700 sm:col-span-2">
              <legend className="px-1 text-xs font-semibold uppercase text-cyan-800">
                Estimación académica opcional
              </legend>
              <label className="flex items-start gap-2">
                <input
                  checked={recalcularProyeccion}
                  onChange={(event) => setRecalcularProyeccion(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Recalcular la estimación del nuevo tramo. No modifica la lectura real del
                  odómetro.
                </span>
              </label>
              {recalcularProyeccion && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Ciclos completos simulados
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                      min="1"
                      onChange={(event) => setCiclosSimulados(event.target.value)}
                      type="number"
                      value={ciclosSimulados}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Kilómetros no comerciales simulados
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                      min="0"
                      onChange={(event) => setKmNoComerciales(event.target.value)}
                      type="number"
                      value={kmNoComerciales}
                    />
                  </label>
                </div>
              )}
            </fieldset>
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 sm:col-span-2">
              <h3 className="font-semibold">Resumen antes de confirmar</h3>
              <p className="mt-1">
                {journey.estado === 'INTERRUMPIDA'
                  ? 'El tramo interrumpido tendrá sucesor en:'
                  : 'El tramo actual quedará registrado como reemplazado por:'}{' '}
                {selectedReplacementBus?.codigoInterno ?? 'bus pendiente'} ·{' '}
                {selectedReplacementDriver?.nombre ?? 'conductor pendiente'}.
              </p>
              <p className="mt-1">
                Horario del nuevo tramo: {formatDateTime(toIso(inicioProgramado))} a{' '}
                {formatDateTime(toIso(finProgramado))}.
              </p>
            </section>
          </div>
        )}
        {error && (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
            Volver
          </Button>
          <Button loading={submitting} type="submit">
            {action === 'reassign' ? 'Confirmar cambio de tramo' : 'Confirmar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function JourneyPage() {
  const { user } = useSession()
  const now = useCurrentTime()
  const [searchParams, setSearchParams] = useSearchParams()
  const isDriver = user?.rol.codigo === 'CONDUCTOR'
  const [list, setList] = useState<JourneyListResponse | null>(null)
  const [attention, setAttention] = useState<JourneyAttentionResponse | null>(null)
  const [own, setOwn] = useState<MyJourneyResponse | null>(null)
  const [options, setOptions] = useState<JourneyOptionsResponse | null>(null)
  const [buscar, setBuscar] = useState('')
  const busquedaEstable = useDebouncedValue(buscar)
  const [estado, setEstado] = useState<JourneyStatus | ''>('')
  const [pagina, setPagina] = useState(1)
  const [groupBy, setGroupBy] = useState<JourneyGroupBy>('bus')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [focusedJourney, setFocusedJourney] = useState<{
    journey: JourneyDto
    journeyId: number
  } | null>(null)
  const [focusedJourneyError, setFocusedJourneyError] = useState<{
    journeyId: number
    message: string
  } | null>(null)
  const [operation, setOperation] = useState<{ action: JourneyAction; journey: JourneyDto } | null>(
    null,
  )
  const [decision, setDecision] = useState<{
    category: JourneyAttentionCategory
    journey: JourneyDto
  } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDriver) {
        setOwn(await getMyJourney())
        return
      }
      const [journeys, journeyOptions, attentionQueue] = await Promise.all([
        listJourneys({ buscar: busquedaEstable, estado, pagina }),
        getJourneyOptions(),
        listJourneyAttention(),
      ])
      setList(journeys)
      setOptions(journeyOptions)
      setAttention(attentionQueue)
    } finally {
      setLoading(false)
    }
  }, [busquedaEstable, estado, isDriver, pagina])

  useEffect(() => {
    let active = true
    void Promise.resolve()
      .then(refresh)
      .catch((loadError) => active && setError(getErrorMessage(loadError)))
    return () => {
      active = false
    }
  }, [refresh])

  const focusedJourneyId = getJourneyIdFromSearch(searchParams.get('detalle'))

  useEffect(() => {
    let active = true

    if (!focusedJourneyId)
      return () => {
        active = false
      }

    void getJourney(focusedJourneyId)
      .then((data) => {
        if (active) {
          setFocusedJourney({ journey: data.jornada, journeyId: focusedJourneyId })
          setFocusedJourneyError(null)
        }
      })
      .catch((loadError) => {
        if (active) {
          setFocusedJourneyError({
            journeyId: focusedJourneyId,
            message: getErrorMessage(loadError),
          })
        }
      })

    return () => {
      active = false
    }
  }, [focusedJourneyId, isDriver])

  function clearFocusedJourney() {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('detalle')
    setSearchParams(nextParams)
  }

  async function completeOperation(message: string) {
    setFeedback(message)
    await refresh()
  }

  const driverJourney = own?.jornadaActual ?? own?.jornadaPendiente ?? own?.proximaJornada ?? null

  return (
    <div className="page-container">
      <PageHeader
        actions={
          !isDriver ? (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              to="/flota"
            >
              Consultar flota
            </Link>
          ) : undefined
        }
        description="Bus, conductor, ruta, horario y kilometraje unidos en una sola trazabilidad."
        eyebrow={isDriver ? 'Conductor' : 'Despacho operativo'}
        title={isDriver ? 'Mi jornada' : 'Jornadas operativas'}
      />

      {isDriver && (
        <ContextHint title="Quién registra las lecturas">
          Usted registra la lectura observada del odómetro al iniciar y finalizar su jornada. La
          hora programada organiza la agenda, pero no prueba el recorrido ni reemplaza el odómetro.
        </ContextHint>
      )}

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
            <Badge tone={closureOverdue(driverJourney, now) ? 'red' : 'teal'}>
              {closureOverdue(driverJourney, now)
                ? 'Cierre pendiente de una jornada anterior'
                : 'Tramo actual'}
            </Badge>
          ) : (
            <Badge tone="amber">
              {own?.jornadaPendiente ? 'Salida pendiente de confirmar' : 'Próxima jornada'}
            </Badge>
          )}
          <JourneyCard
            journey={driverJourney}
            onAction={(action, journey) => setOperation({ action, journey })}
          />
        </div>
      )}

      {!loading && !error && !isDriver && attention && (
        <JourneyAttentionQueue
          data={attention}
          onAction={(action, journey) => setOperation({ action, journey })}
          onResolve={(category, journey) => {
            if (category === 'REASIGNACION') setOperation({ action: 'reassign', journey })
            else setDecision({ category, journey })
          }}
        />
      )}

      {!error && !isDriver && options && (
        <JourneyScheduleForm
          onCreated={async (count) => {
            setFeedback(
              count === 1 ? 'Jornada programada' : `${count} jornadas programadas por período`,
            )
            await refresh()
          }}
          options={options}
        />
      )}
      {!loading && !error && focusedJourneyError?.journeyId === focusedJourneyId && (
        <StatePanel
          action={
            <Button onClick={clearFocusedJourney} variant="outline">
              Volver a jornadas
            </Button>
          }
          description={focusedJourneyError.message}
          title="No fue posible abrir la jornada vinculada"
          tone="error"
        />
      )}
      {!loading && !error && focusedJourney?.journeyId === focusedJourneyId && (
        <section aria-label="Jornada vinculada a novedad" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Jornada vinculada a novedad
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Revise el impacto operativo de este tramo antes de cambiar recursos o cancelarlo.
              </p>
            </div>
            <Button onClick={clearFocusedJourney} size="sm" variant="outline">
              Ver agenda completa
            </Button>
          </div>
          <JourneyCard
            journey={focusedJourney.journey}
            onAction={(action, journey) => setOperation({ action, journey })}
          />
        </section>
      )}
      {!loading && !error && !isDriver && (
        <section className="space-y-4">
          <div className="surface flex flex-col gap-3 p-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Buscar jornadas</span>
              <input
                className="field-control mt-0"
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
              className="field-control mt-0 sm:w-52"
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
            <JourneyAgenda
              key={`${pagina}:${busquedaEstable}:${estado}`}
              journeys={list?.jornadas ?? []}
              onAction={(action, selected) => setOperation({ action, journey: selected })}
              page={pagina}
              searchTerm={busquedaEstable}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
            />
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

      {decision && (
        <JourneyDecisionDialog
          category={decision.category}
          journey={decision.journey}
          onAction={(action, journey) => setOperation({ action, journey })}
          onClose={() => setDecision(null)}
        />
      )}
      {operation &&
      (operation.action === 'interrupt' ||
        operation.action === 'reconcile' ||
        operation.action === 'unrecoverable') ? (
        <JourneyInterruptionDialog
          action={operation.action}
          journey={operation.journey}
          onClose={() => setOperation(null)}
          onCompleted={completeOperation}
        />
      ) : operation && (operation.action === 'start' || operation.action === 'finish') ? (
        <JourneyConfirmationDialog
          action={operation.action}
          journey={operation.journey}
          onClose={() => setOperation(null)}
          onCompleted={completeOperation}
        />
      ) : (
        operation && (
          <ActionDialog
            action={
              operation.action as Exclude<
                JourneyAction,
                'start' | 'finish' | 'interrupt' | 'reconcile' | 'unrecoverable'
              >
            }
            journey={operation.journey}
            onClose={() => setOperation(null)}
            onCompleted={completeOperation}
            options={options}
          />
        )
      )}
    </div>
  )
}
