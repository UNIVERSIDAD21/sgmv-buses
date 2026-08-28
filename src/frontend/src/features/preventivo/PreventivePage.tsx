import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  PlusCircle,
  Search,
  X,
} from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import {
  BUS_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PREVENTIVE_CRITERION_LABELS,
  PREVENTIVE_STATUS_LABELS,
} from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import { listBuses } from '../flota/fleet.api'
import type { BusSummaryDto } from '../flota/fleet.types'
import type { OrderPriority } from '../novedades/novelty.types'
import {
  createPreventiveSchedule,
  generatePreventiveOrder,
  getPreventiveSchedule,
  getPreventiveSummary,
  listPreventiveSchedules,
  type GeneratePreventiveOrderInput,
  type PreventiveScheduleInput,
  updatePreventiveSchedule,
} from './preventive.api'
import type {
  PreventiveCriterion,
  PreventiveListResponse,
  PreventiveScheduleDto,
  PreventiveStatus,
  PreventiveSummaryDto,
} from './preventive.types'

type BadgeTone = 'amber' | 'emerald' | 'red' | 'slate' | 'teal'
type SortField =
  'actividad' | 'bus' | 'createdAt' | 'estado' | 'fechaProgramada' | 'kilometrajeObjetivo'

const statusTone: Record<PreventiveStatus, BadgeTone> = {
  PROXIMO: 'amber',
  VENCIDO: 'red',
  VIGENTE: 'emerald',
}

const criterionTone: Record<PreventiveCriterion, BadgeTone> = {
  FECHA: 'teal',
  FECHA_KILOMETRAJE: 'emerald',
  KILOMETRAJE: 'amber',
}

const priorityOptions: Array<[OrderPriority, string]> = [
  ['BAJA', 'Baja'],
  ['MEDIA', 'Media'],
  ['ALTA', 'Alta'],
]

const statusOptions = Object.entries(PREVENTIVE_STATUS_LABELS) as Array<[PreventiveStatus, string]>
const criterionOptions = Object.entries(PREVENTIVE_CRITERION_LABELS) as Array<
  [PreventiveCriterion, string]
>
const sortOptions: Array<[SortField, string]> = [
  ['createdAt', 'Registro'],
  ['estado', 'Estado'],
  ['bus', 'Bus'],
  ['fechaProgramada', 'Fecha'],
  ['kilometrajeObjetivo', 'Kilometraje'],
  ['actividad', 'Actividad'],
]

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'No se pudo completar la operacion'
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function formatDateValue(value: string | null) {
  if (!value) {
    return 'No aplica'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatDateTimeValue(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getOrderStatusLabel(status: string) {
  const labels = ORDER_STATUS_LABELS as Record<string, string>

  return labels[status] ?? status
}

function StatusBadge({ status }: { status: PreventiveStatus }) {
  return <Badge tone={statusTone[status]}>{PREVENTIVE_STATUS_LABELS[status]}</Badge>
}

function CriterionBadge({ criterion }: { criterion: PreventiveCriterion }) {
  return <Badge tone={criterionTone[criterion]}>{PREVENTIVE_CRITERION_LABELS[criterion]}</Badge>
}

function FieldValue({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-800">{children}</div>
    </div>
  )
}

function ScheduleSummaryMetrics({ summary }: { summary: PreventiveSummaryDto | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <FieldValue label="Total">{summary?.total ?? '...'}</FieldValue>
      <FieldValue label="Activas">{summary?.activas ?? '...'}</FieldValue>
      <FieldValue label="Vigentes">{summary?.estados.VIGENTE ?? '...'}</FieldValue>
      <FieldValue label="Proximas">{summary?.estados.PROXIMO ?? '...'}</FieldValue>
      <FieldValue label="Vencidas">{summary?.estados.VENCIDO ?? '...'}</FieldValue>
      <FieldValue label="Ordenes activas">{summary?.ordenesActivas ?? '...'}</FieldValue>
    </div>
  )
}

function ScheduleFormDialog({
  buses,
  error,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  buses: BusSummaryDto[]
  error: string | null
  initial?: PreventiveScheduleDto
  onClose: () => void
  onSubmit: (input: PreventiveScheduleInput) => void
  submitting: boolean
}) {
  const [actividad, setActividad] = useState(initial?.actividad ?? '')
  const [activa, setActiva] = useState(initial?.activa ?? true)
  const [busId, setBusId] = useState(initial?.bus.id ?? '')
  const [criterio, setCriterio] = useState<PreventiveCriterion>(initial?.criterio ?? 'FECHA')
  const [fechaProgramada, setFechaProgramada] = useState(initial?.fechaProgramada ?? '')
  const [kilometrajeObjetivo, setKilometrajeObjetivo] = useState(
    initial?.kilometrajeObjetivo ? String(initial.kilometrajeObjetivo) : '',
  )
  const [tipo, setTipo] = useState(initial?.tipo ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const selectedBus = buses.find((bus) => bus.id === busId) ?? initial?.bus ?? null
  const requiresDate = criterio === 'FECHA' || criterio === 'FECHA_KILOMETRAJE'
  const requiresMileage = criterio === 'KILOMETRAJE' || criterio === 'FECHA_KILOMETRAJE'
  const title = initial ? 'Reprogramar mantenimiento' : 'Crear programacion preventiva'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)

    const normalizedTipo = normalizeText(tipo)
    const normalizedActividad = normalizeText(actividad)
    const targetMileage = Number(kilometrajeObjetivo)

    if (!initial && !busId) {
      setValidationError('Seleccione un bus.')
      return
    }

    if (normalizedTipo.length < 3) {
      setValidationError('El tipo debe tener al menos 3 caracteres.')
      return
    }

    if (normalizedActividad.length < 10) {
      setValidationError('La actividad debe tener al menos 10 caracteres.')
      return
    }

    if (requiresDate && !fechaProgramada) {
      setValidationError('Seleccione una fecha programada.')
      return
    }

    if (requiresMileage && (!Number.isInteger(targetMileage) || targetMileage <= 0)) {
      setValidationError('El kilometraje objetivo debe ser un entero positivo.')
      return
    }

    onSubmit({
      ...(initial ? {} : { busId }),
      ...(initial ? { activa } : {}),
      actividad: normalizedActividad,
      criterio,
      ...(requiresDate ? { fechaProgramada } : {}),
      ...(requiresMileage ? { kilometrajeObjetivo: targetMileage } : {}),
      tipo: normalizedTipo,
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <div
        aria-label={title}
        aria-modal="true"
        className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {selectedBus && (
              <p className="mt-1 text-sm text-slate-500">
                {selectedBus.codigoInterno} - {selectedBus.placa}
              </p>
            )}
          </div>
          <button
            aria-label="Cerrar formulario"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Bus
              <select
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                disabled={Boolean(initial)}
                onChange={(event) => setBusId(event.target.value)}
                value={busId}
              >
                <option value="">Seleccione bus</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.codigoInterno} - {bus.placa}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Criterio
              <select
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setCriterio(event.target.value as PreventiveCriterion)}
                value={criterio}
              >
                {criterionOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedBus && (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-3">
              <span>
                <strong className="text-slate-800">Estado:</strong>{' '}
                {BUS_STATUS_LABELS[selectedBus.estadoOperativo]}
              </span>
              <span>
                <strong className="text-slate-800">Kilometraje:</strong>{' '}
                {formatNumber(selectedBus.kilometrajeActual)} km
              </span>
              <span>
                <strong className="text-slate-800">Vehiculo:</strong> {selectedBus.marca}{' '}
                {selectedBus.modelo}
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Tipo
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setTipo(event.target.value)}
                placeholder="Ej. Cambio de aceite"
                value={tipo}
              />
            </label>
            {requiresDate && (
              <label className="block text-sm font-medium text-slate-700">
                Fecha programada
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setFechaProgramada(event.target.value)}
                  type="date"
                  value={fechaProgramada}
                />
              </label>
            )}
            {requiresMileage && (
              <label className="block text-sm font-medium text-slate-700">
                Kilometraje objetivo
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  min="1"
                  onChange={(event) => setKilometrajeObjetivo(event.target.value)}
                  type="number"
                  value={kilometrajeObjetivo}
                />
              </label>
            )}
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Actividad
            <textarea
              className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setActividad(event.target.value)}
              placeholder="Detalle de la actividad preventiva."
              value={actividad}
            />
          </label>

          {initial && (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                checked={activa}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-100"
                onChange={(event) => setActiva(event.target.checked)}
                type="checkbox"
              />
              Programacion activa
            </label>
          )}

          {(validationError || error) && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {validationError ?? error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button icon={<PlusCircle size={15} />} loading={submitting} type="submit">
              {initial ? 'Guardar cambios' : 'Registrar programacion'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GenerateOrderDialog({
  error,
  onClose,
  onSubmit,
  schedule,
  submitting,
}: {
  error: string | null
  onClose: () => void
  onSubmit: (input: GeneratePreventiveOrderInput) => void
  schedule: PreventiveScheduleDto
  submitting: boolean
}) {
  const [descripcionOrden, setDescripcionOrden] = useState('')
  const [observacion, setObservacion] = useState('')
  const [prioridad, setPrioridad] = useState<OrderPriority>('MEDIA')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    onSubmit({
      descripcionOrden: normalizeText(descripcionOrden) || undefined,
      observacion: normalizeText(observacion) || undefined,
      prioridad,
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <div
        aria-label="Generar orden preventiva"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Generar orden preventiva</h2>
            <p className="mt-1 text-sm text-slate-500">
              {schedule.bus.codigoInterno} - {schedule.tipo}
            </p>
          </div>
          <button
            aria-label="Cerrar confirmacion"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            La orden queda pendiente de asignacion. La asignacion y ejecucion tecnica pertenecen a
            RF-04.
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Prioridad
            <select
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setPrioridad(event.target.value as OrderPriority)}
              value={prioridad}
            >
              {priorityOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Descripcion de la orden
            <textarea
              className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setDescripcionOrden(event.target.value)}
              value={descripcionOrden}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Observacion
            <textarea
              className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setObservacion(event.target.value)}
              value={observacion}
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button icon={<ClipboardList size={15} />} loading={submitting} type="submit">
              Crear orden
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PreventiveDetail({
  actions,
  schedule,
}: {
  actions?: ReactNode
  schedule: PreventiveScheduleDto
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldValue label="Bus">
          {schedule.bus.codigoInterno} - {schedule.bus.placa}
        </FieldValue>
        <FieldValue label="Estado bus">
          {BUS_STATUS_LABELS[schedule.bus.estadoOperativo]}
        </FieldValue>
        <FieldValue label="Tipo">{schedule.tipo}</FieldValue>
        <FieldValue label="Criterio">
          <CriterionBadge criterion={schedule.criterio} />
        </FieldValue>
        <FieldValue label="Fecha objetivo">{formatDateValue(schedule.fechaProgramada)}</FieldValue>
        <FieldValue label="Kilometraje objetivo">
          {schedule.kilometrajeObjetivo
            ? `${formatNumber(schedule.kilometrajeObjetivo)} km`
            : 'No aplica'}
        </FieldValue>
        <FieldValue label="Kilometraje actual">
          {formatNumber(schedule.bus.kilometrajeActual)} km
        </FieldValue>
        <FieldValue label="Clasificacion">
          <StatusBadge status={schedule.clasificacion.estado} />
        </FieldValue>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Actividad</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {schedule.actividad}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FieldValue label="Dias restantes">
          {schedule.clasificacion.diasRestantes === null
            ? 'No aplica'
            : `${formatNumber(schedule.clasificacion.diasRestantes)} dias`}
        </FieldValue>
        <FieldValue label="Kilometros restantes">
          {schedule.clasificacion.kilometrosRestantes === null
            ? 'No aplica'
            : `${formatNumber(schedule.clasificacion.kilometrosRestantes)} km`}
        </FieldValue>
        <FieldValue label="Responsable">{schedule.creadaPor.nombre}</FieldValue>
        <FieldValue label="Registro">{formatDateTimeValue(schedule.createdAt)}</FieldValue>
        <FieldValue label="Actualizacion">{formatDateTimeValue(schedule.updatedAt)}</FieldValue>
        <FieldValue label="Vigencia">
          <Badge tone={schedule.activa ? 'emerald' : 'slate'}>
            {schedule.activa ? 'Activa' : 'Inactiva'}
          </Badge>
        </FieldValue>
      </section>

      {schedule.ordenActiva ? (
        <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Orden preventiva activa</h3>
              <p className="mt-1 text-sm text-slate-600">{schedule.ordenActiva.codigo}</p>
            </div>
            <Badge tone="teal">{getOrderStatusLabel(schedule.ordenActiva.estado)}</Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {schedule.ordenActiva.descripcion}
          </p>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Sin orden preventiva activa.
        </p>
      )}

      {actions}
    </div>
  )
}

export default function PreventivePage() {
  const { user } = useSession()
  const [buses, setBuses] = useState<BusSummaryDto[]>([])
  const [busId, setBusId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [criterio, setCriterio] = useState<PreventiveCriterion | ''>('')
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('desc')
  const [editingSchedule, setEditingSchedule] = useState<PreventiveScheduleDto | null>(null)
  const [estado, setEstado] = useState<PreventiveStatus | ''>('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [generatingSchedule, setGeneratingSchedule] = useState<PreventiveScheduleDto | null>(null)
  const [listData, setListData] = useState<PreventiveListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [ordenarPor, setOrdenarPor] = useState<SortField>('createdAt')
  const [pagina, setPagina] = useState(1)
  const [selectedSchedule, setSelectedSchedule] = useState<PreventiveScheduleDto | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState<PreventiveSummaryDto | null>(null)

  const isAdmin = user?.rol.codigo === 'ADMINISTRADOR'

  const refreshData = useCallback(async () => {
    if (!isAdmin) {
      return
    }

    const [summaryData, schedules, busData] = await Promise.all([
      getPreventiveSummary(),
      listPreventiveSchedules({
        busId,
        busqueda,
        criterio,
        direccion,
        estado,
        limite: 8,
        ordenarPor,
        pagina,
      }),
      listBuses({
        limite: 100,
        pagina: 1,
      }),
    ])

    setSummary(summaryData)
    setListData(schedules)
    setBuses(busData.buses)
  }, [busId, busqueda, criterio, direccion, estado, isAdmin, ordenarPor, pagina])

  useEffect(() => {
    let active = true

    async function load() {
      if (!isAdmin) {
        return
      }

      setLoading(true)
      setLoadError(null)

      try {
        const [summaryData, schedules, busData] = await Promise.all([
          getPreventiveSummary(),
          listPreventiveSchedules({
            busId,
            busqueda,
            criterio,
            direccion,
            estado,
            limite: 8,
            ordenarPor,
            pagina,
          }),
          listBuses({
            limite: 100,
            pagina: 1,
          }),
        ])

        if (active) {
          setSummary(summaryData)
          setListData(schedules)
          setBuses(busData.buses)
        }
      } catch (error) {
        if (active) {
          setLoadError(getErrorMessage(error))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [busId, busqueda, criterio, direccion, estado, isAdmin, ordenarPor, pagina])

  const totalLabel = useMemo(() => {
    if (!listData) {
      return '0 programaciones'
    }

    return `${formatNumber(listData.paginacion.total)} programacion${
      listData.paginacion.total === 1 ? '' : 'es'
    }`
  }, [listData])

  async function openDetail(programacionId: string) {
    setLoadError(null)

    try {
      const data = await getPreventiveSchedule(programacionId)

      setSelectedSchedule(data.programacion)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    }
  }

  async function refreshSelected(programacionId: string) {
    const data = await getPreventiveSchedule(programacionId)
    setSelectedSchedule(data.programacion)
  }

  async function handleScheduleSubmit(input: PreventiveScheduleInput) {
    setSubmitting(true)
    setFormError(null)
    setFeedback(null)

    try {
      if (editingSchedule) {
        const updateInput: Omit<PreventiveScheduleInput, 'busId'> = {
          activa: input.activa,
          actividad: input.actividad,
          criterio: input.criterio,
          fechaProgramada: input.fechaProgramada,
          kilometrajeObjetivo: input.kilometrajeObjetivo,
          tipo: input.tipo,
        }

        await updatePreventiveSchedule(editingSchedule.id, updateInput)
        await refreshSelected(editingSchedule.id)
        setFeedback('Programacion preventiva actualizada.')
        setEditingSchedule(null)
      } else {
        const result = await createPreventiveSchedule(input)
        setFeedback('Programacion preventiva registrada.')
        setSelectedSchedule(result.programacion)
        setShowCreateForm(false)
      }

      await refreshData()
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGenerateOrder(input: GeneratePreventiveOrderInput) {
    if (!generatingSchedule) {
      return
    }

    setSubmitting(true)
    setOperationError(null)
    setFeedback(null)

    try {
      const result = await generatePreventiveOrder(generatingSchedule.id, input)
      const code = result.orden?.codigo ?? 'registrada'

      setFeedback(
        result.yaExistia
          ? `La programacion ya tenia la orden ${code}.`
          : `Orden preventiva ${code} generada en estado pendiente de asignacion.`,
      )
      setSelectedSchedule(result.programacion)
      setGeneratingSchedule(null)
      await refreshData()
    } catch (error) {
      setOperationError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function clearFilters() {
    setBusqueda('')
    setBusId('')
    setCriterio('')
    setEstado('')
    setPagina(1)
  }

  function renderActions(schedule: PreventiveScheduleDto) {
    const canGenerate =
      schedule.activa && !schedule.ordenActiva && schedule.clasificacion.estado !== 'VIGENTE'

    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Acciones administrativas</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {!schedule.ordenActiva && (
            <Button
              icon={<Clock size={14} />}
              onClick={() => setEditingSchedule(schedule)}
              size="sm"
              variant="outline"
            >
              Reprogramar
            </Button>
          )}
          {canGenerate && (
            <Button
              icon={<ClipboardList size={14} />}
              onClick={() => setGeneratingSchedule(schedule)}
              size="sm"
              variant="secondary"
            >
              Generar orden
            </Button>
          )}
        </div>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <StatePanel
          description="Su rol no participa directamente en RF-03."
          title="Acceso denegado"
          tone="error"
        />
      </div>
    )
  }

  return (
    <div className="relative min-h-full p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <Badge tone="emerald">RF-03</Badge>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Administracion del mantenimiento preventivo
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {totalLabel} por fecha, kilometraje o criterio combinado.
              </p>
            </div>
            <Button icon={<PlusCircle size={16} />} onClick={() => setShowCreateForm(true)}>
              Crear programacion
            </Button>
          </div>
        </section>

        {feedback && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        <ScheduleSummaryMetrics summary={summary} />

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_170px_120px]">
            <label className="relative">
              <span className="sr-only">Buscar programaciones</span>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={15}
              />
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setPagina(1)
                  setBusqueda(event.target.value)
                }}
                placeholder="Buscar por actividad, tipo, placa o codigo"
                type="search"
                value={busqueda}
              />
            </label>
            <label>
              <span className="sr-only">Bus</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setPagina(1)
                  setBusId(event.target.value)
                }}
                value={busId}
              >
                <option value="">Bus</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.codigoInterno}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Criterio</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setPagina(1)
                  setCriterio(event.target.value as PreventiveCriterion | '')
                }}
                value={criterio}
              >
                <option value="">Criterio</option>
                {criterionOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Ordenar por</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setOrdenarPor(event.target.value as SortField)}
                value={ordenarPor}
              >
                {sortOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Direccion</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setDireccion(event.target.value as 'asc' | 'desc')}
                value={direccion}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={clearFilters} size="sm" variant="outline">
              Limpiar
            </Button>
            <Button
              onClick={() => {
                setPagina(1)
                setEstado('')
              }}
              size="sm"
              variant={estado === '' ? 'secondary' : 'outline'}
            >
              Todas
            </Button>
            {statusOptions.map(([value, label]) => (
              <Button
                key={value}
                onClick={() => {
                  setPagina(1)
                  setEstado(value)
                }}
                size="sm"
                variant={estado === value ? 'secondary' : 'outline'}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>

        {loading && (
          <StatePanel
            description="Consultando programaciones preventivas."
            title="Cargando programaciones"
            tone="loading"
          />
        )}

        {loadError && !loading && (
          <StatePanel description={loadError} title="No fue posible cargar" tone="error" />
        )}

        {!loading && !loadError && listData?.programaciones.length === 0 && (
          <StatePanel
            action={
              <Button onClick={clearFilters} variant="outline">
                Limpiar filtros
              </Button>
            }
            description="No hay programaciones que coincidan con los filtros actuales."
            title="Sin resultados"
            tone="empty"
          />
        )}

        {!loading && !loadError && listData && listData.programaciones.length > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {listData.programaciones.map((schedule) => (
                <article
                  className="rounded-lg border border-slate-200 bg-white p-4"
                  key={schedule.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{schedule.bus.codigoInterno}</p>
                      <p className="mt-1 text-xs text-slate-500">{schedule.bus.placa}</p>
                    </div>
                    <StatusBadge status={schedule.clasificacion.estado} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">{schedule.tipo}</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-slate-400">
                        Criterio
                      </span>
                      <CriterionBadge criterion={schedule.criterio} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-slate-400">Fecha</span>
                      <span>{formatDateValue(schedule.fechaProgramada)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-slate-400">
                        Kilometraje
                      </span>
                      <span>
                        {schedule.kilometrajeObjetivo
                          ? `${formatNumber(schedule.kilometrajeObjetivo)} km`
                          : 'No aplica'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-slate-400">Orden</span>
                      <span className="text-right">
                        {schedule.ordenActiva ? schedule.ordenActiva.codigo : 'Sin orden'}
                      </span>
                    </div>
                  </div>
                  <Button
                    className="mt-4 w-full"
                    icon={<ClipboardList size={14} />}
                    onClick={() => openDetail(schedule.id)}
                    size="sm"
                    variant="outline"
                  >
                    Detalle
                  </Button>
                </article>
              ))}
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm text-slate-500">
                  Pagina {listData.paginacion.pagina} de {listData.paginacion.totalPaginas}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={pagina <= 1}
                    icon={<ChevronLeft size={14} />}
                    onClick={() => setPagina((current) => Math.max(1, current - 1))}
                    size="sm"
                    variant="outline"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={pagina >= listData.paginacion.totalPaginas}
                    icon={<ChevronRight size={14} />}
                    onClick={() => setPagina((current) => current + 1)}
                    size="sm"
                    variant="outline"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Bus</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Criterio</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3 text-right">Kilometraje</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Orden</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listData.programaciones.map((schedule) => (
                      <tr className="align-top" key={schedule.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {schedule.bus.codigoInterno}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{schedule.bus.placa}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{schedule.tipo}</td>
                        <td className="px-4 py-3">
                          <CriterionBadge criterion={schedule.criterio} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDateValue(schedule.fechaProgramada)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {schedule.kilometrajeObjetivo
                            ? `${formatNumber(schedule.kilometrajeObjetivo)} km`
                            : 'No aplica'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={schedule.clasificacion.estado} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {schedule.ordenActiva ? schedule.ordenActiva.codigo : 'Sin orden'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button
                              icon={<ClipboardList size={14} />}
                              onClick={() => openDetail(schedule.id)}
                              size="sm"
                              variant="outline"
                            >
                              Detalle
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Pagina {listData.paginacion.pagina} de {listData.paginacion.totalPaginas}
                </p>
                <div className="flex gap-2">
                  <Button
                    disabled={pagina <= 1}
                    icon={<ChevronLeft size={14} />}
                    onClick={() => setPagina((current) => Math.max(1, current - 1))}
                    size="sm"
                    variant="outline"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={pagina >= listData.paginacion.totalPaginas}
                    icon={<ChevronRight size={14} />}
                    onClick={() => setPagina((current) => current + 1)}
                    size="sm"
                    variant="outline"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        <Drawer
          onClose={() => setSelectedSchedule(null)}
          open={Boolean(selectedSchedule)}
          subtitle={
            selectedSchedule
              ? `${selectedSchedule.bus.codigoInterno} - ${selectedSchedule.tipo}`
              : undefined
          }
          title="Detalle preventivo"
        >
          {selectedSchedule && (
            <PreventiveDetail
              actions={renderActions(selectedSchedule)}
              schedule={selectedSchedule}
            />
          )}
        </Drawer>

        {showCreateForm && (
          <ScheduleFormDialog
            buses={buses}
            error={formError}
            onClose={() => {
              setShowCreateForm(false)
              setFormError(null)
            }}
            onSubmit={handleScheduleSubmit}
            submitting={submitting}
          />
        )}

        {editingSchedule && (
          <ScheduleFormDialog
            buses={buses}
            error={formError}
            initial={editingSchedule}
            key={editingSchedule.id}
            onClose={() => {
              setEditingSchedule(null)
              setFormError(null)
            }}
            onSubmit={handleScheduleSubmit}
            submitting={submitting}
          />
        )}

        {generatingSchedule && (
          <GenerateOrderDialog
            error={operationError}
            onClose={() => {
              setGeneratingSchedule(null)
              setOperationError(null)
            }}
            onSubmit={handleGenerateOrder}
            schedule={generatingSchedule}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}
