import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import {
  Bus,
  ChevronLeft,
  ChevronRight,
  Gauge,
  PlusCircle,
  Search,
  User,
  Wrench,
  X,
} from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import { BUS_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import {
  assignDriver,
  changeBusState,
  getAssignedBus,
  getAvailableDrivers,
  getBus,
  listBuses,
  registerMileage,
} from './fleet.api'
import type {
  AssignedBusResponse,
  BusDetailDto,
  BusStatus,
  DriverOptionDto,
  ListBusesResponse,
} from './fleet.types'

const statusOptions = Object.entries(BUS_STATUS_LABELS) as Array<[BusStatus, string]>

const statusTone: Record<BusStatus, 'amber' | 'emerald' | 'red' | 'slate' | 'teal'> = {
  EN_MANTENIMIENTO: 'amber',
  FUERA_DE_SERVICIO: 'red',
  INACTIVO: 'slate',
  OPERATIVO: 'emerald',
}

type FleetAction =
  | { bus: BusDetailDto; type: 'assignment' }
  | { bus: BusDetailDto; type: 'mileage' }
  | { bus: BusDetailDto; type: 'state' }

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'No se pudo completar la operacion'
}

function formatDateTimeValue(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function StatusBadge({ status }: { status: BusStatus }) {
  return <Badge tone={statusTone[status]}>{BUS_STATUS_LABELS[status]}</Badge>
}

function FieldValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
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

function BusHistory({ bus, showAssignments }: { bus: BusDetailDto; showAssignments: boolean }) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Ultimas lecturas</h3>
        <div className="space-y-2">
          {bus.lecturasKilometraje.length === 0 ? (
            <TimelineEmpty text="Sin lecturas registradas." />
          ) : (
            bus.lecturasKilometraje.slice(0, 5).map((lectura) => (
              <div className="rounded-lg border border-slate-200 bg-white p-3" key={lectura.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatNumber(lectura.kilometrajeAnterior)} km a{' '}
                    {formatNumber(lectura.kilometrajeNuevo)} km
                  </p>
                  <span className="text-xs text-slate-400">
                    {formatDateTimeValue(lectura.fechaRegistro)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Responsable: {lectura.registradoPor.nombre}
                </p>
                {lectura.motivo && <p className="mt-1 text-xs text-slate-500">{lectura.motivo}</p>}
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
          Historial de estados
        </h3>
        <div className="space-y-2">
          {bus.estadosHistorial.length === 0 ? (
            <TimelineEmpty text="Sin cambios de estado registrados." />
          ) : (
            bus.estadosHistorial.slice(0, 6).map((estado) => (
              <div className="rounded-lg border border-slate-200 bg-white p-3" key={estado.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {estado.estadoAnterior && <StatusBadge status={estado.estadoAnterior} />}
                  <span className="text-xs text-slate-400">a</span>
                  <StatusBadge status={estado.estadoNuevo} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatDateTimeValue(estado.fechaCambio)} por {estado.cambiadoPor.nombre}
                </p>
                {estado.motivo && <p className="mt-1 text-xs text-slate-500">{estado.motivo}</p>}
              </div>
            ))
          )}
        </div>
      </section>

      {showAssignments && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Historial de asignaciones
          </h3>
          <div className="space-y-2">
            {bus.asignacionesHistorial.length === 0 ? (
              <TimelineEmpty text="Sin asignaciones registradas." />
            ) : (
              bus.asignacionesHistorial.map((assignment) => (
                <div
                  className="rounded-lg border border-slate-200 bg-white p-3"
                  key={assignment.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {assignment.conductor.nombre}
                    </p>
                    <Badge tone={assignment.activa ? 'emerald' : 'slate'}>
                      {assignment.activa ? 'Activa' : 'Cerrada'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Desde {formatDateTimeValue(assignment.fechaInicio)}
                    {assignment.fechaFin
                      ? ` hasta ${formatDateTimeValue(assignment.fechaFin)}`
                      : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Responsable: {assignment.asignadoPor.nombre}
                  </p>
                  {assignment.motivo && (
                    <p className="mt-1 text-xs text-slate-500">{assignment.motivo}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ActionDialog({
  action,
  drivers,
  error,
  loadingDrivers,
  onClose,
  onSubmit,
  submitting,
}: {
  action: FleetAction
  drivers: DriverOptionDto[]
  error: string | null
  loadingDrivers: boolean
  onClose: () => void
  onSubmit: (payload: {
    conductorId?: string
    estadoNuevo?: BusStatus
    kilometrajeNuevo?: number
    motivo?: string
  }) => void
  submitting: boolean
}) {
  const [kilometrajeNuevo, setKilometrajeNuevo] = useState(() =>
    String(action.bus.kilometrajeActual),
  )
  const [estadoNuevo, setEstadoNuevo] = useState<BusStatus>(() => action.bus.estadoOperativo)
  const [conductorId, setConductorId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const titleByType = {
    assignment: 'Asignar conductor',
    mileage: 'Registrar kilometraje',
    state: 'Cambiar estado',
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)

    if (action.type === 'mileage') {
      const value = Number(kilometrajeNuevo)

      if (!Number.isInteger(value) || value < action.bus.kilometrajeActual) {
        setValidationError('La lectura debe ser igual o superior al kilometraje actual.')
        return
      }

      onSubmit({ kilometrajeNuevo: value, motivo: motivo.trim() || undefined })
      return
    }

    if (action.type === 'state') {
      if (estadoNuevo === action.bus.estadoOperativo) {
        setValidationError('Seleccione un estado diferente al actual.')
        return
      }

      if (motivo.trim().length < 3) {
        setValidationError('El motivo debe tener al menos 3 caracteres.')
        return
      }

      onSubmit({ estadoNuevo, motivo: motivo.trim() })
      return
    }

    if (!conductorId) {
      setValidationError('Seleccione un conductor activo.')
      return
    }

    onSubmit({ conductorId, motivo: motivo.trim() || undefined })
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
              {action.bus.codigoInterno} - {action.bus.placa}
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
          {action.type === 'mileage' && (
            <>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Actual: {formatNumber(action.bus.kilometrajeActual)} km
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Nueva lectura
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  min={action.bus.kilometrajeActual}
                  onChange={(event) => setKilometrajeNuevo(event.target.value)}
                  type="number"
                  value={kilometrajeNuevo}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Motivo
                <textarea
                  className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => setMotivo(event.target.value)}
                  value={motivo}
                />
              </label>
            </>
          )}

          {action.type === 'state' && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
                <StatusBadge status={action.bus.estadoOperativo} />
                <span className="text-xs text-slate-400">a</span>
                <StatusBadge status={estadoNuevo} />
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Estado nuevo
                <select
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  onChange={(event) => setEstadoNuevo(event.target.value as BusStatus)}
                  value={estadoNuevo}
                >
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Motivo
                <textarea
                  className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => setMotivo(event.target.value)}
                  required
                  value={motivo}
                />
              </label>
            </>
          )}

          {action.type === 'assignment' && (
            <>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Conductor actual: {action.bus.conductorAsignado?.nombre ?? 'Sin conductor'}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Conductor
                <select
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  disabled={loadingDrivers}
                  onChange={(event) => setConductorId(event.target.value)}
                  value={conductorId}
                >
                  <option value="">
                    {loadingDrivers ? 'Cargando...' : 'Seleccione conductor'}
                  </option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.nombre}
                      {driver.asignacionActiva
                        ? ` - actual ${driver.asignacionActiva.bus.codigoInterno}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Motivo
                <textarea
                  className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => setMotivo(event.target.value)}
                  value={motivo}
                />
              </label>
            </>
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
            <Button loading={submitting} type="submit">
              Confirmar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FleetPage() {
  const { user } = useSession()
  const canManage = user?.rol.codigo === 'ADMIN_SUPERVISOR'
  const isDriver = user?.rol.codigo === 'CONDUCTOR_OPERADOR'
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<BusStatus | ''>('')
  const [pagina, setPagina] = useState(1)
  const [listData, setListData] = useState<ListBusesResponse | null>(null)
  const [assignedData, setAssignedData] = useState<AssignedBusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedBus, setSelectedBus] = useState<BusDetailDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [action, setAction] = useState<FleetAction | null>(null)
  const [drivers, setDrivers] = useState<DriverOptionDto[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const refreshAdminList = useCallback(async () => {
    if (!canManage) {
      return
    }

    const data = await listBuses({
      busqueda,
      estado,
      limite: 8,
      pagina,
    })

    setListData(data)
  }, [busqueda, canManage, estado, pagina])

  useEffect(() => {
    let active = true

    async function load() {
      setError(null)
      setLoading(true)

      try {
        if (canManage) {
          const data = await listBuses({
            busqueda,
            estado,
            limite: 8,
            pagina,
          })

          if (active) {
            setListData(data)
          }
        } else if (isDriver) {
          const data = await getAssignedBus()

          if (active) {
            setAssignedData(data)
          }
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError))
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
  }, [busqueda, canManage, estado, isDriver, pagina])

  useEffect(() => {
    let active = true

    async function loadDrivers() {
      if (action?.type !== 'assignment') {
        setDrivers([])
        return
      }

      setLoadingDrivers(true)

      try {
        const data = await getAvailableDrivers(action.bus.id)

        if (active) {
          setDrivers(data.conductores)
        }
      } catch (loadError) {
        if (active) {
          setOperationError(getErrorMessage(loadError))
        }
      } finally {
        if (active) {
          setLoadingDrivers(false)
        }
      }
    }

    loadDrivers()

    return () => {
      active = false
    }
  }, [action])

  const totalLabel = useMemo(() => {
    if (!listData) {
      return '0 resultados'
    }

    return `${formatNumber(listData.paginacion.total)} resultado${
      listData.paginacion.total === 1 ? '' : 's'
    }`
  }, [listData])

  async function openDetail(busId: string) {
    setDetailLoading(true)
    setError(null)

    try {
      const data = await getBus(busId)

      setSelectedBus(data.bus)
    } catch (detailError) {
      setError(getErrorMessage(detailError))
    } finally {
      setDetailLoading(false)
    }
  }

  function openAction(type: FleetAction['type'], bus: BusDetailDto) {
    setOperationError(null)
    setAction({ bus, type } as FleetAction)
  }

  async function refreshAfterOperation(busId: string) {
    await refreshAdminList()

    if (selectedBus?.id === busId) {
      const data = await getBus(busId)
      setSelectedBus(data.bus)
    }
  }

  async function handleActionSubmit(payload: {
    conductorId?: string
    estadoNuevo?: BusStatus
    kilometrajeNuevo?: number
    motivo?: string
  }) {
    if (!action) {
      return
    }

    setSubmitting(true)
    setOperationError(null)
    setFeedback(null)

    try {
      if (action.type === 'mileage' && payload.kilometrajeNuevo !== undefined) {
        await registerMileage(action.bus.id, payload.kilometrajeNuevo, payload.motivo)
        setFeedback('Kilometraje registrado')
      }

      if (action.type === 'state' && payload.estadoNuevo && payload.motivo) {
        await changeBusState(action.bus.id, payload.estadoNuevo, payload.motivo)
        setFeedback('Estado actualizado')
      }

      if (action.type === 'assignment' && payload.conductorId) {
        await assignDriver(action.bus.id, payload.conductorId, payload.motivo)
        setFeedback('Asignacion actualizada')
      }

      await refreshAfterOperation(action.bus.id)
      setAction(null)
    } catch (submitError) {
      setOperationError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  if (isDriver) {
    const assignedBus = assignedData?.bus ?? null

    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <Badge tone="emerald">Conductor / Operador</Badge>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Mi bus asignado</h2>
        </section>

        {loading && (
          <StatePanel
            description="Consultando asignacion activa."
            title="Cargando bus asignado"
            tone="loading"
          />
        )}

        {error && !loading && (
          <StatePanel description={error} title="No fue posible cargar" tone="error" />
        )}

        {!loading && !error && !assignedBus && (
          <StatePanel
            description="No hay una asignacion activa vinculada a su usuario."
            title="Sin bus asignado"
            tone="empty"
          />
        )}

        {!loading && !error && assignedBus && (
          <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <section className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Bus size={18} />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {assignedBus.codigoInterno}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{assignedBus.placa}</p>
                <div className="mt-4">
                  <StatusBadge status={assignedBus.estadoOperativo} />
                </div>
              </div>
              <FieldValue label="Vehiculo" value={`${assignedBus.marca} ${assignedBus.modelo}`} />
              <FieldValue label="Anio" value={String(assignedBus.anio)} />
              <FieldValue
                label="Kilometraje"
                value={`${formatNumber(assignedBus.kilometrajeActual)} km`}
              />
            </section>

            <BusHistory bus={assignedBus} showAssignments={false} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative min-h-full p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Gestion de la flota vehicular
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {totalLabel} en PostgreSQL/Neon
              </p>
            </div>
            {canManage && (
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                to="/flota/nuevo"
              >
                <PlusCircle size={16} />
                Registrar bus
              </Link>
            )}
          </div>
        </section>

        {feedback && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar buses</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => {
                setPagina(1)
                setBusqueda(event.target.value)
              }}
              placeholder="Buscar por codigo o placa"
              type="search"
              value={busqueda}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setPagina(1)
                setEstado('')
              }}
              size="sm"
              variant={estado === '' ? 'secondary' : 'outline'}
            >
              Todos
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
        </div>

        {loading && (
          <StatePanel
            description="Consultando buses registrados."
            title="Cargando flota"
            tone="loading"
          />
        )}

        {error && !loading && (
          <StatePanel description={error} title="No fue posible cargar" tone="error" />
        )}

        {!loading && !error && listData?.buses.length === 0 && (
          <StatePanel
            action={
              <Button
                onClick={() => {
                  setBusqueda('')
                  setEstado('')
                  setPagina(1)
                }}
                variant="outline"
              >
                Limpiar filtros
              </Button>
            }
            description="No hay buses que coincidan con los filtros actuales."
            title="Sin resultados"
            tone="empty"
          />
        )}

        {!loading && !error && listData && listData.buses.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Codigo</th>
                    <th className="px-4 py-3">Placa</th>
                    <th className="px-4 py-3">Vehiculo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Kilometraje</th>
                    <th className="px-4 py-3">Conductor</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listData.buses.map((bus) => (
                    <tr className="align-top" key={bus.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {bus.codigoInterno}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{bus.placa}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {bus.marca} {bus.modelo} ({bus.anio})
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={bus.estadoOperativo} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatNumber(bus.kilometrajeActual)} km
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {bus.conductorAsignado?.nombre ?? 'Sin asignar'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            icon={<Bus size={14} />}
                            onClick={() => openDetail(bus.id)}
                            size="sm"
                            variant="outline"
                          >
                            Detalle
                          </Button>
                          <Link
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            to={`/flota/${bus.id}/editar`}
                          >
                            Editar
                          </Link>
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
        )}

        <Drawer
          onClose={() => setSelectedBus(null)}
          open={Boolean(selectedBus)}
          subtitle={selectedBus ? `${selectedBus.codigoInterno} - ${selectedBus.placa}` : undefined}
          title="Detalle de bus"
        >
          {detailLoading && (
            <StatePanel description="Consultando detalle." title="Cargando" tone="loading" />
          )}

          {selectedBus && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldValue label="Marca" value={selectedBus.marca} />
                <FieldValue label="Modelo" value={selectedBus.modelo} />
                <FieldValue label="Anio" value={String(selectedBus.anio)} />
                <FieldValue
                  label="Kilometraje"
                  value={`${formatNumber(selectedBus.kilometrajeActual)} km`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium uppercase text-slate-400">Estado</p>
                  <div className="mt-2">
                    <StatusBadge status={selectedBus.estadoOperativo} />
                  </div>
                </div>
                <FieldValue
                  label="Conductor"
                  value={selectedBus.conductorAsignado?.nombre ?? 'Sin asignar'}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  icon={<Gauge size={14} />}
                  onClick={() => openAction('mileage', selectedBus)}
                  size="sm"
                  variant="outline"
                >
                  Kilometraje
                </Button>
                <Button
                  icon={<Wrench size={14} />}
                  onClick={() => openAction('state', selectedBus)}
                  size="sm"
                  variant="outline"
                >
                  Estado
                </Button>
                <Button
                  icon={<User size={14} />}
                  onClick={() => openAction('assignment', selectedBus)}
                  size="sm"
                  variant="outline"
                >
                  Asignar
                </Button>
              </div>

              <BusHistory bus={selectedBus} showAssignments />
            </div>
          )}
        </Drawer>

        {action && (
          <ActionDialog
            action={action}
            drivers={drivers}
            error={operationError}
            key={`${action.type}-${action.bus.id}`}
            loadingDrivers={loadingDrivers}
            onClose={() => setAction(null)}
            onSubmit={handleActionSubmit}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}
