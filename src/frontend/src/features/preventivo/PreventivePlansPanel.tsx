import { useCallback, useEffect, useState, type FormEvent } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'
import { PREVENTIVE_CRITERION_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { listBuses, listModelosBus } from '../flota/fleet.api'
import type { BusSummaryDto, ModeloBusSummaryDto } from '../flota/fleet.types'
import {
  createPreventivePlan,
  createPreventivePlanVersion,
  deactivatePreventivePlan,
  listPreventivePlans,
  type PreventivePlanInput,
} from './preventive.api'
import type { PreventiveCriterion, PreventivePlanDto } from './preventive.types'

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
    claveTarea: initial?.claveTarea ?? '',
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
    setError(null)
    const days = optionalPositive(form.intervaloDias)
    const km = optionalPositive(form.intervaloKm)
    const earlyDays = form.anticipacionDias === '' ? undefined : Number(form.anticipacionDias)
    const earlyKm = form.anticipacionKm === '' ? undefined : Number(form.anticipacionKm)
    if (form.actividad.trim().length < 10 || form.componente.trim().length < 2)
      return setError('Complete actividad (10 caracteres) y componente.')
    if (
      !initial &&
      (form.claveTarea.trim().length < 2 || !/^[A-Za-z0-9._-]+$/.test(form.claveTarea.trim()))
    )
      return setError('La clave de tarea solo admite letras, numeros, punto, guion y guion bajo.')
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
          ? { busId: form.busId }
          : { modeloBusId: form.modeloBusId }),
      ...(initial ? {} : { claveTarea: form.claveTarea.trim() }),
      componente: form.componente.trim(),
      criterio: criterion,
      intervaloDias: days ?? undefined,
      intervaloKm: km ?? undefined,
      prioridad: form.prioridad as PreventivePlanInput['prioridad'],
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <div
        aria-modal="true"
        className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        role="dialog"
      >
        <h3 className="text-lg font-semibold">
          {initial ? `Versionar ${initial.claveTarea}` : 'Crear plan preventivo'}
        </h3>
        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Clave de tarea
              <input
                aria-label="Clave de tarea"
                className={fieldClass}
                disabled={Boolean(initial)}
                onChange={(e) => set('claveTarea', e.target.value)}
                value={form.claveTarea}
              />
            </label>
            <label>
              Componente
              <input
                aria-label="Componente"
                className={fieldClass}
                onChange={(e) => set('componente', e.target.value)}
                value={form.componente}
              />
            </label>
            <label className="sm:col-span-2">
              Actividad
              <textarea
                aria-label="Actividad"
                className={`${fieldClass} h-auto min-h-20 py-2`}
                onChange={(e) => set('actividad', e.target.value)}
                value={form.actividad}
              />
            </label>
            <label>
              Criterio
              <select
                aria-label="Criterio de plan"
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
                Intervalo dias
                <input
                  aria-label="Intervalo dias"
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
                Intervalo km
                <input
                  aria-label="Intervalo kilometraje"
                  className={fieldClass}
                  min="1"
                  onChange={(e) => set('intervaloKm', e.target.value)}
                  type="number"
                  value={form.intervaloKm}
                />
              </label>
            )}
            <label>
              Anticipacion dias
              <input
                aria-label="Anticipacion dias"
                className={fieldClass}
                min="0"
                onChange={(e) => set('anticipacionDias', e.target.value)}
                type="number"
                value={form.anticipacionDias}
              />
            </label>
            <label>
              Anticipacion km
              <input
                aria-label="Anticipacion kilometraje"
                className={fieldClass}
                min="0"
                onChange={(e) => set('anticipacionKm', e.target.value)}
                type="number"
                value={form.anticipacionKm}
              />
            </label>
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
            Bloquear operacion al vencer
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={onCancel} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Guardando...' : initial ? 'Crear version' : 'Crear plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PreventivePlansPanel() {
  const [plans, setPlans] = useState<PreventivePlanDto[] | null>(null)
  const [buses, setBuses] = useState<BusSummaryDto[]>([])
  const [models, setModels] = useState<ModeloBusSummaryDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PreventivePlanDto | undefined>()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [planResult, busResult, modelResult] = await Promise.all([
        listPreventivePlans(),
        listBuses({ limite: 100, pagina: 1 }),
        listModelosBus(),
      ])
      setPlans(planResult.planes)
      setBuses(busResult.buses)
      setModels(modelResult.modelosBus)
    } catch (loadError) {
      setError(messageFrom(loadError))
    }
  }, [])
  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(request)
  }, [load])
  async function save(input: PreventivePlanInput) {
    setSaving(true)
    setError(null)
    try {
      if (editing) await createPreventivePlanVersion(editing.id, input)
      else await createPreventivePlan(input)
      setFeedback(editing ? 'Nueva version registrada.' : 'Plan preventivo registrado.')
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
    try {
      await deactivatePreventivePlan(plan.id)
      setFeedback(`Plan ${plan.claveTarea} inactivado.`)
      await load()
    } catch (operationError) {
      setError(messageFrom(operationError))
    } finally {
      setSaving(false)
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
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h3 className="font-semibold">Planes preventivos recurrentes</h3>
          <p className="mt-1 text-sm text-slate-500">Versiones y alcance por bus o modelo.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setShowForm(true)
          }}
        >
          Crear plan
        </Button>
      </div>
      {feedback && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</p>
      )}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {plans?.length === 0 ? (
        <StatePanel
          description="Cree el primer plan preventivo para comenzar."
          title="Sin planes preventivos"
          tone="empty"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Tarea</th>
                <th className="px-4 py-3">Criterio</th>
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
                  <td className="px-4 py-3">v{plan.version}</td>
                  <td className="px-4 py-3">
                    {plan.bloqueaAlVencer ? <Badge tone="red">Al vencer</Badge> : 'No bloquea'}
                  </td>
                  <td className="px-4 py-3">{plan.programacionesAsociadas}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        disabled={!plan.activa || saving}
                        onClick={() => {
                          setEditing(plan)
                          setShowForm(true)
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Versionar
                      </Button>
                      <Button
                        disabled={!plan.activa || saving}
                        onClick={() => void deactivate(plan)}
                        size="sm"
                        variant="outline"
                      >
                        Inactivar
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
    </section>
  )
}
