import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'
import { Clock } from '../../components/ui/Icons'
import { useSession } from '../auth/session.context'
import { ApiError } from '../../lib/api'
import { listDispatchWorkOrders } from './work-order.api'
import type { DispatchWorkOrderProjectionDto } from './work-order.types'

type DispatchCause = DispatchWorkOrderProjectionDto['disponibilidad']['causas'][number]

const CAUSE_COPY: Record<string, { action: string; label: string }> = {
  BUS_EN_MANTENIMIENTO: {
    action: 'Revise el estado del bus antes de volver a programarlo.',
    label: 'El bus está en mantenimiento.',
  },
  BUS_FUERA_DE_SERVICIO: {
    action: 'Coordine con Administración la restitución del servicio.',
    label: 'El bus está fuera de servicio.',
  },
  BUS_INACTIVO: {
    action: 'Revise el estado operativo del bus con Administración.',
    label: 'El bus está inactivo.',
  },
  CONFLICTO_JORNADA: {
    action: 'Abra la jornada comprometida para coordinar el recurso.',
    label: 'El recurso ya está comprometido en otra jornada.',
  },
  NOVEDAD_BLOQUEANTE: {
    action: 'Abra la novedad y coordine la atención operativa.',
    label: 'Hay una novedad que impide asignar este bus.',
  },
  ORDEN_TECNICA_ACTIVA: {
    action: 'Coordine con mantenimiento antes de asignar el bus.',
    label: 'Hay una orden de mantenimiento en seguimiento.',
  },
  PREVENTIVO_VENCIDO_BLOQUEANTE: {
    action: 'Coordine la atención preventiva antes de programar una salida.',
    label: 'El mantenimiento preventivo está vencido.',
  },
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operación'
}

function presentationFor(cause: DispatchCause) {
  return (
    CAUSE_COPY[cause.codigo] ?? {
      action: 'Revise el contexto operativo antes de asignar el bus.',
      label: cause.mensaje,
    }
  )
}

function causeLink(cause: DispatchCause, role: string | undefined) {
  switch (cause.origenTipo) {
    case 'BUS':
      return { label: 'Revisar bus', to: `/flota?detalle=${cause.origenId}` }
    case 'JORNADA':
      return { label: 'Abrir jornada', to: `/jornadas?detalle=${cause.origenId}` }
    case 'NOVEDAD':
      return { label: 'Abrir novedad', to: `/novedades?detalle=${cause.origenId}` }
    case 'ORDEN':
      return role === 'ADMINISTRADOR'
        ? { label: 'Abrir orden', to: `/ordenes-trabajo?detalle=${cause.origenId}` }
        : null
    case 'PREVENTIVO':
      return role === 'ADMINISTRADOR'
        ? {
            label: 'Abrir mantenimiento',
            to: `/mantenimiento-preventivo?detalle=${cause.origenId}`,
          }
        : null
  }
}

export default function DispatchWorkOrdersPage() {
  const { user } = useSession()
  const [orders, setOrders] = useState<DispatchWorkOrderProjectionDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listDispatchWorkOrders()
      setOrders(result.ordenes)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0)

    return () => window.clearTimeout(request)
  }, [load])

  if (loading)
    return <StatePanel description="Consultando restricciones operativas." title="Cargando buses" />
  if (error) {
    return (
      <StatePanel
        action={
          <Button icon={<Clock size={15} />} onClick={() => void load()} size="sm">
            Reintentar
          </Button>
        }
        description={error}
        title="No fue posible consultar disponibilidad"
        tone="error"
      />
    )
  }

  return (
    <div className="page-container space-y-5">
      <section className="surface p-4 md:p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Operación</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Disponibilidad de buses</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Confirme si un bus puede salir, conozca todas sus restricciones y abra solo el contexto
          necesario para coordinarlo. Esta vista no muestra diagnósticos, actividades ni costos.
        </p>
      </section>
      {orders.length === 0 ? (
        <StatePanel
          description="No hay buses con órdenes de mantenimiento para revisar."
          title="Sin restricciones asociadas a órdenes"
        />
      ) : (
        <section aria-label="Disponibilidad por bus" className="grid gap-4 lg:grid-cols-2">
          {orders.map((item) => {
            const primaryCause = item.disponibilidad.causas[0]
            const primaryPresentation = primaryCause ? presentationFor(primaryCause) : null
            const primaryLink = primaryCause ? causeLink(primaryCause, user?.rol.codigo) : null

            return (
              <article className="surface p-4" key={item.orden.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {item.orden.bus.codigoInterno} · {item.orden.bus.placa}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Seguimiento asociado: {item.orden.codigo}
                    </p>
                  </div>
                  <Badge tone={item.disponibilidad.disponible ? 'emerald' : 'red'}>
                    {item.disponibilidad.disponible ? 'Disponible para operación' : 'No asignar'}
                  </Badge>
                </div>

                {primaryPresentation ? (
                  <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Restricción principal
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-950">
                      {primaryPresentation.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-900">
                      {primaryPresentation.action}
                    </p>
                    {primaryLink && (
                      <Link
                        className="mt-3 inline-flex min-h-9 items-center rounded-md bg-amber-900 px-3 text-sm font-medium text-white hover:bg-amber-800"
                        to={primaryLink.to}
                      >
                        {primaryLink.label}
                      </Link>
                    )}
                  </section>
                ) : (
                  <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-sm font-semibold text-emerald-900">
                      No hay restricciones operativas activas.
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                      El bus está disponible para programar una salida.
                    </p>
                  </section>
                )}

                {item.disponibilidad.causas.length > 1 && (
                  <section className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Otras restricciones
                    </h3>
                    <ul className="mt-2 space-y-2" aria-label="Otras restricciones operativas">
                      {item.disponibilidad.causas.slice(1).map((cause) => {
                        const presentation = presentationFor(cause)
                        const link = causeLink(cause, user?.rol.codigo)
                        return (
                          <li
                            className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            key={`${cause.codigo}-${cause.origenId}`}
                          >
                            <p>{presentation.label}</p>
                            {link && (
                              <Link
                                className="mt-1 inline-block font-medium text-emerald-700 hover:text-emerald-800"
                                to={link.to}
                              >
                                {link.label}
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                <p className="mt-4 text-xs text-slate-500">
                  Evaluado: {new Date(item.disponibilidad.evaluadoAt).toLocaleString('es-CO')}
                </p>
                {item.orden.fechaCierre && (
                  <p className="mt-1 text-xs text-slate-500">
                    Cierre administrativo:{' '}
                    {new Date(item.orden.fechaCierre).toLocaleString('es-CO')} ·{' '}
                    {item.orden.disponibilidadAlCierre
                      ? 'sin restricciones al cierre'
                      : 'con restricciones al cierre'}
                  </p>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
