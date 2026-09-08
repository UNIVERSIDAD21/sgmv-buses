import { useCallback, useEffect, useState } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'
import { PREVENTIVE_STATUS_LABELS } from '../../domain/labels'
import { formatNumber } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { listPreventiveRestrictions } from './preventive.api'
import type { PreventiveRestrictionDto } from './preventive.types'

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo consultar la proyeccion operativa.'
}

export default function PreventiveRestrictionsPanel() {
  const [items, setItems] = useState<PreventiveRestrictionDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await listPreventiveRestrictions()
      setItems(response.restricciones)
    } catch (loadError) {
      setError(messageFrom(loadError))
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(request)
  }, [load])

  if (!items && !error) {
    return (
      <StatePanel
        description="Consultando restricciones preventivas."
        title="Cargando proyeccion"
        tone="loading"
      />
    )
  }
  if (error) {
    return (
      <StatePanel
        action={<Button onClick={() => void load()}>Reintentar</Button>}
        description={error}
        title="No fue posible cargar"
        tone="error"
      />
    )
  }
  if (items?.length === 0) {
    return (
      <StatePanel
        description="No hay preventivos proximos o vencidos para la operacion."
        title="Sin restricciones preventivas"
        tone="empty"
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <Badge tone="emerald">RF-03</Badge>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">Restricciones preventivas</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Proyeccion operacional para despacho. No incluye diagnosticos, costos ni administracion de
          planes.
        </p>
      </section>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table aria-label="Restricciones preventivas" className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">Bus</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Restante</th>
              <th className="px-4 py-3">Operacion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items?.map((item) => (
              <tr key={item.programacionId}>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.bus.codigoInterno}</td>
                <td className="px-4 py-3">
                  <Badge tone={item.estado === 'VENCIDO' ? 'red' : 'amber'}>
                    {PREVENTIVE_STATUS_LABELS[item.estado]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.restantes.dias !== null ? `${item.restantes.dias} dias` : ''}
                  {item.restantes.dias !== null && item.restantes.kilometros !== null ? ' · ' : ''}
                  {item.restantes.kilometros !== null
                    ? `${formatNumber(item.restantes.kilometros)} km`
                    : ''}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.bloqueaDespacho ? 'Bloquea despacho' : 'Sin bloqueo preventivo'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
