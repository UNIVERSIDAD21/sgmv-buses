import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Bus, PlusCircle } from '../../components/ui/Icons'
import StatePanel from '../../components/ui/StatePanel'
import { ApiError } from '../../lib/api'
import { useSession } from '../auth/session.context'
import {
  createModeloBus,
  createRuta,
  getModeloBus,
  listModelosBus,
  listRutas,
  setModeloBusActive,
  setRutaActive,
  updateModeloBus,
  updateRuta,
} from './fleet.api'
import type { ModeloBusSummaryDto, RutaDto } from './fleet.types'

interface ModelFormState {
  especificaciones: string
  id: string | null
  marca: string
  nombreModelo: string
  versionTecnica: string
}

interface RouteFormState {
  codigo: string
  destino: string
  id: string | null
  nombre: string
  origen: string
}

const emptyModelForm: ModelFormState = {
  especificaciones: '{}',
  id: null,
  marca: '',
  nombreModelo: '',
  versionTecnica: '',
}

const emptyRouteForm: RouteFormState = {
  codigo: '',
  destino: '',
  id: null,
  nombre: '',
  origen: '',
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operacion'
}

function Field({
  label,
  onChange,
  required = true,
  value,
}: {
  label: string
  onChange: (value: string) => void
  required?: boolean
  value: string
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  )
}

function CatalogEmpty({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export default function FleetCatalogPage() {
  const { user } = useSession()
  const canEdit = user?.rol.codigo === 'ADMINISTRADOR'
  const [modelos, setModelos] = useState<ModeloBusSummaryDto[]>([])
  const [rutas, setRutas] = useState<RutaDto[]>([])
  const [modelForm, setModelForm] = useState<ModelFormState>(emptyModelForm)
  const [routeForm, setRouteForm] = useState<RouteFormState>(emptyRouteForm)
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'model' | 'route' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const loadCatalogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [modelResponse, routeResponse] = await Promise.all([
        listModelosBus(canEdit && showInactive),
        listRutas(canEdit && showInactive),
      ])
      setModelos(modelResponse.modelosBus)
      setRutas(routeResponse.rutas)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [canEdit, showInactive])

  useEffect(() => {
    let active = true

    Promise.all([listModelosBus(canEdit && showInactive), listRutas(canEdit && showInactive)])
      .then(([modelResponse, routeResponse]) => {
        if (!active) return
        setModelos(modelResponse.modelosBus)
        setRutas(routeResponse.rutas)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [canEdit, showInactive])

  async function handleModelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOperationError(null)
    setFeedback(null)

    let specifications: Record<string, unknown>
    try {
      const parsed = JSON.parse(modelForm.especificaciones) as unknown
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error()
      specifications = parsed as Record<string, unknown>
    } catch {
      setOperationError('Las especificaciones deben ser un objeto JSON valido.')
      return
    }

    setSaving('model')
    try {
      const input = {
        especificaciones: specifications,
        marca: modelForm.marca,
        nombreModelo: modelForm.nombreModelo,
        versionTecnica: modelForm.versionTecnica || null,
      }
      if (modelForm.id) await updateModeloBus(modelForm.id, input)
      else await createModeloBus(input)

      setFeedback(modelForm.id ? 'Modelo de bus actualizado.' : 'Modelo de bus registrado.')
      setModelForm(emptyModelForm)
      await loadCatalogs()
    } catch (saveError) {
      setOperationError(getErrorMessage(saveError))
    } finally {
      setSaving(null)
    }
  }

  async function handleRouteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOperationError(null)
    setFeedback(null)
    setSaving('route')

    try {
      const input = {
        codigo: routeForm.codigo,
        destino: routeForm.destino,
        nombre: routeForm.nombre,
        origen: routeForm.origen,
      }
      if (routeForm.id) await updateRuta(routeForm.id, input)
      else await createRuta(input)

      setFeedback(routeForm.id ? 'Ruta actualizada.' : 'Ruta registrada.')
      setRouteForm(emptyRouteForm)
      await loadCatalogs()
    } catch (saveError) {
      setOperationError(getErrorMessage(saveError))
    } finally {
      setSaving(null)
    }
  }

  async function editModel(model: ModeloBusSummaryDto) {
    setOperationError(null)
    try {
      const response = await getModeloBus(model.id)
      setModelForm({
        especificaciones: JSON.stringify(response.modeloBus.especificaciones ?? {}, null, 2),
        id: model.id,
        marca: response.modeloBus.marca,
        nombreModelo: response.modeloBus.nombreModelo,
        versionTecnica: response.modeloBus.versionTecnica ?? '',
      })
    } catch (loadError) {
      setOperationError(getErrorMessage(loadError))
    }
  }

  async function toggleModel(model: ModeloBusSummaryDto) {
    setOperationError(null)
    try {
      await setModeloBusActive(model.id, !model.activo)
      setFeedback(model.activo ? 'Modelo de bus inactivado.' : 'Modelo de bus activado.')
      await loadCatalogs()
    } catch (toggleError) {
      setOperationError(getErrorMessage(toggleError))
    }
  }

  async function toggleRoute(route: RutaDto) {
    setOperationError(null)
    try {
      await setRutaActive(route.id, !route.activa)
      setFeedback(route.activa ? 'Ruta inactivada.' : 'Ruta activada.')
      await loadCatalogs()
    } catch (toggleError) {
      setOperationError(getErrorMessage(toggleError))
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <StatePanel
          description="Consultando modelos de bus y rutas."
          title="Cargando catalogos"
          tone="loading"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <StatePanel
          action={<Button onClick={() => void loadCatalogs()}>Reintentar</Button>}
          description={error}
          title="No fue posible cargar los catalogos"
          tone="error"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone="emerald">RF-01</Badge>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">Catalogos de operacion</h2>
            <p className="mt-1 text-sm text-slate-500">
              Modelos tecnicos de bus y rutas basicas disponibles para la operacion.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  checked={showInactive}
                  onChange={(event) => {
                    setLoading(true)
                    setShowInactive(event.target.checked)
                  }}
                  type="checkbox"
                />
                Mostrar inactivos
              </label>
            )}
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              to="/flota"
            >
              Volver a flota
            </Link>
          </div>
        </div>
      </section>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      )}
      {operationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {operationError}
        </div>
      )}

      {canEdit && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form
            className="rounded-lg border border-slate-200 bg-white p-5"
            onSubmit={handleModelSubmit}
          >
            <div className="mb-4 flex items-center gap-2">
              <PlusCircle size={17} />
              <h3 className="font-semibold text-slate-900">
                {modelForm.id ? 'Editar modelo de bus' : 'Registrar modelo de bus'}
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Marca"
                onChange={(marca) => setModelForm((state) => ({ ...state, marca }))}
                value={modelForm.marca}
              />
              <Field
                label="Nombre del modelo"
                onChange={(nombreModelo) => setModelForm((state) => ({ ...state, nombreModelo }))}
                value={modelForm.nombreModelo}
              />
              <Field
                label="Version tecnica"
                onChange={(versionTecnica) =>
                  setModelForm((state) => ({ ...state, versionTecnica }))
                }
                required={false}
                value={modelForm.versionTecnica}
              />
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Especificaciones JSON
                <textarea
                  className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) =>
                    setModelForm((state) => ({ ...state, especificaciones: event.target.value }))
                  }
                  value={modelForm.especificaciones}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {modelForm.id && (
                <Button onClick={() => setModelForm(emptyModelForm)} variant="outline">
                  Cancelar
                </Button>
              )}
              <Button loading={saving === 'model'} type="submit">
                Guardar modelo
              </Button>
            </div>
          </form>

          <form
            className="rounded-lg border border-slate-200 bg-white p-5"
            onSubmit={handleRouteSubmit}
          >
            <div className="mb-4 flex items-center gap-2">
              <PlusCircle size={17} />
              <h3 className="font-semibold text-slate-900">
                {routeForm.id ? 'Editar ruta' : 'Registrar ruta'}
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Codigo de ruta"
                onChange={(codigo) => setRouteForm((state) => ({ ...state, codigo }))}
                value={routeForm.codigo}
              />
              <Field
                label="Nombre de ruta"
                onChange={(nombre) => setRouteForm((state) => ({ ...state, nombre }))}
                value={routeForm.nombre}
              />
              <Field
                label="Origen"
                onChange={(origen) => setRouteForm((state) => ({ ...state, origen }))}
                value={routeForm.origen}
              />
              <Field
                label="Destino"
                onChange={(destino) => setRouteForm((state) => ({ ...state, destino }))}
                value={routeForm.destino}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {routeForm.id && (
                <Button onClick={() => setRouteForm(emptyRouteForm)} variant="outline">
                  Cancelar
                </Button>
              )}
              <Button loading={saving === 'route'} type="submit">
                Guardar ruta
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">Modelos de bus</h3>
            <Badge tone="teal">{String(modelos.length)}</Badge>
          </div>
          {modelos.length === 0 ? (
            <CatalogEmpty
              description="Registre un modelo para asociarlo a los buses."
              title="Sin modelos disponibles"
            />
          ) : (
            <div className="space-y-3">
              {modelos.map((model) => (
                <article className="rounded-lg border border-slate-200 p-4" key={model.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Bus size={16} />
                        <p className="font-semibold text-slate-800">
                          {model.marca} {model.nombreModelo}
                        </p>
                        <Badge tone={model.activo ? 'emerald' : 'slate'}>
                          {model.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Version: {model.versionTecnica ?? 'Sin version'} · {model.busesAsociados}{' '}
                        bus(es)
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button onClick={() => void editModel(model)} size="sm" variant="outline">
                          Editar
                        </Button>
                        <Button
                          onClick={() => void toggleModel(model)}
                          size="sm"
                          variant={model.activo ? 'danger' : 'secondary'}
                        >
                          {model.activo ? 'Inactivar' : 'Activar'}
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">Rutas basicas</h3>
            <Badge tone="teal">{String(rutas.length)}</Badge>
          </div>
          {rutas.length === 0 ? (
            <CatalogEmpty
              description="Registre una ruta para usarla como contexto de jornada."
              title="Sin rutas disponibles"
            />
          ) : (
            <div className="space-y-3">
              {rutas.map((route) => (
                <article className="rounded-lg border border-slate-200 p-4" key={route.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-800">
                          {route.codigo} · {route.nombre}
                        </p>
                        <Badge tone={route.activa ? 'emerald' : 'slate'}>
                          {route.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {route.origen} → {route.destino}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {route.jornadasAsociadas} jornada(s) asociada(s)
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            setRouteForm({
                              codigo: route.codigo,
                              destino: route.destino,
                              id: route.id,
                              nombre: route.nombre,
                              origen: route.origen,
                            })
                          }
                          size="sm"
                          variant="outline"
                        >
                          Editar
                        </Button>
                        <Button
                          onClick={() => void toggleRoute(route)}
                          size="sm"
                          variant={route.activa ? 'danger' : 'secondary'}
                        >
                          {route.activa ? 'Inactivar' : 'Activar'}
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
