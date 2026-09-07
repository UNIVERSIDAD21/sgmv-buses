import { useCallback, useEffect, useState } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'
import { Clock } from '../../components/ui/Icons'
import { ApiError } from '../../lib/api'
import { listDispatchWorkOrders } from './work-order.api'
import type { DispatchWorkOrderProjectionDto } from './work-order.types'

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operacion'
}

export default function DispatchWorkOrdersPage() {
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
    let active = true

    async function loadInitialOrders() {
      try {
        const result = await listDispatchWorkOrders()
        if (active) setOrders(result.ordenes)
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInitialOrders()
    return () => {
      active = false
    }
  }, [])

  if (loading)
    return <StatePanel description="Consultando bloqueos operativos." title="Cargando ordenes" />
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
    <div className="space-y-5">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          RF-04 operativo
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Disponibilidad por orden tecnica</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vista de despacho: solo estado operativo y restricciones, sin diagnosticos, actividades ni
          costos.
        </p>
      </section>
      {orders.length === 0 ? (
        <StatePanel description="No hay ordenes tecnicas registradas." title="Sin ordenes" />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {orders.map((item) => (
            <article
              className="rounded-lg border border-slate-200 bg-white p-4"
              key={item.orden.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">{item.orden.codigo}</h2>
                  <p className="text-sm text-slate-600">
                    {item.orden.bus.codigoInterno} · {item.orden.bus.placa}
                  </p>
                </div>
                <Badge tone={item.disponibilidad.disponible ? 'emerald' : 'red'}>
                  {item.disponibilidad.disponible ? 'Disponible' : 'Restringido'}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-slate-700">
                {item.disponibilidad.causaPrincipal
                  ? `Causa principal: ${item.disponibilidad.causaPrincipal.replaceAll('_', ' ')}`
                  : 'No hay causas bloqueantes.'}
              </p>
              {item.orden.fechaCierre && (
                <p className="mt-2 text-xs text-slate-500">
                  Cierre administrativo: {new Date(item.orden.fechaCierre).toLocaleString('es-CO')}
                  {' · '}
                  Snapshot: {item.orden.disponibilidadAlCierre ? 'disponible' : 'con restricciones'}
                </p>
              )}
              {item.disponibilidad.causas.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {item.disponibilidad.causas.map((cause) => (
                    <li key={cause.codigo}>{cause.mensaje}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
