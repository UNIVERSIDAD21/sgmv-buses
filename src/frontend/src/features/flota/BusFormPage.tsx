import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'
import { BUS_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import { createBus, getBus, updateBus, type BusFormInput } from './fleet.api'
import type { BusDetailDto, BusStatus } from './fleet.types'

interface FormState {
  anio: string
  codigoInterno: string
  estadoOperativo: BusStatus
  kilometrajeActual: string
  marca: string
  modelo: string
  motivoEstado: string
  placa: string
}

const statusOptions = Object.entries(BUS_STATUS_LABELS) as Array<[BusStatus, string]>
const currentYear = new Date().getFullYear()

function emptyForm(): FormState {
  return {
    anio: String(currentYear),
    codigoInterno: '',
    estadoOperativo: 'OPERATIVO',
    kilometrajeActual: '0',
    marca: '',
    modelo: '',
    motivoEstado: '',
    placa: '',
  }
}

function normalizeIdentifier(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'No se pudo guardar el bus'
}

function formFromBus(bus: BusDetailDto): FormState {
  return {
    anio: String(bus.anio),
    codigoInterno: bus.codigoInterno,
    estadoOperativo: bus.estadoOperativo,
    kilometrajeActual: String(bus.kilometrajeActual),
    marca: bus.marca,
    modelo: bus.modelo,
    motivoEstado: '',
    placa: bus.placa,
  }
}

export default function BusFormPage() {
  const { busId } = useParams()
  const isEditing = Boolean(busId)
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedBus, setSavedBus] = useState<BusDetailDto | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true

    async function loadBus() {
      if (!busId) {
        return
      }

      setLoading(true)
      setLoadError(null)

      try {
        const data = await getBus(busId)

        if (active) {
          setForm(formFromBus(data.bus))
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

    loadBus()

    return () => {
      active = false
    }
  }, [busId])

  const normalized = useMemo(
    () => ({
      codigoInterno: normalizeIdentifier(form.codigoInterno),
      marca: normalizeText(form.marca),
      modelo: normalizeText(form.modelo),
      placa: normalizeIdentifier(form.placa),
    }),
    [form.codigoInterno, form.marca, form.modelo, form.placa],
  )

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function validate() {
    const errors: Record<string, string> = {}
    const anio = Number(form.anio)
    const kilometrajeActual = Number(form.kilometrajeActual)

    if (!normalized.codigoInterno) {
      errors.codigoInterno = 'El codigo interno es obligatorio.'
    }

    if (!normalized.placa) {
      errors.placa = 'La placa es obligatoria.'
    }

    if (!normalized.marca) {
      errors.marca = 'La marca es obligatoria.'
    }

    if (!normalized.modelo) {
      errors.modelo = 'El modelo es obligatorio.'
    }

    if (!Number.isInteger(anio) || anio < 1980 || anio > currentYear + 1) {
      errors.anio = `El anio debe estar entre 1980 y ${currentYear + 1}.`
    }

    if (!isEditing && (!Number.isInteger(kilometrajeActual) || kilometrajeActual < 0)) {
      errors.kilometrajeActual = 'El kilometraje inicial debe ser cero o mayor.'
    }

    if (!isEditing && form.estadoOperativo !== 'OPERATIVO' && form.motivoEstado.trim().length < 3) {
      errors.motivoEstado = 'Indique el motivo del estado inicial.'
    }

    setFieldErrors(errors)

    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setSavedBus(null)

    if (!validate()) {
      return
    }

    const baseInput = {
      anio: Number(form.anio),
      codigoInterno: normalized.codigoInterno,
      marca: normalized.marca,
      modelo: normalized.modelo,
      placa: normalized.placa,
    }

    setSaving(true)

    try {
      const result = isEditing
        ? await updateBus(busId!, baseInput)
        : await createBus({
            ...baseInput,
            estadoOperativo: form.estadoOperativo,
            kilometrajeActual: Number(form.kilometrajeActual),
            motivoEstado: form.motivoEstado.trim() || undefined,
          } satisfies BusFormInput)

      setSavedBus(result.bus)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <StatePanel description="Consultando bus." title="Cargando formulario" tone="loading" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <StatePanel
          action={
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              to="/flota"
            >
              Volver a flota
            </Link>
          }
          description={loadError}
          title="No fue posible cargar el bus"
          tone="error"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge tone="emerald">RF-01</Badge>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              {isEditing ? 'Editar bus' : 'Registrar bus'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isEditing
                ? 'Kilometraje y estado se actualizan desde el detalle trazado.'
                : 'Los identificadores se normalizan antes de guardar.'}
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            to="/flota"
          >
            Cancelar
          </Link>
        </div>

        {savedBus && (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {isEditing ? 'Bus actualizado' : 'Bus registrado'}: {savedBus.codigoInterno} -{' '}
            {savedBus.placa}
          </div>
        )}

        {submitError && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase text-slate-500">
              Identificacion
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Codigo interno
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => updateField('codigoInterno', event.target.value)}
                  value={form.codigoInterno}
                />
                <span className="mt-1 block text-xs text-slate-400">
                  Se guardara como {normalized.codigoInterno || '...'}
                </span>
                {fieldErrors.codigoInterno && (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.codigoInterno}
                  </span>
                )}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Placa
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => updateField('placa', event.target.value)}
                  value={form.placa}
                />
                <span className="mt-1 block text-xs text-slate-400">
                  Se guardara como {normalized.placa || '...'}
                </span>
                {fieldErrors.placa && (
                  <span className="mt-1 block text-xs text-red-600">{fieldErrors.placa}</span>
                )}
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase text-slate-500">
              Datos del vehiculo
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Marca
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => updateField('marca', event.target.value)}
                  value={form.marca}
                />
                {fieldErrors.marca && (
                  <span className="mt-1 block text-xs text-red-600">{fieldErrors.marca}</span>
                )}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Modelo
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => updateField('modelo', event.target.value)}
                  value={form.modelo}
                />
                {fieldErrors.modelo && (
                  <span className="mt-1 block text-xs text-red-600">{fieldErrors.modelo}</span>
                )}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Anio
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => updateField('anio', event.target.value)}
                  type="number"
                  value={form.anio}
                />
                {fieldErrors.anio && (
                  <span className="mt-1 block text-xs text-red-600">{fieldErrors.anio}</span>
                )}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Kilometraje actual
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={isEditing}
                  min={0}
                  onChange={(event) => updateField('kilometrajeActual', event.target.value)}
                  type="number"
                  value={form.kilometrajeActual}
                />
                {isEditing && (
                  <span className="mt-1 block text-xs text-slate-400">
                    Actual: {formatNumber(Number(form.kilometrajeActual) || 0)} km
                  </span>
                )}
                {fieldErrors.kilometrajeActual && (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.kilometrajeActual}
                  </span>
                )}
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase text-slate-500">
              Estado operativo
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Estado inicial
                <select
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={isEditing}
                  onChange={(event) => updateField('estadoOperativo', event.target.value)}
                  value={form.estadoOperativo}
                >
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Motivo del estado
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={isEditing || form.estadoOperativo === 'OPERATIVO'}
                  onChange={(event) => updateField('motivoEstado', event.target.value)}
                  value={form.motivoEstado}
                />
                {fieldErrors.motivoEstado && (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.motivoEstado}
                  </span>
                )}
              </label>
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              to="/flota"
            >
              Cancelar
            </Link>
            <Button loading={saving} type="submit">
              Guardar
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
