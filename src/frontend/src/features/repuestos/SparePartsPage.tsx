import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PlusCircle,
  Search,
  Wrench,
} from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import { ApiError } from '../../lib/api'
import { formatCurrency, formatNumber } from '../../lib/format'
import { useSession } from '../auth/session.context'
import {
  activateSparePart,
  createSparePart,
  deactivateSparePart,
  getSparePart,
  getSparePartSummary,
  listInventoryMovements,
  listSparePartMovements,
  listSpareParts,
  registerStockAdjustment,
  registerStockEntry,
  updateSparePart,
  type CreateSparePartInput,
  type StockAdjustmentInput,
  type StockEntryInput,
  type UpdateSparePartInput,
} from './spare-part.api'
import type {
  InventoryMovementType,
  SparePartAvailability,
  SparePartDto,
  SparePartListResponse,
  SparePartMovementDto,
  SparePartMovementListResponse,
  SparePartStatus,
  SparePartSummaryDto,
} from './spare-part.types'

type BadgeTone = 'amber' | 'emerald' | 'red' | 'slate' | 'teal'
type SortField = NonNullable<Parameters<typeof listSpareParts>[0]['ordenarPor']>
type MovementSortField = NonNullable<Parameters<typeof listInventoryMovements>[0]['ordenarPor']>

type ActionState =
  | { type: 'adjustment'; part: SparePartDto }
  | { type: 'create' }
  | { type: 'edit'; part: SparePartDto }
  | { type: 'entry'; part: SparePartDto }
  | { nextStatus: SparePartStatus; part: SparePartDto; type: 'status' }

const availabilityLabels: Record<SparePartAvailability, string> = {
  AGOTADO: 'Agotado',
  BAJO: 'Bajo',
  DISPONIBLE: 'Disponible',
  INACTIVO: 'Inactivo',
}

const availabilityTone: Record<SparePartAvailability, BadgeTone> = {
  AGOTADO: 'red',
  BAJO: 'amber',
  DISPONIBLE: 'emerald',
  INACTIVO: 'slate',
}

const movementLabels: Record<InventoryMovementType, string> = {
  AJUSTE_ENTRADA: 'Ajuste incremento',
  AJUSTE_SALIDA: 'Ajuste disminucion',
  CONSUMO: 'Consumo de orden',
  ENTRADA: 'Entrada',
}

const sortOptions: Array<[SortField, string]> = [
  ['codigo', 'Codigo'],
  ['nombre', 'Nombre'],
  ['stockActual', 'Existencia'],
  ['stockMinimo', 'Minimo'],
  ['costoUnitario', 'Costo'],
  ['categoria', 'Categoria'],
  ['updatedAt', 'Actualizacion'],
]

const movementSortOptions: Array<[MovementSortField, string]> = [
  ['fechaMovimiento', 'Fecha'],
  ['codigo', 'Repuesto'],
  ['tipo', 'Tipo'],
  ['cantidad', 'Cantidad'],
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

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function parsePositive(value: string) {
  const normalized = value.trim().replace(',', '.')

  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) {
    return null
  }

  const numeric = Number(normalized)

  return numeric > 0 ? normalized : null
}

function parseNonNegative(value: string) {
  const normalized = value.trim().replace(',', '.')

  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) {
    return null
  }

  const numeric = Number(normalized)

  return numeric >= 0 ? normalized : null
}

function formatDateTimeValue(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function AvailabilityBadge({ value }: { value: SparePartAvailability }) {
  return <Badge tone={availabilityTone[value]}>{availabilityLabels[value]}</Badge>
}

function StatusBadge({ value }: { value: SparePartStatus }) {
  return (
    <Badge tone={value === 'ACTIVO' ? 'emerald' : 'slate'}>
      {value === 'ACTIVO' ? 'Activo' : 'Inactivo'}
    </Badge>
  )
}

function FieldValue({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-800">{children}</div>
    </div>
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

function MovementReference({ movement }: { movement: SparePartMovementDto }) {
  if (!movement.consumo) {
    return <span className="text-slate-400">Sin orden</span>
  }

  return (
    <span>
      {movement.consumo.orden.codigo}
      <span className="block text-xs text-slate-400">
        Consumo {movement.consumo.id.slice(0, 8)}
      </span>
    </span>
  )
}

function MovementRows({ movements }: { movements: SparePartMovementDto[] }) {
  if (movements.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
        Sin movimientos para los filtros actuales.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Repuesto</th>
            <th className="px-4 py-3 font-medium">Cantidad</th>
            <th className="px-4 py-3 font-medium">Responsable</th>
            <th className="px-4 py-3 font-medium">Referencia</th>
            <th className="px-4 py-3 font-medium">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDateTimeValue(movement.fechaMovimiento)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={movement.direccion === 'ENTRADA' ? 'emerald' : 'amber'}>
                  {movementLabels[movement.tipo]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{movement.repuesto.codigo}</p>
                <p className="text-xs text-slate-500">{movement.repuesto.nombre}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                {movement.direccion === 'SALIDA' ? '-' : '+'}
                {movement.cantidad} {movement.repuesto.unidadMedida}
              </td>
              <td className="px-4 py-3 text-slate-600">{movement.responsable.nombre}</td>
              <td className="px-4 py-3 text-slate-600">
                <MovementReference movement={movement} />
              </td>
              <td className="min-w-56 px-4 py-3 text-slate-500">
                {movement.motivo ?? 'No aplica'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PartCards({
  onAction,
  onOpen,
  parts,
}: {
  onAction: (action: ActionState) => void
  onOpen: (part: SparePartDto) => void
  parts: SparePartDto[]
}) {
  return (
    <div className="grid gap-3 xl:hidden">
      {parts.map((part) => (
        <article className="rounded-lg border border-slate-200 bg-white p-4" key={part.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-slate-900">{part.codigo}</p>
              <p className="mt-1 text-sm text-slate-600">{part.nombre}</p>
            </div>
            <AvailabilityBadge value={part.disponibilidad} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <FieldValue label="Existencia">
              {part.stockActual} {part.unidadMedida}
            </FieldValue>
            <FieldValue label="Minimo">{part.stockMinimo}</FieldValue>
            <FieldValue label="Costo">{formatCurrency(part.costoUnitario)}</FieldValue>
            <FieldValue label="Valor">{formatCurrency(part.valorActual)}</FieldValue>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              icon={<ClipboardList size={14} />}
              onClick={() => onOpen(part)}
              size="sm"
              variant="outline"
            >
              Detalle
            </Button>
            {part.estado === 'ACTIVO' && (
              <>
                <Button
                  icon={<PlusCircle size={14} />}
                  onClick={() => onAction({ part, type: 'entry' })}
                  size="sm"
                >
                  Entrada
                </Button>
                <Button
                  icon={<Wrench size={14} />}
                  onClick={() => onAction({ part, type: 'adjustment' })}
                  size="sm"
                  variant="secondary"
                >
                  Ajuste
                </Button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function PartTable({
  onAction,
  onOpen,
  parts,
}: {
  onAction: (action: ActionState) => void
  onOpen: (part: SparePartDto) => void
  parts: SparePartDto[]
}) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="w-full table-fixed divide-y divide-slate-100 text-[13px]">
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[18%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Codigo</th>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Existencia</th>
            <th className="px-4 py-3 font-medium">Minimo</th>
            <th className="px-4 py-3 font-medium">Disponibilidad</th>
            <th className="px-4 py-3 font-medium">Costo</th>
            <th className="px-4 py-3 font-medium">Valor actual</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-3 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {parts.map((part) => (
            <tr key={part.id}>
              <td className="break-words px-4 py-3 font-semibold text-slate-900">{part.codigo}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{part.nombre}</p>
                <p className="text-xs text-slate-500">{part.categoria ?? 'Sin categoria'}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                {part.stockActual} {part.unidadMedida}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">{part.stockMinimo}</td>
              <td className="px-4 py-3">
                <AvailabilityBadge value={part.disponibilidad} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                {formatCurrency(part.costoUnitario)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                {formatCurrency(part.valorActual)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={part.estado} />
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col items-start gap-2">
                  <Button
                    icon={<ClipboardList size={14} />}
                    onClick={() => onOpen(part)}
                    size="sm"
                    variant="outline"
                  >
                    Detalle
                  </Button>
                  {part.estado === 'ACTIVO' && (
                    <>
                      <Button
                        icon={<PlusCircle size={14} />}
                        onClick={() => onAction({ part, type: 'entry' })}
                        size="sm"
                      >
                        Entrada
                      </Button>
                      <Button
                        icon={<Wrench size={14} />}
                        onClick={() => onAction({ part, type: 'adjustment' })}
                        size="sm"
                        variant="secondary"
                      >
                        Ajuste
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TextInput({
  label,
  onChange,
  required = false,
  type = 'text',
  value,
}: {
  label: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  value: string
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  )
}

function CreateForm({
  error,
  onSubmit,
  submitting,
}: {
  error: string | null
  onSubmit: (input: CreateSparePartInput) => Promise<void>
  submitting: boolean
}) {
  const [categoria, setCategoria] = useState('')
  const [codigo, setCodigo] = useState('')
  const [costoUnitario, setCostoUnitario] = useState('0')
  const [localError, setLocalError] = useState<string | null>(null)
  const [motivoStockInicial, setMotivoStockInicial] = useState('')
  const [nombre, setNombre] = useState('')
  const [stockInicial, setStockInicial] = useState('0')
  const [stockMinimo, setStockMinimo] = useState('0')
  const [unidadMedida, setUnidadMedida] = useState('unidad')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const initial = parseNonNegative(stockInicial)
    const minimum = parseNonNegative(stockMinimo)
    const cost = parseNonNegative(costoUnitario)

    if (!normalizeText(codigo) || !normalizeText(nombre) || !normalizeText(unidadMedida)) {
      setLocalError('Codigo, nombre y unidad son obligatorios.')
      return
    }

    if (!initial || !minimum || !cost) {
      setLocalError('Stock y costo deben ser valores validos.')
      return
    }

    await onSubmit({
      categoria: normalizeText(categoria) || undefined,
      claveIdempotencia: Number(initial) > 0 ? idempotencyKey() : undefined,
      codigo: normalizeText(codigo),
      costoUnitario: cost,
      motivoStockInicial:
        Number(initial) > 0
          ? normalizeText(motivoStockInicial) || 'Existencia inicial autorizada'
          : undefined,
      nombre: normalizeText(nombre),
      stockInicial: initial,
      stockMinimo: minimum,
      unidadMedida: normalizeText(unidadMedida),
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {(error || localError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? localError}
        </p>
      )}
      <TextInput label="Codigo" onChange={setCodigo} required value={codigo} />
      <TextInput label="Nombre" onChange={setNombre} required value={nombre} />
      <TextInput label="Categoria" onChange={setCategoria} value={categoria} />
      <TextInput
        label="Unidad de medida"
        onChange={setUnidadMedida}
        required
        value={unidadMedida}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput label="Stock inicial" onChange={setStockInicial} required value={stockInicial} />
        <TextInput label="Stock minimo" onChange={setStockMinimo} required value={stockMinimo} />
        <TextInput
          label="Costo unitario"
          onChange={setCostoUnitario}
          required
          value={costoUnitario}
        />
      </div>
      {Number(stockInicial) > 0 && (
        <label className="block text-sm font-medium text-slate-700">
          Motivo de stock inicial
          <textarea
            className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setMotivoStockInicial(event.target.value)}
            value={motivoStockInicial}
          />
        </label>
      )}
      <Button icon={<PlusCircle size={14} />} loading={submitting} type="submit">
        Crear repuesto
      </Button>
    </form>
  )
}

function EditForm({
  error,
  onSubmit,
  part,
  submitting,
}: {
  error: string | null
  onSubmit: (input: UpdateSparePartInput) => Promise<void>
  part: SparePartDto
  submitting: boolean
}) {
  const [categoria, setCategoria] = useState(part.categoria ?? '')
  const [codigo, setCodigo] = useState(part.codigo)
  const [costoUnitario, setCostoUnitario] = useState(part.costoUnitario)
  const [localError, setLocalError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(part.nombre)
  const [stockMinimo, setStockMinimo] = useState(part.stockMinimo)
  const [unidadMedida, setUnidadMedida] = useState(part.unidadMedida)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const minimum = parseNonNegative(stockMinimo)
    const cost = parseNonNegative(costoUnitario)

    if (!minimum || !cost) {
      setLocalError('Minimo y costo deben ser valores validos.')
      return
    }

    await onSubmit({
      categoria: normalizeText(categoria) || undefined,
      codigo: normalizeText(codigo),
      costoUnitario: cost,
      nombre: normalizeText(nombre),
      stockMinimo: minimum,
      unidadMedida: normalizeText(unidadMedida),
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {(error || localError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? localError}
        </p>
      )}
      <TextInput label="Codigo" onChange={setCodigo} required value={codigo} />
      <TextInput label="Nombre" onChange={setNombre} required value={nombre} />
      <TextInput label="Categoria" onChange={setCategoria} value={categoria} />
      <TextInput
        label="Unidad de medida"
        onChange={setUnidadMedida}
        required
        value={unidadMedida}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Stock minimo" onChange={setStockMinimo} required value={stockMinimo} />
        <TextInput
          label="Costo unitario"
          onChange={setCostoUnitario}
          required
          value={costoUnitario}
        />
      </div>
      <Button icon={<CheckCircle size={14} />} loading={submitting} type="submit">
        Guardar cambios
      </Button>
    </form>
  )
}

function EntryForm({
  error,
  onSubmit,
  part,
  submitting,
}: {
  error: string | null
  onSubmit: (input: StockEntryInput) => Promise<void>
  part: SparePartDto
  submitting: boolean
}) {
  const [cantidad, setCantidad] = useState('')
  const [costoUnitario, setCostoUnitario] = useState(part.costoUnitario)
  const [localError, setLocalError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const quantity = parsePositive(cantidad)
    const cost = costoUnitario.trim() ? parseNonNegative(costoUnitario) : null

    if (!quantity) {
      setLocalError('La cantidad debe ser mayor que cero.')
      return
    }

    if (costoUnitario.trim() && !cost) {
      setLocalError('El costo debe ser valido.')
      return
    }

    if (normalizeText(motivo).length < 3) {
      setLocalError('El motivo debe tener al menos 3 caracteres.')
      return
    }

    await onSubmit({
      cantidad: quantity,
      claveIdempotencia: idempotencyKey(),
      ...(cost ? { costoUnitario: cost } : {}),
      motivo: normalizeText(motivo),
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {(error || localError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? localError}
        </p>
      )}
      <FieldValue label="Existencia actual">
        {part.stockActual} {part.unidadMedida}
      </FieldValue>
      <TextInput label="Cantidad de entrada" onChange={setCantidad} required value={cantidad} />
      <TextInput label="Costo unitario futuro" onChange={setCostoUnitario} value={costoUnitario} />
      <label className="block text-sm font-medium text-slate-700">
        Motivo
        <textarea
          className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          onChange={(event) => setMotivo(event.target.value)}
          required
          value={motivo}
        />
      </label>
      <Button icon={<PlusCircle size={14} />} loading={submitting} type="submit">
        Registrar entrada
      </Button>
    </form>
  )
}

function AdjustmentForm({
  error,
  onSubmit,
  part,
  submitting,
}: {
  error: string | null
  onSubmit: (input: StockAdjustmentInput) => Promise<void>
  part: SparePartDto
  submitting: boolean
}) {
  const [cantidad, setCantidad] = useState('')
  const [confirmDecrease, setConfirmDecrease] = useState(false)
  const [direccion, setDireccion] = useState<'DISMINUCION' | 'INCREMENTO'>('INCREMENTO')
  const [localError, setLocalError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const quantity = Number(cantidad || 0)
  const current = Number(part.stockActual)
  const estimated =
    direccion === 'INCREMENTO'
      ? current + (Number.isFinite(quantity) ? quantity : 0)
      : current - (Number.isFinite(quantity) ? quantity : 0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const parsed = parsePositive(cantidad)

    if (!parsed) {
      setLocalError('La cantidad debe ser mayor que cero.')
      return
    }

    if (direccion === 'DISMINUCION' && !confirmDecrease) {
      setLocalError('Confirme la disminucion antes de registrar el ajuste.')
      return
    }

    if (normalizeText(motivo).length < 3) {
      setLocalError('El motivo debe tener al menos 3 caracteres.')
      return
    }

    await onSubmit({
      cantidad: parsed,
      claveIdempotencia: idempotencyKey(),
      direccion,
      motivo: normalizeText(motivo),
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {(error || localError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? localError}
        </p>
      )}
      <FieldValue label="Existencia actual">
        {part.stockActual} {part.unidadMedida}
      </FieldValue>
      <label className="block text-sm font-medium text-slate-700">
        Direccion
        <select
          className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          onChange={(event) => {
            setDireccion(event.target.value as 'DISMINUCION' | 'INCREMENTO')
            setConfirmDecrease(false)
          }}
          value={direccion}
        >
          <option value="INCREMENTO">Incremento</option>
          <option value="DISMINUCION">Disminucion</option>
        </select>
      </label>
      <TextInput label="Cantidad" onChange={setCantidad} required value={cantidad} />
      <FieldValue label="Resultado estimado">
        {Number.isFinite(estimated) ? estimated.toFixed(2) : part.stockActual}
      </FieldValue>
      <label className="block text-sm font-medium text-slate-700">
        Motivo
        <textarea
          className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          onChange={(event) => setMotivo(event.target.value)}
          required
          value={motivo}
        />
      </label>
      {direccion === 'DISMINUCION' && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <input
            checked={confirmDecrease}
            className="mt-1"
            onChange={(event) => setConfirmDecrease(event.target.checked)}
            type="checkbox"
          />
          Confirmo la disminucion de existencia.
        </label>
      )}
      <Button icon={<Wrench size={14} />} loading={submitting} type="submit" variant="secondary">
        Registrar ajuste
      </Button>
    </form>
  )
}

function StatusConfirm({
  error,
  onConfirm,
  part,
  submitting,
  target,
}: {
  error: string | null
  onConfirm: () => Promise<void>
  part: SparePartDto
  submitting: boolean
  target: SparePartStatus
}) {
  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <FieldValue label="Repuesto">
        {part.codigo} - {part.nombre}
      </FieldValue>
      <FieldValue label="Existencia">
        {part.stockActual} {part.unidadMedida}
      </FieldValue>
      {target === 'INACTIVO' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
          El historial y la existencia se conservan.
        </p>
      )}
      <Button
        icon={target === 'ACTIVO' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
        loading={submitting}
        onClick={onConfirm}
        variant={target === 'ACTIVO' ? 'primary' : 'danger'}
      >
        {target === 'ACTIVO' ? 'Activar' : 'Desactivar'}
      </Button>
    </div>
  )
}

export default function SparePartsPage() {
  const { user } = useSession()
  const [action, setAction] = useState<ActionState | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [detailMovements, setDetailMovements] = useState<SparePartMovementListResponse | null>(null)
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('asc')
  const [disponibilidad, setDisponibilidad] = useState<SparePartAvailability | ''>('')
  const [estado, setEstado] = useState<SparePartStatus | ''>('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [listData, setListData] = useState<SparePartListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [movementBusquedas, setMovementBusquedas] = useState('')
  const [movementData, setMovementData] = useState<SparePartMovementListResponse | null>(null)
  const [movementDireccion, setMovementDireccion] = useState<'asc' | 'desc'>('desc')
  const [movementOrdenarPor, setMovementOrdenarPor] = useState<MovementSortField>('fechaMovimiento')
  const [movementPagina, setMovementPagina] = useState(1)
  const [movementTipo, setMovementTipo] = useState<InventoryMovementType | ''>('')
  const [ordenarPor, setOrdenarPor] = useState<SortField>('codigo')
  const [pagina, setPagina] = useState(1)
  const [selectedPart, setSelectedPart] = useState<SparePartDto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState<SparePartSummaryDto | null>(null)

  const isAdmin = user?.rol.codigo === 'ADMINISTRADOR'

  const listParams = useMemo(
    () => ({
      busqueda,
      categoria,
      direccion,
      disponibilidad,
      estado,
      limite: 8,
      ordenarPor,
      pagina,
    }),
    [busqueda, categoria, direccion, disponibilidad, estado, ordenarPor, pagina],
  )

  const movementParams = useMemo(
    () => ({
      busqueda: movementBusquedas,
      direccion: movementDireccion,
      limite: 6,
      ordenarPor: movementOrdenarPor,
      pagina: movementPagina,
      tipo: movementTipo,
    }),
    [movementBusquedas, movementDireccion, movementOrdenarPor, movementPagina, movementTipo],
  )

  const refreshData = useCallback(async () => {
    const [summaryData, listResponse, movementResponse] = await Promise.all([
      getSparePartSummary(),
      listSpareParts(listParams),
      listInventoryMovements(movementParams),
    ])

    setSummary(summaryData)
    setListData(listResponse)
    setMovementData(movementResponse)
  }, [listParams, movementParams])

  useEffect(() => {
    let active = true

    async function load() {
      if (!isAdmin) {
        return
      }

      setLoading(true)
      setLoadError(null)

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

    load()

    return () => {
      active = false
    }
  }, [isAdmin, refreshData])

  async function openDetail(part: SparePartDto) {
    setSelectedPart(part)
    setLoadError(null)

    try {
      const [detail, movements] = await Promise.all([
        getSparePart(part.id),
        listSparePartMovements(part.id, {
          direccion: 'desc',
          limite: 6,
          ordenarPor: 'fechaMovimiento',
          pagina: 1,
        }),
      ])

      setSelectedPart(detail.repuesto)
      setDetailMovements(movements)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    }
  }

  async function refreshSelected(partId: string) {
    const [detail, movements] = await Promise.all([
      getSparePart(partId),
      listSparePartMovements(partId, {
        direccion: 'desc',
        limite: 6,
        ordenarPor: 'fechaMovimiento',
        pagina: 1,
      }),
    ])

    setSelectedPart(detail.repuesto)
    setDetailMovements(movements)
  }

  async function runAction(operation: () => Promise<{ id: string }>, message: string) {
    setSubmitting(true)
    setFormError(null)
    setFeedback(null)

    try {
      const result = await operation()

      setFeedback(message)
      setAction(null)
      await refreshData()
      await refreshSelected(result.id)
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreate(input: CreateSparePartInput) {
    await runAction(async () => {
      const result = await createSparePart(input)
      setSelectedPart(result.repuesto)
      return { id: result.repuesto.id }
    }, 'Repuesto creado.')
  }

  async function handleUpdate(input: UpdateSparePartInput) {
    if (!selectedPart) {
      return
    }

    await runAction(async () => {
      const result = await updateSparePart(selectedPart.id, input)
      return { id: result.repuesto.id }
    }, 'Repuesto actualizado.')
  }

  async function handleEntry(part: SparePartDto, input: StockEntryInput) {
    await runAction(async () => {
      const result = await registerStockEntry(part.id, input)
      return { id: result.repuesto.id }
    }, 'Entrada registrada.')
  }

  async function handleAdjustment(part: SparePartDto, input: StockAdjustmentInput) {
    await runAction(async () => {
      const result = await registerStockAdjustment(part.id, input)
      return { id: result.repuesto.id }
    }, 'Ajuste registrado.')
  }

  async function handleStatus(part: SparePartDto, nextStatus: SparePartStatus) {
    await runAction(
      async () => {
        const result =
          nextStatus === 'ACTIVO'
            ? await activateSparePart(part.id)
            : await deactivateSparePart(part.id)

        return { id: result.repuesto.id }
      },
      nextStatus === 'ACTIVO' ? 'Repuesto activado.' : 'Repuesto desactivado.',
    )
  }

  function clearFilters() {
    setBusqueda('')
    setCategoria('')
    setDisponibilidad('')
    setEstado('')
    setPagina(1)
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <StatePanel
          description="Su rol no participa en la administracion de RF-05."
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
          <Badge tone="emerald">RF-05</Badge>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Central de repuestos</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Catalogo, existencias, entradas, ajustes y movimientos trazables del taller.
              </p>
            </div>
            <Button icon={<PlusCircle size={16} />} onClick={() => setAction({ type: 'create' })}>
              Nuevo repuesto
            </Button>
          </div>
        </section>

        {feedback && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </p>
        )}
        {loadError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <FieldValue label="Activos">{summary?.totalActivos ?? '...'}</FieldValue>
          <FieldValue label="Disponibles">{summary?.disponibles ?? '...'}</FieldValue>
          <FieldValue label="Bajo stock">{summary?.bajoStock ?? '...'}</FieldValue>
          <FieldValue label="Agotados">{summary?.agotados ?? '...'}</FieldValue>
          <FieldValue label="Inactivos">{summary?.inactivos ?? '...'}</FieldValue>
          <FieldValue label="Valor actual">
            {summary ? formatCurrency(summary.valorInventario) : '...'}
          </FieldValue>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(220px,1fr)_180px_170px_140px_150px_auto]">
            <label className="block text-sm font-medium text-slate-700">
              Buscar
              <div className="relative mt-1.5">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                  size={15}
                />
                <input
                  className="min-h-10 w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => {
                    setBusqueda(event.target.value)
                    setPagina(1)
                  }}
                  value={busqueda}
                />
              </div>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Categoria
              <input
                className="mt-1.5 min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setCategoria(event.target.value)
                  setPagina(1)
                }}
                value={categoria}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Disponibilidad
              <select
                className="mt-1.5 min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setDisponibilidad(event.target.value as SparePartAvailability | '')
                  setPagina(1)
                }}
                value={disponibilidad}
              >
                <option value="">Todas</option>
                {Object.entries(availabilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Estado
              <select
                className="mt-1.5 min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setEstado(event.target.value as SparePartStatus | '')
                  setPagina(1)
                }}
                value={estado}
              >
                <option value="">Todos</option>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Ordenar
              <select
                className="mt-1.5 min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
            <Button
              icon={<ChevronRight size={14} />}
              onClick={() => setDireccion((value) => (value === 'asc' ? 'desc' : 'asc'))}
              size="sm"
              variant="outline"
            >
              {direccion === 'asc' ? 'Asc' : 'Desc'}
            </Button>
          </div>

          {loading ? (
            <div className="p-4">
              <StatePanel title="Cargando repuestos" tone="loading" />
            </div>
          ) : listData?.repuestos.length ? (
            <>
              <PartTable onAction={setAction} onOpen={openDetail} parts={listData.repuestos} />
              <div className="p-4 xl:hidden">
                <PartCards onAction={setAction} onOpen={openDetail} parts={listData.repuestos} />
              </div>
              <Pagination
                onNext={() => setPagina((value) => value + 1)}
                onPrev={() => setPagina((value) => Math.max(1, value - 1))}
                pagina={listData.paginacion.pagina}
                totalPaginas={listData.paginacion.totalPaginas}
              />
            </>
          ) : (
            <div className="p-4">
              <StatePanel
                action={
                  <Button onClick={clearFilters} size="sm" variant="outline">
                    Limpiar filtros
                  </Button>
                }
                title="Sin repuestos para mostrar"
                tone="empty"
              />
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(220px,1fr)_200px_170px_140px_auto]">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Movimientos de inventario</h3>
              <p className="mt-1 text-xs text-slate-500">
                {movementData
                  ? `${formatNumber(movementData.paginacion.total)} registros`
                  : 'Consultando registros'}
              </p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Buscar
              <input
                className="mt-1.5 min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setMovementBusquedas(event.target.value)
                  setMovementPagina(1)
                }}
                value={movementBusquedas}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Tipo
              <select
                className="mt-1.5 min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setMovementTipo(event.target.value as InventoryMovementType | '')
                  setMovementPagina(1)
                }}
                value={movementTipo}
              >
                <option value="">Todos</option>
                {Object.entries(movementLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Ordenar
              <select
                className="mt-1.5 min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setMovementOrdenarPor(event.target.value as MovementSortField)}
                value={movementOrdenarPor}
              >
                {movementSortOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              icon={<ChevronRight size={14} />}
              onClick={() => setMovementDireccion((value) => (value === 'asc' ? 'desc' : 'asc'))}
              size="sm"
              variant="outline"
            >
              {movementDireccion === 'asc' ? 'Asc' : 'Desc'}
            </Button>
          </div>
          <div className="p-4">
            <MovementRows movements={movementData?.movimientos ?? []} />
          </div>
          {movementData && (
            <Pagination
              onNext={() => setMovementPagina((value) => value + 1)}
              onPrev={() => setMovementPagina((value) => Math.max(1, value - 1))}
              pagina={movementData.paginacion.pagina}
              totalPaginas={movementData.paginacion.totalPaginas}
            />
          )}
        </section>
      </div>

      <Drawer
        onClose={() => setSelectedPart(null)}
        open={Boolean(selectedPart)}
        subtitle={selectedPart ? `${selectedPart.codigo} - ${selectedPart.nombre}` : undefined}
        title="Detalle de repuesto"
      >
        {selectedPart && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldValue label="Disponibilidad">
                <AvailabilityBadge value={selectedPart.disponibilidad} />
              </FieldValue>
              <FieldValue label="Estado">
                <StatusBadge value={selectedPart.estado} />
              </FieldValue>
              <FieldValue label="Existencia">
                {selectedPart.stockActual} {selectedPart.unidadMedida}
              </FieldValue>
              <FieldValue label="Minimo">{selectedPart.stockMinimo}</FieldValue>
              <FieldValue label="Costo">{formatCurrency(selectedPart.costoUnitario)}</FieldValue>
              <FieldValue label="Valor actual">
                {formatCurrency(selectedPart.valorActual)}
              </FieldValue>
              <FieldValue label="Categoria">{selectedPart.categoria ?? 'Sin categoria'}</FieldValue>
              <FieldValue label="Actualizacion">
                {formatDateTimeValue(selectedPart.updatedAt)}
              </FieldValue>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<ClipboardList size={14} />}
                onClick={() => setAction({ part: selectedPart, type: 'edit' })}
                size="sm"
                variant="outline"
              >
                Editar
              </Button>
              {selectedPart.estado === 'ACTIVO' && (
                <>
                  <Button
                    icon={<PlusCircle size={14} />}
                    onClick={() => setAction({ part: selectedPart, type: 'entry' })}
                    size="sm"
                  >
                    Entrada
                  </Button>
                  <Button
                    icon={<Wrench size={14} />}
                    onClick={() => setAction({ part: selectedPart, type: 'adjustment' })}
                    size="sm"
                    variant="secondary"
                  >
                    Ajuste
                  </Button>
                  <Button
                    icon={<AlertTriangle size={14} />}
                    onClick={() =>
                      setAction({ nextStatus: 'INACTIVO', part: selectedPart, type: 'status' })
                    }
                    size="sm"
                    variant="danger"
                  >
                    Desactivar
                  </Button>
                </>
              )}
              {selectedPart.estado === 'INACTIVO' && (
                <Button
                  icon={<CheckCircle size={14} />}
                  onClick={() =>
                    setAction({ nextStatus: 'ACTIVO', part: selectedPart, type: 'status' })
                  }
                  size="sm"
                >
                  Activar
                </Button>
              )}
            </div>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500">
                Movimientos del repuesto
              </h3>
              <div className="mt-3">
                <MovementRows movements={detailMovements?.movimientos ?? []} />
              </div>
            </section>
          </div>
        )}
      </Drawer>

      <Drawer
        onClose={() => {
          setAction(null)
          setFormError(null)
        }}
        open={Boolean(action)}
        subtitle={
          action && 'part' in action ? `${action.part.codigo} - ${action.part.nombre}` : undefined
        }
        title={
          action?.type === 'create'
            ? 'Nuevo repuesto'
            : action?.type === 'edit'
              ? 'Editar repuesto'
              : action?.type === 'entry'
                ? 'Registrar entrada'
                : action?.type === 'adjustment'
                  ? 'Registrar ajuste'
                  : 'Confirmar estado'
        }
      >
        {action?.type === 'create' && (
          <CreateForm error={formError} onSubmit={handleCreate} submitting={submitting} />
        )}
        {action?.type === 'edit' && (
          <EditForm
            error={formError}
            onSubmit={handleUpdate}
            part={action.part}
            submitting={submitting}
          />
        )}
        {action?.type === 'entry' && (
          <EntryForm
            error={formError}
            onSubmit={(input) => handleEntry(action.part, input)}
            part={action.part}
            submitting={submitting}
          />
        )}
        {action?.type === 'adjustment' && (
          <AdjustmentForm
            error={formError}
            onSubmit={(input) => handleAdjustment(action.part, input)}
            part={action.part}
            submitting={submitting}
          />
        )}
        {action?.type === 'status' && (
          <StatusConfirm
            error={formError}
            onConfirm={() => handleStatus(action.part, action.nextStatus)}
            part={action.part}
            submitting={submitting}
            target={action.nextStatus}
          />
        )}
      </Drawer>
    </div>
  )
}
