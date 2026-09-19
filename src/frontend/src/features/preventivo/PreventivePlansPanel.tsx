import { useCallback, useEffect, useState, type FormEvent } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import StatePanel from '../../components/ui/StatePanel'
import { PREVENTIVE_CRITERION_LABELS } from '../../domain/labels'
import { formatNumber } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { listBuses, listModelosBus } from '../flota/fleet.api'
import type { BusSummaryDto, ModeloBusSummaryDto } from '../flota/fleet.types'
import {
  applyPreventivePlan,
  createPreventivePlan,
  createPreventivePlanVersion,
  deactivatePreventivePlan,
  getPreventivePlan,
  listPreventivePlans,
  type PreventivePlanInput,
} from './preventive.api'
import type {
  PreventiveCriterion,
  PreventivePlanDetailDto,
  PreventivePlanDto,
  PreventiveScheduleDto,
} from './preventive.types'

const criteria: PreventiveCriterion[] = ['FECHA', 'KILOMETRAJE', 'FECHA_KILOMETRAJE']
const fieldClass =
  'mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100'

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operacion.'
}

function optionalPositive(value: string) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function PlanForm({
  buses,
  initial,
  modelos,
  onCancel,
  onSave,
  saving,
}: {
  buses: BusSummaryDto[]
  initial?: PreventivePlanDto
  modelos: ModeloBusSummaryDto[]
  onCancel: () => void
  onSave: (input: PreventivePlanInput) => Promise<void>
  saving: boolean
}) {
  const [criterion, setCriterion] = useState<PreventiveCriterion>(initial?.criterio ?? 'FECHA')
  const [destination, setDestination] = useState<'BUS' | 'MODELO'>(initial?.destino.tipo ?? 'BUS')
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    actividad: initial?.actividad ?? '',
    anticipacionDias: initial?.anticipacionDias?.toString() ?? '',
    anticipacionKm: initial?.anticipacionKm?.toString() ?? '',
    bloqueaAlVencer: initial?.bloqueaAlVencer ?? false,
    busId: initial?.destino.tipo === 'BUS' ? initial.destino.busId : '',
    componente: initial?.componente ?? '',
    intervaloDias: initial?.intervaloDias?.toString() ?? '',
    intervaloKm: initial?.intervaloKm?.toString() ?? '',
    modeloBusId: initial?.destino.tipo === 'MODELO' ? initial.destino.modeloBusId : '',
    prioridad: initial?.prioridad ?? 'MEDIA',
  })
  const needsDays = criterion !== 'KILOMETRAJE'
  const needsKm = criterion !== 'FECHA'
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) {
      return
    }

    setError(null)
    const days = optionalPositive(form.intervaloDias)
    const km = optionalPositive(form.intervaloKm)
    const earlyDays = form.anticipacionDias === '' ? undefined : Number(form.anticipacionDias)
    const earlyKm = form.anticipacionKm === '' ? undefined : Number(form.anticipacionKm)
    if (form.actividad.trim().length < 10 || form.componente.trim().length < 2)
      return setError('Complete actividad (10 caracteres) y componente.')
    if (!initial && !(destination === 'BUS' ? form.busId : form.modeloBusId))
      return setError('Seleccione un unico destino: bus o modelo.')
    if ((needsDays && days === null) || (!needsDays && form.intervaloDias))
      return setError('Revise el intervalo de dias para el criterio seleccionado.')
    if ((needsKm && km === null) || (!needsKm && form.intervaloKm))
      return setError('Revise el intervalo de kilometraje para el criterio seleccionado.')
    if (
      (earlyDays !== undefined &&
        (!Number.isInteger(earlyDays) || earlyDays < 0 || !days || earlyDays >= days)) ||
      (earlyKm !== undefined && (!Number.isInteger(earlyKm) || earlyKm < 0 || !km || earlyKm >= km))
    )
      return setError('Cada anticipacion debe ser menor que su intervalo.')
    await onSave({
      actividad: form.actividad.trim(),
      anticipacionDias: earlyDays,
      anticipacionKm: earlyKm,
      bloqueaAlVencer: form.bloqueaAlVencer,
      ...(initial
        ? {}
        : destination === 'BUS'
          ? { busId: Number(form.busId) }
          : { modeloBusId: Number(form.modeloBusId) }),
      componente: form.componente.trim(),
      criterio: criterion,
      intervaloDias: days ?? undefined,
      intervaloKm: km ?? undefined,
      prioridad: form.prioridad as PreventivePlanInput['prioridad'],
    })
  }

  return (
    <Modal
      onClose={onCancel}
      title={
        initial ? `Crear nueva versión de ${initial.claveTarea}` : 'Crear rutina de mantenimiento'
      }
    >
      <form className="space-y-3 p-5" onSubmit={(event) => void submit(event)}>
        {!initial && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
            {
              'El identificador interno de esta rutina se generar\u00e1 al guardarla. Solo debe describir el mantenimiento que necesita la flota.'
            }
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            {'Componente del veh\u00edculo'}
            <input
              aria-label="Componente del veh\u00edculo"
              maxLength={120}
              className={fieldClass}
              onChange={(e) => set('componente', e.target.value)}
              value={form.componente}
            />
          </label>
          <label className="sm:col-span-2">
            {'Actividad que se realizar\u00e1'}
            <textarea
              aria-label="Actividad que se realizar\u00e1"
              className={`${fieldClass} h-auto min-h-20 py-2`}
              onChange={(e) => set('actividad', e.target.value)}
              value={form.actividad}
            />
          </label>
          <label>
            {'\u00bfCu\u00e1ndo se programa?'}
            <select
              aria-label="Cu\u00e1ndo se programa"
              className={fieldClass}
              onChange={(e) => setCriterion(e.target.value as PreventiveCriterion)}
              value={criterion}
            >
              {criteria.map((value) => (
                <option key={value} value={value}>
                  {PREVENTIVE_CRITERION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select
              aria-label="Prioridad"
              className={fieldClass}
              onChange={(e) => set('prioridad', e.target.value)}
              value={form.prioridad}
            >
              <option>BAJA</option>
              <option>MEDIA</option>
              <option>ALTA</option>
            </select>
          </label>
          {needsDays && (
            <label>
              {'Repetir cada (d\u00edas)'}
              <input
                aria-label="Repetir cada (d\u00edas)"
                className={fieldClass}
                min="1"
                onChange={(e) => set('intervaloDias', e.target.value)}
                type="number"
                value={form.intervaloDias}
              />
            </label>
          )}
          {needsKm && (
            <label>
              Repetir cada (km)
              <input
                aria-label="Repetir cada (km)"
                className={fieldClass}
                min="1"
                onChange={(e) => set('intervaloKm', e.target.value)}
                type="number"
                value={form.intervaloKm}
              />
            </label>
          )}
          {needsDays && (
            <label>
              {'Avisar con (d\u00edas)'}
              <input
                aria-label="Avisar con (d\u00edas)"
                className={fieldClass}
                min="0"
                onChange={(e) => set('anticipacionDias', e.target.value)}
                type="number"
                value={form.anticipacionDias}
              />
            </label>
          )}
          {needsKm && (
            <label>
              Avisar con (km)
              <input
                aria-label="Avisar con (km)"
                className={fieldClass}
                min="0"
                onChange={(e) => set('anticipacionKm', e.target.value)}
                type="number"
                value={form.anticipacionKm}
              />
            </label>
          )}
        </div>
        {!initial && (
          <fieldset>
            <legend className="text-sm font-medium">Alcance (exactamente uno)</legend>
            <div className="mt-2 flex gap-4">
              <label>
                <input
                  checked={destination === 'BUS'}
                  name="destino"
                  onChange={() => setDestination('BUS')}
                  type="radio"
                />{' '}
                Bus
              </label>
              <label>
                <input
                  checked={destination === 'MODELO'}
                  name="destino"
                  onChange={() => setDestination('MODELO')}
                  type="radio"
                />{' '}
                Modelo
              </label>
            </div>
            {destination === 'BUS' ? (
              <select
                aria-label="Bus destino"
                className={`${fieldClass} mt-2`}
                onChange={(e) => set('busId', e.target.value)}
                value={form.busId}
              >
                <option value="">Seleccione bus</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.codigoInterno} · {bus.placa}
                  </option>
                ))}
              </select>
            ) : (
              <select
                aria-label="Modelo destino"
                className={`${fieldClass} mt-2`}
                onChange={(e) => set('modeloBusId', e.target.value)}
                value={form.modeloBusId}
              >
                <option value="">Seleccione modelo</option>
                {modelos.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.marca} {model.nombreModelo}
                  </option>
                ))}
              </select>
            )}
          </fieldset>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={form.bloqueaAlVencer}
            onChange={(e) => set('bloqueaAlVencer', e.target.checked)}
            type="checkbox"
          />{' '}
          Impedir nuevas jornadas si se vence
        </label>
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <h4 className="font-semibold text-slate-900">Resumen de la rutina</h4>
          <p className="mt-1">
            {form.componente.trim() || 'Componente por definir'}:{' '}
            {form.actividad.trim() || 'actividad por definir'}.
          </p>
          <p className="mt-1 text-slate-500">
            {PREVENTIVE_CRITERION_LABELS[criterion]}.{' '}
            {destination === 'BUS'
              ? 'Se aplicar\u00e1 a un bus espec\u00edfico.'
              : 'Se aplicar\u00e1 a los buses de un modelo.'}{' '}
            {form.bloqueaAlVencer
              ? 'Al vencer, impedir\u00e1 nuevas jornadas hasta atenderse.'
              : 'Al vencer, avisar\u00e1 sin bloquear nuevas jornadas.'}
          </p>
        </section>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            Cancelar
          </Button>
          <Button loading={saving} type="submit">
            {initial ? 'Guardar nueva versión' : 'Crear rutina'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ApplyPlanDialog({
  buses,
  onApply,
  onCancel,
  plan,
  saving,
}: {
  buses: BusSummaryDto[]
  onApply: (busId: number) => Promise<void>
  onCancel: () => void
  plan: PreventivePlanDto
  saving: boolean
}) {
  const belongsToPlan = (bus: BusSummaryDto) =>
    plan.destino.tipo === 'BUS'
      ? bus.id === plan.destino.busId
      : bus.modeloBus?.id === plan.destino.modeloBusId
  const eligibleBuses = buses.filter(
    (bus) => bus.estadoOperativo !== 'INACTIVO' && belongsToPlan(bus),
  )
  const ineligibleBuses = buses.filter((bus) => !eligibleBuses.includes(bus))
  const [busId, setBusId] = useState(String(eligibleBuses[0]?.id ?? ''))
  const [openedAt] = useState(() => new Date())
  const selectedBus = eligibleBuses.find((bus) => bus.id === Number(busId))
  const estimatedDate =
    plan.intervaloDias === null
      ? null
      : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(
          new Date(openedAt.getTime() + plan.intervaloDias * 24 * 60 * 60 * 1000),
        )
  const estimatedMileage =
    selectedBus && plan.intervaloKm !== null
      ? `${formatNumber(selectedBus.kilometrajeActual + plan.intervaloKm)} km`
      : null

  function ineligibleReason(bus: BusSummaryDto) {
    if (bus.estadoOperativo === 'INACTIVO') return 'El bus esta inactivo.'
    if (plan.destino.tipo === 'BUS') return 'Esta rutina es exclusiva de otro bus.'
    return 'Su modelo no coincide con el alcance de esta rutina.'
  }

  return (
    <Modal onClose={onCancel} subtitle={plan.claveTarea} title="Asignar rutina a un bus">
      <div className="p-5">
        <p className="text-sm text-slate-500">
          Se creará un mantenimiento programado usando la fecha y el kilometraje actuales.
        </p>
        <label className="mt-4 block text-sm font-medium">
          Bus elegible
          <select
            aria-label="Bus para aplicar plan"
            className={fieldClass}
            onChange={(event) => setBusId(event.target.value)}
            value={busId}
          >
            {eligibleBuses.length === 0 && <option value="">Sin buses elegibles</option>}
            {eligibleBuses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.codigoInterno} · {bus.placa}
              </option>
            ))}
          </select>
        </label>
        {selectedBus && (
          <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <h4 className="font-semibold text-slate-900">Objetivo que se programara</h4>
            <p className="mt-1 text-slate-600">
              {estimatedDate ? `Fecha: ${estimatedDate}.` : 'Sin objetivo por fecha.'}{' '}
              {estimatedMileage
                ? `Kilometraje: ${estimatedMileage}.`
                : 'Sin objetivo por kilometraje.'}
            </p>
          </section>
        )}
        <details className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">
            Buses no elegibles ({ineligibleBuses.length})
          </summary>
          {ineligibleBuses.length === 0 ? (
            <p className="mt-2 text-slate-500">Todos los buses cargados pueden usar esta rutina.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-slate-600">
              {ineligibleBuses.map((bus) => (
                <li key={bus.id}>
                  <b>{bus.codigoInterno}</b>: {ineligibleReason(bus)}
                </li>
              ))}
            </ul>
          )}
        </details>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            Cancelar
          </Button>
          <Button
            disabled={!busId}
            loading={saving}
            onClick={() => void onApply(Number(busId))}
            type="button"
          >
            Asignar rutina
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function PlanVersionsDialog({
  detail,
  onClose,
}: {
  detail: PreventivePlanDetailDto
  onClose: () => void
}) {
  return (
    <Modal
      onClose={onClose}
      subtitle={`${detail.plan.claveTarea} · Historial inmutable del plan.`}
      title="Versiones del plan preventivo"
    >
      <div className="p-5">
        <div className="mt-4 space-y-3">
          {detail.versiones.map((version) => (
            <article className="rounded-lg border border-slate-200 p-4" key={version.id}>
              <div className="flex items-center justify-between gap-3">
                <b>Version {version.version}</b>
                <Badge tone={version.activa ? 'emerald' : 'slate'}>
                  {version.activa ? 'Activa' : 'Historica'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">{version.actividad}</p>
              <p className="mt-2 text-xs text-slate-500">
                {PREVENTIVE_CRITERION_LABELS[version.criterio]} · {version.componente}
              </p>
            </article>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function DeactivatePlanDialog({
  onCancel,
  onConfirm,
  plan,
  saving,
}: {
  onCancel: () => void
  onConfirm: () => Promise<void>
  plan: PreventivePlanDto
  saving: boolean
}) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <Modal onClose={onCancel} subtitle={plan.claveTarea} title="Dejar de usar esta rutina">
      <div className="space-y-4 p-5">
        <p className="text-sm leading-6 text-slate-600">
          La rutina dejará de estar disponible para nuevas asignaciones. Los mantenimientos ya
          programados y su historial no se eliminan.
        </p>
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <input
            checked={confirmed}
            className="mt-1"
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />
          Confirmo que deseo dejar de usar esta rutina para futuras asignaciones.
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            Cancelar
          </Button>
          <Button
            disabled={!confirmed}
            loading={saving}
            onClick={() => void onConfirm()}
            type="button"
            variant="danger"
          >
            Dejar de usar rutina
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function PreventivePlansPanel({
  onOpenSchedule,
}: {
  onOpenSchedule: (programacionId: number) => void
}) {
  const [plans, setPlans] = useState<PreventivePlanDto[] | null>(null)
  const [buses, setBuses] = useState<BusSummaryDto[]>([])
  const [models, setModels] = useState<ModeloBusSummaryDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<PreventivePlanDto | null>(null)
  const [detail, setDetail] = useState<PreventivePlanDetailDto | null>(null)
  const [pendingDeactivate, setPendingDeactivate] = useState<PreventivePlanDto | null>(null)
  const [editing, setEditing] = useState<PreventivePlanDto | undefined>()
  const [includeHistorical, setIncludeHistorical] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [existingSchedule, setExistingSchedule] = useState<PreventiveScheduleDto | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [planResult, busResult, modelResult] = await Promise.all([
        listPreventivePlans(includeHistorical),
        listBuses({ limite: 100, pagina: 1 }),
        listModelosBus(),
      ])
      setPlans(planResult.planes)
      setBuses(busResult.buses)
      setModels(modelResult.modelosBus)
    } catch (loadError) {
      setError(messageFrom(loadError))
    }
  }, [includeHistorical])
  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(request)
  }, [load])
  async function save(input: PreventivePlanInput) {
    setSaving(true)
    setError(null)
    setExistingSchedule(null)
    try {
      if (editing) await createPreventivePlanVersion(editing.id, input)
      else await createPreventivePlan(input)
      setFeedback(
        editing ? 'Nueva versión de la rutina registrada.' : 'Rutina de mantenimiento registrada.',
      )
      setShowForm(false)
      setEditing(undefined)
      await load()
    } catch (saveError) {
      setError(messageFrom(saveError))
    } finally {
      setSaving(false)
    }
  }
  async function deactivate(plan: PreventivePlanDto) {
    setSaving(true)
    setExistingSchedule(null)
    try {
      await deactivatePreventivePlan(plan.id)
      setFeedback(`La rutina ${plan.claveTarea} dejó de usarse para nuevas asignaciones.`)
      await load()
    } catch (operationError) {
      setError(messageFrom(operationError))
    } finally {
      setSaving(false)
    }
  }
  async function apply(plan: PreventivePlanDto, busId: number) {
    setSaving(true)
    setError(null)
    try {
      const result = await applyPreventivePlan({ busId, planId: plan.id })
      setExistingSchedule(result.yaExistia ? result.programacion : null)
      setFeedback(
        result.yaExistia
          ? `Esta rutina ya estaba asignada a ese bus.`
          : `Rutina asignada: el mantenimiento programado ya tiene sus objetivos.`,
      )
      setApplying(null)
      await load()
    } catch (operationError) {
      setError(messageFrom(operationError))
    } finally {
      setSaving(false)
    }
  }
  async function showVersions(plan: PreventivePlanDto) {
    setError(null)
    try {
      setDetail(await getPreventivePlan(plan.id))
    } catch (operationError) {
      setError(messageFrom(operationError))
    }
  }
  if (!plans && !error)
    return (
      <StatePanel
        description="Consultando planes preventivos."
        title="Cargando planes"
        tone="loading"
      />
    )
  if (error && !plans)
    return (
      <StatePanel
        action={<Button onClick={() => void load()}>Reintentar</Button>}
        description={error}
        title="No fue posible cargar"
        tone="error"
      />
    )
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Rutinas de mantenimiento</h3>
          <p className="mt-1 text-sm text-slate-500">
            Defina cada cuánto se realiza una tarea por bus o modelo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              checked={includeHistorical}
              onChange={(event) => setIncludeHistorical(event.target.checked)}
              type="checkbox"
            />
            Incluir historicos
          </label>
          <Button
            onClick={() => {
              setEditing(undefined)
              setShowForm(true)
            }}
          >
            Crear rutina
          </Button>
        </div>
      </div>
      {feedback && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <p>{feedback}</p>
          {existingSchedule && (
            <Button onClick={() => onOpenSchedule(existingSchedule.id)} size="sm" variant="outline">
              Abrir mantenimiento programado
            </Button>
          )}
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {plans?.length === 0 ? (
        <StatePanel
          description="Cree la primera rutina de mantenimiento para comenzar."
          title="Sin rutinas de mantenimiento"
          tone="empty"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table aria-label="Planes preventivos" className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Tarea</th>
                <th className="px-4 py-3">Criterio</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Bloqueo</th>
                <th className="px-4 py-3">Programaciones/orden</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans?.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-4 py-3">
                    <b>{plan.claveTarea}</b>
                    <p className="text-slate-500">{plan.componente}</p>
                  </td>
                  <td className="px-4 py-3">{PREVENTIVE_CRITERION_LABELS[plan.criterio]}</td>
                  <td className="px-4 py-3">
                    {plan.destino.tipo === 'BUS' ? 'Bus especifico' : 'Modelo de bus'}
                  </td>
                  <td className="px-4 py-3">v{plan.version}</td>
                  <td className="px-4 py-3">
                    {plan.bloqueaAlVencer ? <Badge tone="red">Al vencer</Badge> : 'No bloquea'}
                  </td>
                  <td className="px-4 py-3">{plan.programacionesAsociadas}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        disabled={!plan.activa || saving}
                        onClick={() => setApplying(plan)}
                        size="sm"
                        variant="secondary"
                      >
                        Asignar a buses
                      </Button>
                      <Button onClick={() => void showVersions(plan)} size="sm" variant="outline">
                        Versiones
                      </Button>
                      <Button
                        disabled={!plan.activa || saving}
                        onClick={() => {
                          setEditing(plan)
                          setShowForm(true)
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Nueva versión
                      </Button>
                      <Button
                        disabled={!plan.activa || saving}
                        onClick={() => setPendingDeactivate(plan)}
                        size="sm"
                        variant="outline"
                      >
                        Dejar de usar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <PlanForm
          buses={buses}
          initial={editing}
          modelos={models}
          onCancel={() => {
            setShowForm(false)
            setEditing(undefined)
          }}
          onSave={save}
          saving={saving}
        />
      )}
      {applying && (
        <ApplyPlanDialog
          buses={buses}
          onApply={(busId) => apply(applying, busId)}
          onCancel={() => setApplying(null)}
          plan={applying}
          saving={saving}
        />
      )}
      {detail && <PlanVersionsDialog detail={detail} onClose={() => setDetail(null)} />}
      {pendingDeactivate && (
        <DeactivatePlanDialog
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={async () => {
            await deactivate(pendingDeactivate)
            setPendingDeactivate(null)
          }}
          plan={pendingDeactivate}
          saving={saving}
        />
      )}
    </section>
  )
}
