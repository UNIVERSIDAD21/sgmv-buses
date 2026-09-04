import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import {
  AlertTriangle,
  Bus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PlusCircle,
  Search,
  Shield,
  Wrench,
  X,
} from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import { BUS_STATUS_LABELS, NOVELTY_STATUS_LABELS, ORDER_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import { getAssignedBus } from '../flota/fleet.api'
import type { AssignedBusResponse } from '../flota/fleet.types'
import {
  convertNoveltyToOrder,
  createNovelty,
  getAdminNovelty,
  getNoveltySummary,
  getOwnNovelty,
  listAdminNovelties,
  listOwnNovelties,
  reviewNovelty,
  type ConvertNoveltyInput,
  type ReviewNoveltyInput,
} from './novelty.api'
import type {
  NoveltyDto,
  NoveltyListResponse,
  NoveltyStatus,
  NoveltySummaryDto,
  OrderPriority,
} from './novelty.types'

type BadgeTone = 'amber' | 'emerald' | 'red' | 'slate' | 'teal'
type AdminActionType = 'classify' | 'convert' | 'discard' | 'resolve'

interface AdminAction {
  novelty: NoveltyDto
  type: AdminActionType
}

const statusOptions = Object.entries(NOVELTY_STATUS_LABELS) as Array<[NoveltyStatus, string]>
const priorityOptions: Array<[OrderPriority, string]> = [
  ['BAJA', 'Baja'],
  ['MEDIA', 'Media'],
  ['ALTA', 'Alta'],
]

const statusTone: Record<NoveltyStatus, BadgeTone> = {
  CONVERTIDA_A_ORDEN: 'teal',
  DESCARTADA: 'slate',
  PENDIENTE_REVISION: 'amber',
  RESUELTA_SIN_ORDEN: 'emerald',
}

const priorityTone: Record<OrderPriority, BadgeTone> = {
  ALTA: 'red',
  BAJA: 'slate',
  MEDIA: 'amber',
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'No se pudo completar la operacion'
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
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

function StatusBadge({ status }: { status: NoveltyStatus }) {
  return <Badge tone={statusTone[status]}>{NOVELTY_STATUS_LABELS[status]}</Badge>
}

function PriorityBadge({ priority }: { priority: OrderPriority }) {
  const label = priorityOptions.find(([value]) => value === priority)?.[1] ?? priority

  return <Badge tone={priorityTone[priority]}>{label}</Badge>
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

function NoveltyDetail({ actions, novelty }: { actions?: ReactNode; novelty: NoveltyDto }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldValue label="Bus">
          {novelty.bus.codigoInterno} - {novelty.bus.placa}
        </FieldValue>
        <FieldValue label="Estado bus">
          {BUS_STATUS_LABELS[novelty.bus.estadoOperativo as keyof typeof BUS_STATUS_LABELS] ??
            novelty.bus.estadoOperativo}
        </FieldValue>
        <FieldValue label="Autor">{novelty.conductor.nombre}</FieldValue>
        <FieldValue label="Fecha reporte">{formatDateTimeValue(novelty.fechaReporte)}</FieldValue>
        <FieldValue label="Tipo">{novelty.tipo}</FieldValue>
        <FieldValue label="Estado">
          <StatusBadge status={novelty.estado} />
        </FieldValue>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Descripcion</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {novelty.descripcion}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FieldValue label="Clasificacion">
          {novelty.clasificacion ?? 'Pendiente de clasificar'}
        </FieldValue>
        <FieldValue label="Responsable revision">
          {novelty.revisadaPor?.nombre ?? 'Sin revision'}
        </FieldValue>
        <FieldValue label="Fecha revision">
          {novelty.fechaRevision ? formatDateTimeValue(novelty.fechaRevision) : 'Sin revision'}
        </FieldValue>
        <FieldValue label="Observacion">
          {novelty.observacionRevision ?? 'Sin observacion'}
        </FieldValue>
      </section>

      {novelty.ordenTrabajo ? (
        <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Orden generada</h3>
              <p className="mt-1 text-sm text-slate-600">{novelty.ordenTrabajo.codigo}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={novelty.ordenTrabajo.prioridad} />
              <Badge tone="teal">{getOrderStatusLabel(novelty.ordenTrabajo.estado)}</Badge>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Creada el {formatDateTimeValue(novelty.ordenTrabajo.fechaCreacion)}
          </p>
          {novelty.ordenTrabajo.descripcion && (
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {novelty.ordenTrabajo.descripcion}
            </p>
          )}
        </section>
      ) : (
        <TimelineEmpty text="Esta novedad todavia no tiene una orden correctiva asociada." />
      )}

      {actions}
    </div>
  )
}

function AdminActionDialog({
  action,
  error,
  onClose,
  onSubmit,
  submitting,
}: {
  action: AdminAction
  error: string | null
  onClose: () => void
  onSubmit: (payload: ReviewNoveltyInput | ConvertNoveltyInput) => void
  submitting: boolean
}) {
  const [clasificacion, setClasificacion] = useState(action.novelty.clasificacion ?? '')
  const [descripcionOrden, setDescripcionOrden] = useState('')
  const [observacion, setObservacion] = useState('')
  const [prioridad, setPrioridad] = useState<OrderPriority>('MEDIA')
  const [validationError, setValidationError] = useState<string | null>(null)

  const titleByType: Record<AdminActionType, string> = {
    classify: 'Clasificar novedad',
    convert: 'Generar orden correctiva',
    discard: 'Descartar novedad',
    resolve: 'Resolver sin orden',
  }

  const submitByType: Record<AdminActionType, string> = {
    classify: 'Guardar clasificacion',
    convert: 'Crear orden',
    discard: 'Descartar',
    resolve: 'Resolver',
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)

    if (action.type === 'classify') {
      const value = normalizeText(clasificacion)

      if (value.length < 3) {
        setValidationError('La clasificacion debe tener al menos 3 caracteres.')
        return
      }

      onSubmit({
        accion: 'CLASIFICAR',
        clasificacion: value,
        observacion: normalizeText(observacion) || undefined,
      })
      return
    }

    if (action.type === 'resolve' || action.type === 'discard') {
      const value = normalizeText(observacion)

      if (value.length < 3) {
        setValidationError('La observacion debe tener al menos 3 caracteres.')
        return
      }

      onSubmit({
        accion: action.type === 'resolve' ? 'RESOLVER_SIN_ORDEN' : 'DESCARTAR',
        clasificacion: normalizeText(clasificacion) || undefined,
        observacion: value,
      })
      return
    }

    onSubmit({
      descripcionOrden: normalizeText(descripcionOrden) || undefined,
      observacion: normalizeText(observacion) || undefined,
      prioridad,
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <div
        aria-label={titleByType[action.type]}
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{titleByType[action.type]}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {action.novelty.tipo} - {action.novelty.bus.codigoInterno}
            </p>
          </div>
          <button
            aria-label="Cerrar operacion"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">
              {action.novelty.bus.codigoInterno} - {action.novelty.bus.placa}
            </p>
            <p className="mt-1">Autor: {action.novelty.conductor.nombre}</p>
            <p className="mt-1 line-clamp-3">{action.novelty.descripcion}</p>
          </div>

          {(action.type === 'classify' ||
            action.type === 'resolve' ||
            action.type === 'discard') && (
            <label className="block text-sm font-medium text-slate-700">
              Clasificacion
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setClasificacion(event.target.value)}
                placeholder="Ej. Falla electrica"
                value={clasificacion}
              />
            </label>
          )}

          {action.type === 'convert' && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Se creara una orden correctiva asociada al mismo bus. La asignacion tecnica queda
                pendiente para RF-04.
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Prioridad de la orden
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
                  className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setDescripcionOrden(event.target.value)}
                  placeholder="Opcional. Si se omite, se usara la descripcion de la novedad."
                  value={descripcionOrden}
                />
              </label>
            </>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Observacion
            <textarea
              className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setObservacion(event.target.value)}
              required={action.type === 'resolve' || action.type === 'discard'}
              value={observacion}
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
              loading={submitting}
              type="submit"
              variant={action.type === 'discard' ? 'danger' : 'primary'}
            >
              {submitByType[action.type]}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DriverNoveltyCard({
  novelty,
  onOpen,
}: {
  novelty: NoveltyDto
  onOpen: (noveltyId: string) => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-900">{novelty.tipo}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTimeValue(novelty.fechaReporte)}</p>
        </div>
        <StatusBadge status={novelty.estado} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{novelty.descripcion}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500">
          {novelty.clasificacion ?? 'Pendiente de revision'}
        </span>
        <Button
          icon={<ClipboardList size={14} />}
          onClick={() => onOpen(novelty.id)}
          size="sm"
          variant="outline"
        >
          Detalle
        </Button>
      </div>
    </article>
  )
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

function DriverView() {
  const [assignedData, setAssignedData] = useState<AssignedBusResponse | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [estado, setEstado] = useState<NoveltyStatus | ''>('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [listData, setListData] = useState<NoveltyListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [selectedNovelty, setSelectedNovelty] = useState<NoveltyDto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [tipo, setTipo] = useState('')

  const assignedBus = assignedData?.bus ?? null

  const refreshDriverData = useCallback(async () => {
    const [assigned, novelties] = await Promise.all([
      getAssignedBus(),
      listOwnNovelties({
        estado,
        limite: 6,
        pagina,
      }),
    ])

    setAssignedData(assigned)
    setListData(novelties)
  }, [estado, pagina])

  useEffect(() => {
    let active = true

    async function load() {
      setLoadError(null)
      setLoading(true)

      try {
        const [assigned, novelties] = await Promise.all([
          getAssignedBus(),
          listOwnNovelties({
            estado,
            limite: 6,
            pagina,
          }),
        ])

        if (active) {
          setAssignedData(assigned)
          setListData(novelties)
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
  }, [estado, pagina])

  const totalLabel = useMemo(() => {
    if (!listData) {
      return '0 novedades'
    }

    return `${formatNumber(listData.paginacion.total)} novedad${
      listData.paginacion.total === 1 ? '' : 'es'
    }`
  }, [listData])

  function validateForm() {
    const errors: Record<string, string> = {}
    const normalizedTipo = normalizeText(tipo)
    const normalizedDescripcion = normalizeText(descripcion)

    if (normalizedTipo.length < 3) {
      errors.tipo = 'El tipo debe tener al menos 3 caracteres.'
    }

    if (normalizedDescripcion.length < 10) {
      errors.descripcion = 'La descripcion debe tener al menos 10 caracteres.'
    }

    setFieldErrors(errors)

    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setSubmitError(null)

    if (!assignedBus) {
      setSubmitError('No hay un bus activo asignado para registrar novedades.')
      return
    }

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      await createNovelty({
        descripcion: normalizeText(descripcion),
        tipo: normalizeText(tipo),
      })

      setTipo('')
      setDescripcion('')
      setFeedback('Novedad registrada para el bus asignado.')
      await refreshDriverData()
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function openDetail(novedadId: string) {
    setDetailLoading(true)
    setLoadError(null)

    try {
      const data = await getOwnNovelty(novedadId)

      setSelectedNovelty(data.novedad)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <Badge tone="emerald">RF-02</Badge>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Mis novedades operativas</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Registro asociado automaticamente a su bus asignado activo.
            </p>
          </div>
          <p className="text-sm text-slate-500">{totalLabel}</p>
        </div>
      </section>

      {loading && (
        <StatePanel
          description="Consultando bus asignado y novedades propias."
          title="Cargando novedades"
          tone="loading"
        />
      )}

      {loadError && !loading && (
        <StatePanel description={loadError} title="No fue posible cargar" tone="error" />
      )}

      {!loading && !loadError && !assignedBus && (
        <StatePanel
          description="No hay una asignacion activa para registrar novedades. Cuando se asigne un bus, el formulario quedara habilitado."
          title="Sin bus asignado"
          tone="empty"
        />
      )}

      {!loading && !loadError && assignedBus && (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <section className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Bus size={18} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {assignedBus.codigoInterno} - {assignedBus.placa}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {assignedBus.marca} {assignedBus.modelo}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone="emerald">Bus asignado</Badge>
                <Badge tone="slate">
                  {BUS_STATUS_LABELS[
                    assignedBus.estadoOperativo as keyof typeof BUS_STATUS_LABELS
                  ] ?? assignedBus.estadoOperativo}
                </Badge>
              </div>
            </div>

            <form
              className="rounded-lg border border-slate-200 bg-white p-5"
              onSubmit={handleSubmit}
            >
              <h3 className="text-base font-semibold text-slate-900">Registrar novedad</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                El autor y el bus se obtienen de la sesion y la asignacion activa.
              </p>

              {feedback && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {feedback}
                </div>
              )}

              {submitError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Tipo de novedad
                  <input
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => {
                      setTipo(event.target.value)
                      setFieldErrors((current) => {
                        const next = { ...current }
                        delete next.tipo
                        return next
                      })
                    }}
                    placeholder="Ej. Ruido en frenos"
                    value={tipo}
                  />
                  {fieldErrors.tipo && (
                    <span className="mt-1 block text-xs text-red-600">{fieldErrors.tipo}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Descripcion
                  <textarea
                    className="mt-1.5 min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => {
                      setDescripcion(event.target.value)
                      setFieldErrors((current) => {
                        const next = { ...current }
                        delete next.descripcion
                        return next
                      })
                    }}
                    placeholder="Detalle lo observado durante la operacion."
                    value={descripcion}
                  />
                  <span className="mt-1 block text-xs text-slate-400">
                    Se guardara normalizado como: {normalizeText(tipo) || '...'}
                  </span>
                  {fieldErrors.descripcion && (
                    <span className="mt-1 block text-xs text-red-600">
                      {fieldErrors.descripcion}
                    </span>
                  )}
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={submitting}
                  onClick={() => {
                    setTipo('')
                    setDescripcion('')
                    setFieldErrors({})
                    setSubmitError(null)
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button icon={<PlusCircle size={15} />} loading={submitting} type="submit">
                  Enviar novedad
                </Button>
              </div>
            </form>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
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

            {!listData || listData.novedades.length === 0 ? (
              <StatePanel
                description="No hay novedades propias que coincidan con los filtros actuales."
                title="Sin novedades"
                tone="empty"
              />
            ) : (
              <div className="space-y-3">
                {listData.novedades.map((novelty) => (
                  <DriverNoveltyCard key={novelty.id} novelty={novelty} onOpen={openDetail} />
                ))}
                <Pagination
                  onNext={() => setPagina((current) => current + 1)}
                  onPrev={() => setPagina((current) => Math.max(1, current - 1))}
                  pagina={listData.paginacion.pagina}
                  totalPaginas={listData.paginacion.totalPaginas}
                />
              </div>
            )}
          </section>
        </div>
      )}

      <Drawer
        onClose={() => setSelectedNovelty(null)}
        open={Boolean(selectedNovelty)}
        subtitle={selectedNovelty ? selectedNovelty.tipo : undefined}
        title="Detalle de novedad"
      >
        {detailLoading && (
          <StatePanel description="Consultando detalle." title="Cargando" tone="loading" />
        )}
        {selectedNovelty && <NoveltyDetail novelty={selectedNovelty} />}
      </Drawer>
    </div>
  )
}

function AdminView() {
  const { user } = useSession()
  const isAdmin = user?.rol.codigo === 'ADMINISTRADOR'
  const [action, setAction] = useState<AdminAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [clasificacion, setClasificacion] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [estado, setEstado] = useState<NoveltyStatus | ''>('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [listData, setListData] = useState<NoveltyListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [prioridad, setPrioridad] = useState<OrderPriority | ''>('')
  const [selectedNovelty, setSelectedNovelty] = useState<NoveltyDto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState<NoveltySummaryDto | null>(null)

  const refreshAdminData = useCallback(async () => {
    const [summaryData, novelties] = await Promise.all([
      getNoveltySummary(),
      listAdminNovelties({
        busqueda,
        clasificacion,
        estado,
        limite: 8,
        pagina,
        prioridad,
      }),
    ])

    setSummary(summaryData)
    setListData(novelties)
  }, [busqueda, clasificacion, estado, pagina, prioridad])

  useEffect(() => {
    let active = true

    async function load() {
      setLoadError(null)
      setLoading(true)

      try {
        const [summaryData, novelties] = await Promise.all([
          getNoveltySummary(),
          listAdminNovelties({
            busqueda,
            clasificacion,
            estado,
            limite: 8,
            pagina,
            prioridad,
          }),
        ])

        if (active) {
          setSummary(summaryData)
          setListData(novelties)
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
  }, [busqueda, clasificacion, estado, pagina, prioridad])

  const totalLabel = useMemo(() => {
    if (!listData) {
      return '0 resultados'
    }

    return `${formatNumber(listData.paginacion.total)} resultado${
      listData.paginacion.total === 1 ? '' : 's'
    }`
  }, [listData])

  async function openDetail(novedadId: string) {
    setDetailLoading(true)
    setLoadError(null)

    try {
      const data = await getAdminNovelty(novedadId)

      setSelectedNovelty(data.novedad)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshSelected(novedadId: string) {
    const data = await getAdminNovelty(novedadId)
    setSelectedNovelty(data.novedad)
  }

  async function handleAdminAction(payload: ReviewNoveltyInput | ConvertNoveltyInput) {
    if (!action) {
      return
    }

    setSubmitting(true)
    setActionError(null)
    setFeedback(null)

    try {
      if (action.type === 'convert') {
        const result = await convertNoveltyToOrder(
          action.novelty.id,
          payload as ConvertNoveltyInput,
        )
        setFeedback(
          result.yaExistia
            ? `La novedad ya tenia la orden ${result.orden?.codigo}.`
            : `Orden ${result.orden?.codigo} generada en estado pendiente de asignacion.`,
        )
      } else {
        await reviewNovelty(action.novelty.id, payload as ReviewNoveltyInput)
        setFeedback('Novedad actualizada.')
      }

      await refreshAdminData()
      await refreshSelected(action.novelty.id)
      setAction(null)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function clearFilters() {
    setBusqueda('')
    setClasificacion('')
    setEstado('')
    setPrioridad('')
    setPagina(1)
  }

  function renderAdminActions(novelty: NoveltyDto) {
    if (!isAdmin || novelty.estado !== 'PENDIENTE_REVISION') {
      return null
    }

    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Acciones administrativas</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            icon={<Shield size={14} />}
            onClick={() => setAction({ novelty, type: 'classify' })}
            size="sm"
            variant="outline"
          >
            Clasificar
          </Button>
          <Button
            icon={<ClipboardList size={14} />}
            onClick={() => setAction({ novelty, type: 'resolve' })}
            size="sm"
            variant="outline"
          >
            Resolver
          </Button>
          <Button
            icon={<AlertTriangle size={14} />}
            onClick={() => setAction({ novelty, type: 'discard' })}
            size="sm"
            variant="outline"
          >
            Descartar
          </Button>
          {!novelty.ordenTrabajo && (
            <Button
              icon={<Wrench size={14} />}
              onClick={() => setAction({ novelty, type: 'convert' })}
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

  return (
    <div className="relative min-h-full p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <Badge tone="emerald">RF-02</Badge>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Control de novedades operativas
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {isAdmin
                  ? `${totalLabel} con revision, clasificacion y conversion correctiva.`
                  : `${totalLabel} para seguimiento operativo del despacho.`}
              </p>
            </div>
            {isAdmin && (
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                to="/ordenes-trabajo"
              >
                <ClipboardList size={16} />
                Ver ordenes
              </Link>
            )}
          </div>
        </section>

        {feedback && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldValue label="Total novedades">{summary?.total ?? '...'}</FieldValue>
          <FieldValue label="Pendientes">{summary?.pendientes ?? '...'}</FieldValue>
          <FieldValue label="Convertidas">
            {summary?.estados.CONVERTIDA_A_ORDEN ?? '...'}
          </FieldValue>
          <FieldValue label="Ordenes generadas">{summary?.ordenesGeneradas ?? '...'}</FieldValue>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <label className="relative">
              <span className="sr-only">Buscar novedades</span>
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
                placeholder="Buscar por tipo, descripcion, placa o codigo"
                type="search"
                value={busqueda}
              />
            </label>
            <label className="block">
              <span className="sr-only">Clasificacion</span>
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setPagina(1)
                  setClasificacion(event.target.value)
                }}
                placeholder="Clasificacion"
                value={clasificacion}
              />
            </label>
            <label className="block">
              <span className="sr-only">Prioridad</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setPagina(1)
                  setPrioridad(event.target.value as OrderPriority | '')
                }}
                value={prioridad}
              >
                <option value="">Prioridad</option>
                {priorityOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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
            description="Consultando novedades registradas."
            title="Cargando novedades"
            tone="loading"
          />
        )}

        {loadError && !loading && (
          <StatePanel description={loadError} title="No fue posible cargar" tone="error" />
        )}

        {!loading && !loadError && listData?.novedades.length === 0 && (
          <StatePanel
            action={
              <Button onClick={clearFilters} variant="outline">
                Limpiar filtros
              </Button>
            }
            description="No hay novedades que coincidan con los filtros actuales."
            title="Sin resultados"
            tone="empty"
          />
        )}

        {!loading && !loadError && listData && listData.novedades.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Bus</th>
                    <th className="px-4 py-3">Conductor</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Clasificacion</th>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listData.novedades.map((novelty) => (
                    <tr className="align-top" key={novelty.id}>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTimeValue(novelty.fechaReporte)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{novelty.tipo}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {novelty.bus.codigoInterno} - {novelty.bus.placa}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{novelty.conductor.nombre}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={novelty.estado} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {novelty.clasificacion ?? 'Pendiente'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {novelty.ordenTrabajo ? novelty.ordenTrabajo.codigo : 'Sin orden'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            icon={<ClipboardList size={14} />}
                            onClick={() => openDetail(novelty.id)}
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
        )}

        <Drawer
          onClose={() => setSelectedNovelty(null)}
          open={Boolean(selectedNovelty)}
          subtitle={selectedNovelty ? selectedNovelty.tipo : undefined}
          title="Detalle de novedad"
        >
          {detailLoading && (
            <StatePanel description="Consultando detalle." title="Cargando" tone="loading" />
          )}

          {selectedNovelty && (
            <NoveltyDetail
              actions={renderAdminActions(selectedNovelty)}
              novelty={selectedNovelty}
            />
          )}
        </Drawer>

        {action && (
          <AdminActionDialog
            action={action}
            error={actionError}
            key={`${action.type}-${action.novelty.id}`}
            onClose={() => setAction(null)}
            onSubmit={handleAdminAction}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}

export default function NoveltyPage() {
  const { user } = useSession()

  if (user?.rol.codigo === 'CONDUCTOR') {
    return <DriverView />
  }

  if (user?.rol.codigo === 'ADMINISTRADOR' || user?.rol.codigo === 'DESPACHADOR') {
    return <AdminView />
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <StatePanel
        description="Su rol no participa directamente en RF-02."
        title="Acceso denegado"
        tone="error"
      />
    </div>
  )
}
