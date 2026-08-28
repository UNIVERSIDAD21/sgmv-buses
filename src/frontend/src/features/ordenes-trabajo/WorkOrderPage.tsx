import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Package,
  PlusCircle,
  Search,
  User,
  Wrench,
  X,
} from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import { BUS_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatCurrency, formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import { listBuses } from '../flota/fleet.api'
import type { BusSummaryDto } from '../flota/fleet.types'
import type { OrderPriority } from '../novedades/novelty.types'
import {
  assignWorkOrder,
  closeWorkOrder,
  completeWorkOrder,
  createManualWorkOrder,
  createWorkOrderActivity,
  createWorkOrderConsumption,
  getAvailableMechanics,
  getAvailableSpareParts,
  getWorkOrder,
  getWorkOrderSummary,
  listMyWorkOrders,
  listWorkOrders,
  reassignWorkOrder,
  resumeWorkOrder,
  returnWorkOrder,
  startWorkOrder,
  updateWorkOrderIntervention,
  type AssignWorkOrderInput,
  type CreateManualWorkOrderInput,
  type ReassignWorkOrderInput,
} from './work-order.api'
import type {
  AvailableSparePartDto,
  MechanicOptionDto,
  WorkOrderDetailDto,
  WorkOrderListResponse,
  WorkOrderOrigin,
  WorkOrderStatus,
  WorkOrderSummaryDto,
  WorkOrderSummaryItemDto,
  WorkOrderType,
} from './work-order.types'

type BadgeTone = 'amber' | 'emerald' | 'red' | 'slate' | 'teal'
type SortField =
  'bus' | 'codigo' | 'costoTotal' | 'estado' | 'fechaCierre' | 'fechaCreacion' | 'prioridad'
type AssignmentMode = 'assign' | 'reassign'

interface AssignmentAction {
  mode: AssignmentMode
  order: WorkOrderDetailDto
}

const statusLabels: Record<WorkOrderStatus, string> = {
  ASIGNADA: 'Asignada',
  CERRADA: 'Cerrada',
  COMPLETADA_TECNICO: 'Completada tecnicamente',
  DEVUELTA_CORRECCION: 'Devuelta a correccion',
  EN_EJECUCION: 'En ejecucion',
  PENDIENTE_ASIGNACION: 'Pendiente de asignacion',
}

const typeLabels: Record<WorkOrderType, string> = {
  CORRECTIVA: 'Correctiva',
  PREVENTIVA: 'Preventiva',
}

const originLabels: Record<WorkOrderOrigin, string> = {
  CORRECTIVO_DIRECTO: 'Correctiva directa',
  NOVEDAD: 'Novedad',
  PREVENTIVO: 'Preventivo',
}

const priorityLabels: Record<OrderPriority, string> = {
  ALTA: 'Alta',
  BAJA: 'Baja',
  MEDIA: 'Media',
}

const statusTone: Record<WorkOrderStatus, BadgeTone> = {
  ASIGNADA: 'teal',
  CERRADA: 'slate',
  COMPLETADA_TECNICO: 'emerald',
  DEVUELTA_CORRECCION: 'amber',
  EN_EJECUCION: 'teal',
  PENDIENTE_ASIGNACION: 'amber',
}

const typeTone: Record<WorkOrderType, BadgeTone> = {
  CORRECTIVA: 'red',
  PREVENTIVA: 'emerald',
}

const priorityTone: Record<OrderPriority, BadgeTone> = {
  ALTA: 'red',
  BAJA: 'slate',
  MEDIA: 'amber',
}

const statusOptions = Object.entries(statusLabels) as Array<[WorkOrderStatus, string]>
const typeOptions = Object.entries(typeLabels) as Array<[WorkOrderType, string]>
const originOptions = Object.entries(originLabels) as Array<[WorkOrderOrigin, string]>
const priorityOptions = Object.entries(priorityLabels) as Array<[OrderPriority, string]>
const sortOptions: Array<[SortField, string]> = [
  ['fechaCreacion', 'Registro'],
  ['codigo', 'Codigo'],
  ['estado', 'Estado'],
  ['prioridad', 'Prioridad'],
  ['fechaCierre', 'Cierre'],
  ['costoTotal', 'Costo'],
  ['bus', 'Bus'],
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

function formatDateTimeValue(value: string | null) {
  if (!value) {
    return 'Pendiente'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function FieldValue({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-800">{children}</div>
    </div>
  )
}

function TimelineEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
      {text}
    </p>
  )
}

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabels[status]}</Badge>
}

function TypeBadge({ type }: { type: WorkOrderType }) {
  return <Badge tone={typeTone[type]}>{typeLabels[type]}</Badge>
}

function OriginBadge({ origin }: { origin: WorkOrderOrigin }) {
  return <Badge tone="teal">{originLabels[origin]}</Badge>
}

function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return <Badge tone={priorityTone[priority]}>{priorityLabels[priority]}</Badge>
}

function Pagination({
  onNext,
  onPrev,
  pagina,
  totalPaginas,
}: {
  onNext: () => void
  onPrev: () => void
  pagina: number
  totalPaginas: number
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Pagina {pagina} de {totalPaginas}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={pagina <= 1}
          icon={<ChevronLeft size={14} />}
          onClick={onPrev}
          size="sm"
          variant="outline"
        >
          Anterior
        </Button>
        <Button
          disabled={pagina >= totalPaginas}
          icon={<ChevronRight size={14} />}
          onClick={onNext}
          size="sm"
          variant="outline"
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}

function ModalFrame({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode
  onClose: () => void
  subtitle?: string
  title: string
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <div
        aria-label={title}
        aria-modal="true"
        className="w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            aria-label="Cerrar dialogo"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ManualOrderDialog({
  buses,
  error,
  onClose,
  onSubmit,
  submitting,
}: {
  buses: BusSummaryDto[]
  error: string | null
  onClose: () => void
  onSubmit: (input: CreateManualWorkOrderInput) => void
  submitting: boolean
}) {
  const [busId, setBusId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [prioridad, setPrioridad] = useState<OrderPriority>('MEDIA')
  const [validationError, setValidationError] = useState<string | null>(null)
  const selectedBus = buses.find((bus) => bus.id === busId) ?? null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)

    const normalizedDescription = normalizeText(descripcion)

    if (!busId) {
      setValidationError('Seleccione un bus.')
      return
    }

    if (normalizedDescription.length < 10) {
      setValidationError('La descripcion debe tener al menos 10 caracteres.')
      return
    }

    onSubmit({
      busId,
      descripcion: normalizedDescription,
      prioridad,
      tipo: 'CORRECTIVA',
    })
  }

  return (
    <ModalFrame onClose={onClose} title="Crear orden manual">
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Bus
            <select
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
        </div>

        {selectedBus && (
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-3">
            <span>
              <strong className="text-slate-800">Estado:</strong>{' '}
              {BUS_STATUS_LABELS[selectedBus.estadoOperativo]}
            </span>
            <span>
              <strong className="text-slate-800">Km:</strong>{' '}
              {formatNumber(selectedBus.kilometrajeActual)}
            </span>
            <span>
              <strong className="text-slate-800">Vehiculo:</strong> {selectedBus.marca}{' '}
              {selectedBus.modelo}
            </span>
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Tipo
          <select
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
            disabled
            value="CORRECTIVA"
          >
            <option value="CORRECTIVA">Correctiva directa</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Descripcion
          <textarea
            className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Motivo de la orden correctiva directa."
            value={descripcion}
          />
        </label>

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
            Crear orden
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

function AssignmentDialog({
  action,
  error,
  mechanics,
  onClose,
  onSubmit,
  submitting,
}: {
  action: AssignmentAction
  error: string | null
  mechanics: MechanicOptionDto[]
  onClose: () => void
  onSubmit: (input: AssignWorkOrderInput | ReassignWorkOrderInput, mode: AssignmentMode) => void
  submitting: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const [tecnicoId, setTecnicoId] = useState(action.order.tecnicoAsignado?.id ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const title = action.mode === 'assign' ? 'Asignar mecanico' : 'Reasignar mecanico'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)

    if (!tecnicoId) {
      setValidationError('Seleccione un mecanico.')
      return
    }

    const normalizedReason = normalizeText(motivo)

    if (action.mode === 'reassign' && normalizedReason.length < 3) {
      setValidationError('El motivo de reasignacion es obligatorio.')
      return
    }

    onSubmit(
      action.mode === 'assign'
        ? { observacion: normalizedReason || undefined, tecnicoId }
        : { motivo: normalizedReason, tecnicoId },
      action.mode,
    )
  }

  return (
    <ModalFrame onClose={onClose} subtitle={action.order.codigo} title={title}>
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Mecanico
          <select
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setTecnicoId(event.target.value)}
            value={tecnicoId}
          >
            <option value="">Seleccione mecanico</option>
            {mechanics.map((mechanic) => (
              <option key={mechanic.id} value={mechanic.id}>
                {mechanic.nombre} - {mechanic.email}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {action.mode === 'assign' ? 'Observacion' : 'Motivo de reasignacion'}
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            aria-required={action.mode === 'reassign'}
            onChange={(event) => setMotivo(event.target.value)}
            value={motivo}
          />
        </label>

        {(validationError || error) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError ?? error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
            Cancelar
          </Button>
          <Button icon={<User size={15} />} loading={submitting} type="submit">
            {action.mode === 'assign' ? 'Asignar' : 'Reasignar'}
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

function ReturnDialog({
  error,
  onClose,
  onSubmit,
  order,
  submitting,
}: {
  error: string | null
  onClose: () => void
  onSubmit: (motivo: string) => void
  order: WorkOrderDetailDto
  submitting: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)

    const normalizedReason = normalizeText(motivo)

    if (normalizedReason.length < 3) {
      setValidationError('El motivo de devolucion es obligatorio.')
      return
    }

    onSubmit(normalizedReason)
  }

  return (
    <ModalFrame onClose={onClose} subtitle={order.codigo} title="Devolver orden">
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          La orden volvera al mecanico asignado para una nueva intervencion de correccion.
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Motivo de devolucion
          <textarea
            className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setMotivo(event.target.value)}
            value={motivo}
          />
        </label>
        {(validationError || error) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError ?? error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
            Cancelar
          </Button>
          <Button
            icon={<AlertTriangle size={15} />}
            loading={submitting}
            type="submit"
            variant="danger"
          >
            Devolver
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

function CloseDialog({
  error,
  onClose,
  onSubmit,
  order,
  submitting,
}: {
  error: string | null
  onClose: () => void
  onSubmit: (observacion?: string) => void
  order: WorkOrderDetailDto
  submitting: boolean
}) {
  const [confirm, setConfirm] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)

    if (!confirm) {
      setValidationError('Confirme el cierre administrativo.')
      return
    }

    onSubmit(normalizeText(observacion) || undefined)
  }

  return (
    <ModalFrame onClose={onClose} subtitle={order.codigo} title="Cerrar orden">
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Costo basico validado: {formatCurrency(order.costoTotal)}. El estado cerrado es terminal.
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Observacion de cierre
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setObservacion(event.target.value)}
            value={observacion}
          />
        </label>
        <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
          <input
            checked={confirm}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-100"
            onChange={(event) => setConfirm(event.target.checked)}
            type="checkbox"
          />
          Confirmo que la orden fue revisada y puede cerrarse administrativamente.
        </label>
        {(validationError || error) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError ?? error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
            Cancelar
          </Button>
          <Button icon={<CheckCircle size={15} />} loading={submitting} type="submit">
            Cerrar orden
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

function WorkOrderCard({
  onOpen,
  order,
}: {
  onOpen: (orderId: string) => void
  order: WorkOrderSummaryItemDto
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-900">{order.codigo}</p>
          <p className="mt-1 text-xs text-slate-500">
            {order.bus.codigoInterno} - {order.bus.placa}
          </p>
        </div>
        <StatusBadge status={order.estado} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{order.descripcion}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <TypeBadge type={order.tipo} />
        <OriginBadge origin={order.origen} />
        <PriorityBadge priority={order.prioridad} />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500">
          {order.tecnicoAsignado?.nombre ?? 'Sin mecanico'}
        </span>
        <Button
          icon={<ClipboardList size={14} />}
          onClick={() => onOpen(order.id)}
          size="sm"
          variant="outline"
        >
          Detalle
        </Button>
      </div>
    </article>
  )
}

function TechnicalPanel({
  onFeedback,
  onOrderChange,
  order,
  submitting,
}: {
  onFeedback: (message: string) => void
  onOrderChange: (order: WorkOrderDetailDto) => void
  order: WorkOrderDetailDto
  submitting: boolean
}) {
  const activeIntervention = order.intervenciones.find((intervention) => !intervention.fechaFin)
  const [actividad, setActividad] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [diagnostico, setDiagnostico] = useState(activeIntervention?.diagnostico ?? '')
  const [error, setError] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState(activeIntervention?.observaciones ?? '')
  const [parts, setParts] = useState<AvailableSparePartDto[]>([])
  const [partsLoading, setPartsLoading] = useState(false)
  const [partsSearch, setPartsSearch] = useState('')
  const [repuestoId, setRepuestoId] = useState('')
  const [technicalSubmitting, setTechnicalSubmitting] = useState(false)
  const isBusy = submitting || technicalSubmitting

  useEffect(() => {
    if (!order.acciones.puedeRegistrarTecnica) {
      return
    }

    let active = true

    async function loadParts() {
      setPartsLoading(true)

      try {
        const result = await getAvailableSpareParts(order.id, partsSearch)

        if (active) {
          setParts(result.repuestos)
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError))
        }
      } finally {
        if (active) {
          setPartsLoading(false)
        }
      }
    }

    loadParts()

    return () => {
      active = false
    }
  }, [order.acciones.puedeRegistrarTecnica, order.id, partsSearch])

  async function runOperation(
    operation: Promise<{ orden: WorkOrderDetailDto }>,
    successMessage: string,
  ) {
    setError(null)
    setTechnicalSubmitting(true)

    try {
      const result = await operation

      onOrderChange(result.orden)
      onFeedback(successMessage)
      setCompleteConfirmOpen(false)
    } catch (operationError) {
      setError(getErrorMessage(operationError))
    } finally {
      setTechnicalSubmitting(false)
    }
  }

  function handleInterventionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedDiagnosis = normalizeText(diagnostico)
    const normalizedObservations = normalizeText(observaciones)

    if (!normalizedDiagnosis && !normalizedObservations) {
      setError('Registre diagnostico u observaciones.')
      return
    }

    runOperation(
      updateWorkOrderIntervention(order.id, {
        ...(normalizedDiagnosis ? { diagnostico: normalizedDiagnosis } : {}),
        ...(normalizedObservations ? { observaciones: normalizedObservations } : {}),
      }),
      'Intervencion actualizada.',
    )
  }

  function handleActivitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedActivity = normalizeText(actividad)

    if (normalizedActivity.length < 3) {
      setError('La actividad debe tener al menos 3 caracteres.')
      return
    }

    runOperation(
      createWorkOrderActivity(order.id, { descripcion: normalizedActivity }),
      'Actividad registrada.',
    )
    setActividad('')
  }

  function handleConsumptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!repuestoId) {
      setError('Seleccione un repuesto.')
      return
    }

    if (!Number(cantidad) || Number(cantidad) <= 0) {
      setError('La cantidad debe ser mayor que cero.')
      return
    }

    runOperation(
      createWorkOrderConsumption(order.id, {
        cantidad,
        claveIdempotencia: idempotencyKey(),
        repuestoId,
      }),
      'Consumo registrado.',
    )
    setCantidad('')
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Ejecucion tecnica</h3>
          <p className="mt-1 text-sm text-slate-500">
            {order.motivoDevolucionActual ?? 'Acciones disponibles para el mecanico asignado.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.acciones.puedeIniciar && (
            <Button
              icon={<Clock size={14} />}
              loading={isBusy}
              onClick={() => runOperation(startWorkOrder(order.id), 'Ejecucion iniciada.')}
              size="sm"
            >
              Iniciar
            </Button>
          )}
          {order.acciones.puedeReanudar && (
            <Button
              icon={<Wrench size={14} />}
              loading={isBusy}
              onClick={() => runOperation(resumeWorkOrder(order.id), 'Orden reanudada.')}
              size="sm"
            >
              Reanudar
            </Button>
          )}
          {order.acciones.puedeCompletar && (
            <Button
              icon={<CheckCircle size={14} />}
              loading={isBusy}
              onClick={() => setCompleteConfirmOpen(true)}
              size="sm"
              variant="secondary"
            >
              Completar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {order.acciones.puedeRegistrarTecnica ? (
        <>
          <form className="grid gap-3" onSubmit={handleInterventionSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Diagnostico
              <textarea
                className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setDiagnostico(event.target.value)}
                value={diagnostico}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Observaciones tecnicas
              <textarea
                className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setObservaciones(event.target.value)}
                value={observaciones}
              />
            </label>
            <div className="flex justify-end">
              <Button icon={<Wrench size={14} />} loading={isBusy} size="sm" type="submit">
                Guardar tecnica
              </Button>
            </div>
          </form>

          <form
            className="grid gap-3 border-t border-slate-100 pt-4"
            onSubmit={handleActivitySubmit}
          >
            <label className="block text-sm font-medium text-slate-700">
              Actividad realizada
              <textarea
                className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setActividad(event.target.value)}
                value={actividad}
              />
            </label>
            <div className="flex justify-end">
              <Button icon={<Activity size={14} />} loading={isBusy} size="sm" type="submit">
                Registrar actividad
              </Button>
            </div>
          </form>

          <form
            className="grid gap-3 border-t border-slate-100 pt-4"
            onSubmit={handleConsumptionSubmit}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <label className="block text-sm font-medium text-slate-700">
                Buscar repuesto
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setPartsSearch(event.target.value)}
                  placeholder="Codigo, nombre o categoria"
                  value={partsSearch}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Cantidad
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  min="0.01"
                  onChange={(event) => setCantidad(event.target.value)}
                  step="0.01"
                  type="number"
                  value={cantidad}
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Repuesto
              <select
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setRepuestoId(event.target.value)}
                value={repuestoId}
              >
                <option value="">{partsLoading ? 'Cargando...' : 'Seleccione repuesto'}</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.codigo} - {part.nombre} - stock {part.stockActual}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end">
              <Button icon={<Package size={14} />} loading={isBusy} size="sm" type="submit">
                Registrar consumo
              </Button>
            </div>
          </form>
        </>
      ) : (
        <TimelineEmpty text="La orden no esta en un estado editable para el mecanico asignado." />
      )}

      {completeConfirmOpen && (
        <ModalFrame
          onClose={() => setCompleteConfirmOpen(false)}
          subtitle={order.codigo}
          title="Completar orden"
        >
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
              La orden quedara en revision administrativa y no aceptara nuevas actividades ni
              consumos hasta que el Administrador la devuelva para correccion.
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                disabled={isBusy}
                onClick={() => setCompleteConfirmOpen(false)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                icon={<CheckCircle size={15} />}
                loading={isBusy}
                onClick={() =>
                  runOperation(completeWorkOrder(order.id), 'Orden completada tecnicamente.')
                }
                type="button"
                variant="secondary"
              >
                Confirmar completado
              </Button>
            </div>
          </div>
        </ModalFrame>
      )}
    </section>
  )
}

function WorkOrderDetail({
  isAdmin,
  isMechanic,
  onAssign,
  onCloseOrder,
  onFeedback,
  onOrderChange,
  onReturn,
  order,
  submitting,
}: {
  isAdmin: boolean
  isMechanic: boolean
  onAssign: (action: AssignmentAction) => void
  onCloseOrder: (order: WorkOrderDetailDto) => void
  onFeedback: (message: string) => void
  onOrderChange: (order: WorkOrderDetailDto) => void
  onReturn: (order: WorkOrderDetailDto) => void
  order: WorkOrderDetailDto
  submitting: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldValue label="Codigo">{order.codigo}</FieldValue>
        <FieldValue label="Estado">
          <StatusBadge status={order.estado} />
        </FieldValue>
        <FieldValue label="Bus">
          {order.bus.codigoInterno} - {order.bus.placa}
        </FieldValue>
        <FieldValue label="Estado bus">{BUS_STATUS_LABELS[order.bus.estadoOperativo]}</FieldValue>
        <FieldValue label="Tipo">
          <TypeBadge type={order.tipo} />
        </FieldValue>
        <FieldValue label="Origen">
          <OriginBadge origin={order.origen} />
        </FieldValue>
        <FieldValue label="Prioridad">
          <PriorityBadge priority={order.prioridad} />
        </FieldValue>
        <FieldValue label="Mecanico actual">
          {order.tecnicoAsignado?.nombre ?? 'Sin asignar'}
        </FieldValue>
        <FieldValue label="Creacion">{formatDateTimeValue(order.fechaCreacion)}</FieldValue>
        <FieldValue label="Cierre">{formatDateTimeValue(order.fechaCierre)}</FieldValue>
      </div>

      {order.motivoDevolucionActual && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Motivo de devolucion</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-amber-800">
            {order.motivoDevolucionActual}
          </p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Descripcion</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {order.descripcion}
        </p>
      </section>

      {(order.novedad || order.programacionMantenimiento) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {order.novedad && (
            <FieldValue label="Novedad">
              {order.novedad.tipo} - {order.novedad.clasificacion ?? order.novedad.estado}
            </FieldValue>
          )}
          {order.programacionMantenimiento && (
            <FieldValue label="Programacion">
              {order.programacionMantenimiento.tipo} - {order.programacionMantenimiento.criterio}
            </FieldValue>
          )}
          {order.fechaObjetivoPreventivo && (
            <FieldValue label="Fecha objetivo">
              {formatDateValue(order.fechaObjetivoPreventivo)}
            </FieldValue>
          )}
          {order.kilometrajeObjetivoPreventivo && (
            <FieldValue label="Km objetivo">
              {formatNumber(order.kilometrajeObjetivoPreventivo)} km
            </FieldValue>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase text-slate-500">
            Acciones administrativas
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {order.acciones.puedeAsignar && (
              <Button
                icon={<User size={14} />}
                onClick={() => onAssign({ mode: 'assign', order })}
                size="sm"
                variant="outline"
              >
                Asignar
              </Button>
            )}
            {order.acciones.puedeReasignar && (
              <Button
                icon={<User size={14} />}
                onClick={() => onAssign({ mode: 'reassign', order })}
                size="sm"
                variant="outline"
              >
                Reasignar
              </Button>
            )}
            {order.acciones.puedeDevolver && (
              <Button
                icon={<AlertTriangle size={14} />}
                onClick={() => onReturn(order)}
                size="sm"
                variant="outline"
              >
                Devolver
              </Button>
            )}
            {order.acciones.puedeCerrar && (
              <Button
                icon={<CheckCircle size={14} />}
                onClick={() => onCloseOrder(order)}
                size="sm"
                variant="secondary"
              >
                Cerrar
              </Button>
            )}
            {!order.acciones.puedeAsignar &&
              !order.acciones.puedeReasignar &&
              !order.acciones.puedeDevolver &&
              !order.acciones.puedeCerrar && (
                <p className="text-sm text-slate-500">
                  No hay acciones administrativas disponibles.
                </p>
              )}
          </div>
        </section>
      )}

      {isMechanic && (
        <TechnicalPanel
          key={`${order.id}-${order.intervenciones.find((intervention) => !intervention.fechaFin)?.id ?? 'no-active'}`}
          onFeedback={onFeedback}
          onOrderChange={onOrderChange}
          order={order}
          submitting={submitting}
        />
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <FieldValue label="Costo basico">{formatCurrency(order.costoTotal)}</FieldValue>
        <FieldValue label="Responsable cierre">
          {order.cerradaPor?.nombre ?? 'Sin cierre administrativo'}
        </FieldValue>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Intervenciones</h3>
        {order.intervenciones.length === 0 ? (
          <div className="mt-3">
            <TimelineEmpty text="Aun no hay intervenciones registradas." />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {order.intervenciones.map((intervention) => (
              <article className="rounded-lg bg-slate-50 p-3" key={intervention.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {intervention.tecnico.nombre}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTimeValue(intervention.fechaInicio)} -{' '}
                    {intervention.fechaFin ? formatDateTimeValue(intervention.fechaFin) : 'Activa'}
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Diagnostico: {intervention.diagnostico ?? 'Sin diagnostico'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Observaciones: {intervention.observaciones ?? 'Sin observaciones'}
                </p>
                {intervention.actividades.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {intervention.actividades.map((activity) => (
                      <li
                        className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
                        key={activity.id}
                      >
                        {activity.descripcion}
                        <span className="mt-1 block text-xs text-slate-400">
                          {formatDateTimeValue(activity.fechaRegistro)} -{' '}
                          {activity.registradaPor.nombre}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Consumos y costo</h3>
        {order.consumosRepuesto.length === 0 ? (
          <div className="mt-3">
            <TimelineEmpty text="No se han registrado consumos de repuestos." />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {order.consumosRepuesto.map((consumption) => (
              <div
                className="grid gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:grid-cols-[1fr_90px_110px]"
                key={consumption.id}
              >
                <span>
                  {consumption.repuesto.codigo} - {consumption.repuesto.nombre}
                </span>
                <span>{consumption.cantidad}</span>
                <span className="font-semibold">{formatCurrency(consumption.subtotal)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Historial de estados</h3>
        <div className="mt-3 space-y-2">
          {order.historialEstados.map((history) => (
            <div
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
              key={history.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {history.estadoAnterior ? statusLabels[history.estadoAnterior] : 'Creacion'} -{' '}
                  {statusLabels[history.estadoNuevo]}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDateTimeValue(history.fechaCambio)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {history.cambiadoPor.nombre}
                {history.observacion ? `: ${history.observacion}` : ''}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Reasignaciones</h3>
        {order.reasignaciones.length === 0 ? (
          <div className="mt-3">
            <TimelineEmpty text="Sin reasignaciones registradas." />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {order.reasignaciones.map((reassignment) => (
              <div
                className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                key={reassignment.id}
              >
                {reassignment.tecnicoAnterior?.nombre ?? 'Sin mecanico'} -{' '}
                {reassignment.tecnicoNuevo.nombre}
                <span className="mt-1 block text-xs text-slate-500">
                  {formatDateTimeValue(reassignment.fechaReasignacion)} - {reassignment.motivo}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">
          Historial tecnico del bus
        </h3>
        {order.historialTecnicoBus.length === 0 ? (
          <div className="mt-3">
            <TimelineEmpty text="Sin ordenes cerradas previas para este bus." />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {order.historialTecnicoBus.map((item) => (
              <div
                className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                key={item.id}
              >
                {item.codigo} - {typeLabels[item.tipo]}
                <span className="mt-1 block text-xs text-slate-500">
                  {formatDateTimeValue(item.fechaCierre)} - {item.diagnostico ?? 'Sin diagnostico'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryMetrics({
  isAdmin,
  summary,
}: {
  isAdmin: boolean
  summary: WorkOrderSummaryDto | null
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <FieldValue label="Total">{summary?.total ?? '...'}</FieldValue>
      <FieldValue label="Activas">{summary?.activas ?? '...'}</FieldValue>
      <FieldValue label={isAdmin ? 'Por asignar' : 'Asignadas'}>
        {isAdmin
          ? (summary?.pendientesAsignacion ?? '...')
          : (summary?.porEstado.ASIGNADA ?? '...')}
      </FieldValue>
      <FieldValue label="En ejecucion">{summary?.porEstado.EN_EJECUCION ?? '...'}</FieldValue>
      <FieldValue label={isAdmin ? 'Revision' : 'Devueltas'}>
        {isAdmin
          ? (summary?.pendientesRevision ?? '...')
          : (summary?.porEstado.DEVUELTA_CORRECCION ?? '...')}
      </FieldValue>
      <FieldValue label="Cerradas">{summary?.porEstado.CERRADA ?? '...'}</FieldValue>
    </div>
  )
}

export default function WorkOrderPage() {
  const { user } = useSession()
  const [assignmentAction, setAssignmentAction] = useState<AssignmentAction | null>(null)
  const [buses, setBuses] = useState<BusSummaryDto[]>([])
  const [busId, setBusId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [closeAction, setCloseAction] = useState<WorkOrderDetailDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('desc')
  const [estado, setEstado] = useState<WorkOrderStatus | ''>('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [listData, setListData] = useState<WorkOrderListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mechanics, setMechanics] = useState<MechanicOptionDto[]>([])
  const [ordenarPor, setOrdenarPor] = useState<SortField>('fechaCreacion')
  const [origen, setOrigen] = useState<WorkOrderOrigin | ''>('')
  const [pagina, setPagina] = useState(1)
  const [returnAction, setReturnAction] = useState<WorkOrderDetailDto | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderDetailDto | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState<WorkOrderSummaryDto | null>(null)
  const [tecnicoId, setTecnicoId] = useState('')
  const [tipo, setTipo] = useState<WorkOrderType | ''>('')

  const isAdmin = user?.rol.codigo === 'ADMINISTRADOR'
  const isMechanic = user?.rol.codigo === 'MECANICO'

  const listParams = useMemo(
    () => ({
      busId,
      busqueda,
      direccion,
      estado,
      limite: 8,
      ordenarPor,
      origen,
      pagina,
      tecnicoId: isAdmin ? tecnicoId : '',
      tipo,
    }),
    [busId, busqueda, direccion, estado, isAdmin, ordenarPor, origen, pagina, tecnicoId, tipo],
  )

  const refreshData = useCallback(async () => {
    const [summaryData, listResponse] = await Promise.all([
      getWorkOrderSummary(),
      isAdmin ? listWorkOrders(listParams) : listMyWorkOrders(listParams),
    ])

    setSummary(summaryData)
    setListData(listResponse)

    if (isAdmin) {
      const [busResponse, mechanicResponse] = await Promise.all([
        listBuses({ limite: 100, pagina: 1 }),
        getAvailableMechanics(),
      ])

      setBuses(busResponse.buses)
      setMechanics(mechanicResponse.mecanicos)
    }
  }, [isAdmin, listParams])

  useEffect(() => {
    let active = true

    async function load() {
      setLoadError(null)
      setLoading(true)

      try {
        await refreshData()
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

    if (isAdmin || isMechanic) {
      load()
    }

    return () => {
      active = false
    }
  }, [isAdmin, isMechanic, refreshData])

  const totalLabel = useMemo(() => {
    if (!listData) {
      return '0 ordenes'
    }

    return `${formatNumber(listData.paginacion.total)} orden${
      listData.paginacion.total === 1 ? '' : 'es'
    }`
  }, [listData])

  async function openDetail(orderId: string) {
    setDetailLoading(true)
    setLoadError(null)

    try {
      const result = await getWorkOrder(orderId)

      setSelectedOrder(result.orden)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshSelected(orderId: string) {
    const result = await getWorkOrder(orderId)

    setSelectedOrder(result.orden)
  }

  async function applyOrderResult(
    operation: Promise<{ orden: WorkOrderDetailDto }>,
    successMessage: string,
  ) {
    setSubmitting(true)
    setFormError(null)
    setFeedback(null)

    try {
      const result = await operation

      setSelectedOrder(result.orden)
      setFeedback(successMessage)
      await refreshData()
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateManual(input: CreateManualWorkOrderInput) {
    await applyOrderResult(createManualWorkOrder(input), 'Orden de trabajo creada.')
    setShowCreateForm(false)
  }

  async function handleAssignment(
    input: AssignWorkOrderInput | ReassignWorkOrderInput,
    mode: AssignmentMode,
  ) {
    if (!assignmentAction) {
      return
    }

    await applyOrderResult(
      mode === 'assign'
        ? assignWorkOrder(assignmentAction.order.id, input as AssignWorkOrderInput)
        : reassignWorkOrder(assignmentAction.order.id, input as ReassignWorkOrderInput),
      mode === 'assign' ? 'Orden asignada.' : 'Orden reasignada.',
    )
    setAssignmentAction(null)
  }

  async function handleReturn(motivo: string) {
    if (!returnAction) {
      return
    }

    await applyOrderResult(
      returnWorkOrder(returnAction.id, motivo),
      'Orden devuelta para correccion.',
    )
    setReturnAction(null)
  }

  async function handleClose(observacion?: string) {
    if (!closeAction) {
      return
    }

    await applyOrderResult(closeWorkOrder(closeAction.id, { observacion }), 'Orden cerrada.')
    setCloseAction(null)
  }

  function clearFilters() {
    setBusqueda('')
    setBusId('')
    setEstado('')
    setOrigen('')
    setPagina(1)
    setTecnicoId('')
    setTipo('')
  }

  if (!isAdmin && !isMechanic) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <StatePanel
          description="Su rol no participa directamente en RF-04."
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
          <Badge tone="emerald">RF-04</Badge>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Seguimiento de ordenes de trabajo
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {isAdmin
                  ? `${totalLabel} con asignacion, revision y cierre administrativo.`
                  : `${totalLabel} asignadas para ejecucion tecnica.`}
              </p>
            </div>
            {isAdmin && (
              <Button icon={<PlusCircle size={16} />} onClick={() => setShowCreateForm(true)}>
                Crear orden
              </Button>
            )}
          </div>
        </section>

        {feedback && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        <SummaryMetrics isAdmin={Boolean(isAdmin)} summary={summary} />

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_170px_120px]">
            <label className="relative">
              <span className="sr-only">Buscar ordenes</span>
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
                placeholder="Buscar por codigo, bus, placa o descripcion"
                type="search"
                value={busqueda}
              />
            </label>
            <label>
              <span className="sr-only">Tipo</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setPagina(1)
                  setTipo(event.target.value as WorkOrderType | '')
                }}
                value={tipo}
              >
                <option value="">Tipo</option>
                {typeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Origen</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setPagina(1)
                  setOrigen(event.target.value as WorkOrderOrigin | '')
                }}
                value={origen}
              >
                <option value="">Origen</option>
                {originOptions.map(([value, label]) => (
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

          {isAdmin && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                      {bus.codigoInterno} - {bus.placa}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Mecanico</span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => {
                    setPagina(1)
                    setTecnicoId(event.target.value)
                  }}
                  value={tecnicoId}
                >
                  <option value="">Mecanico</option>
                  {mechanics.map((mechanic) => (
                    <option key={mechanic.id} value={mechanic.id}>
                      {mechanic.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

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
            description="Consultando ordenes de trabajo."
            title="Cargando ordenes"
            tone="loading"
          />
        )}

        {loadError && !loading && (
          <StatePanel description={loadError} title="No fue posible cargar" tone="error" />
        )}

        {!loading && !loadError && listData?.ordenes.length === 0 && (
          <StatePanel
            action={
              <Button onClick={clearFilters} variant="outline">
                Limpiar filtros
              </Button>
            }
            description="No hay ordenes que coincidan con los filtros actuales."
            title="Sin resultados"
            tone="empty"
          />
        )}

        {!loading && !loadError && listData && listData.ordenes.length > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {listData.ordenes.map((order) => (
                <WorkOrderCard key={order.id} onOpen={openDetail} order={order} />
              ))}
              <div className="rounded-lg border border-slate-200 bg-white">
                <Pagination
                  onNext={() => setPagina((current) => current + 1)}
                  onPrev={() => setPagina((current) => Math.max(1, current - 1))}
                  pagina={listData.paginacion.pagina}
                  totalPaginas={listData.paginacion.totalPaginas}
                />
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Orden</th>
                      <th className="px-4 py-3">Bus</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Origen</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Mecanico</th>
                      <th className="px-4 py-3 text-right">Costo</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listData.ordenes.map((order) => (
                      <tr className="align-top" key={order.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{order.codigo}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {order.descripcion}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {order.bus.codigoInterno}
                          <span className="mt-1 block text-xs text-slate-400">
                            {order.bus.placa}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <TypeBadge type={order.tipo} />
                        </td>
                        <td className="px-4 py-3">
                          <OriginBadge origin={order.origen} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.estado} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {order.tecnicoAsignado?.nombre ?? 'Sin asignar'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {formatCurrency(order.costoTotal)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button
                              icon={<ClipboardList size={14} />}
                              onClick={() => openDetail(order.id)}
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
              <Pagination
                onNext={() => setPagina((current) => current + 1)}
                onPrev={() => setPagina((current) => Math.max(1, current - 1))}
                pagina={listData.paginacion.pagina}
                totalPaginas={listData.paginacion.totalPaginas}
              />
            </div>
          </>
        )}

        <Drawer
          onClose={() => setSelectedOrder(null)}
          open={Boolean(selectedOrder)}
          subtitle={
            selectedOrder
              ? `${selectedOrder.bus.codigoInterno} - ${selectedOrder.codigo}`
              : undefined
          }
          title="Detalle de orden"
        >
          {detailLoading && (
            <StatePanel description="Consultando detalle." title="Cargando" tone="loading" />
          )}
          {formError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          {selectedOrder && (
            <WorkOrderDetail
              isAdmin={Boolean(isAdmin)}
              isMechanic={Boolean(isMechanic)}
              onAssign={setAssignmentAction}
              onCloseOrder={setCloseAction}
              onFeedback={(message) => {
                setFeedback(message)
                void refreshData()
                void refreshSelected(selectedOrder.id)
              }}
              onOrderChange={(order) => {
                setSelectedOrder(order)
                void refreshData()
              }}
              onReturn={setReturnAction}
              order={selectedOrder}
              submitting={submitting}
            />
          )}
        </Drawer>

        {showCreateForm && (
          <ManualOrderDialog
            buses={buses}
            error={formError}
            onClose={() => {
              setShowCreateForm(false)
              setFormError(null)
            }}
            onSubmit={handleCreateManual}
            submitting={submitting}
          />
        )}

        {assignmentAction && (
          <AssignmentDialog
            action={assignmentAction}
            error={formError}
            mechanics={mechanics}
            onClose={() => {
              setAssignmentAction(null)
              setFormError(null)
            }}
            onSubmit={handleAssignment}
            submitting={submitting}
          />
        )}

        {returnAction && (
          <ReturnDialog
            error={formError}
            onClose={() => {
              setReturnAction(null)
              setFormError(null)
            }}
            onSubmit={handleReturn}
            order={returnAction}
            submitting={submitting}
          />
        )}

        {closeAction && (
          <CloseDialog
            error={formError}
            onClose={() => {
              setCloseAction(null)
              setFormError(null)
            }}
            onSubmit={handleClose}
            order={closeAction}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}
