import { useState } from 'react'

import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import type { JourneyAttentionCategory, JourneyDto } from './journey.types'
import type { JourneyAction } from './journey.view'

export default function JourneyDecisionDialog({
  category,
  journey,
  onClose,
  onAction,
}: {
  category: JourneyAttentionCategory
  journey: JourneyDto
  onClose: () => void
  onAction: (action: JourneyAction, journey: JourneyDto) => void
}) {
  const [choice, setChoice] = useState<'missing' | 'departed' | 'unknown' | 'no-reading' | null>(
    null,
  )
  const title =
    category === 'CIERRE_PENDIENTE'
      ? 'Resolver cierre'
      : category === 'SALIDA_SIN_CONFIRMAR'
        ? 'Resolver situación'
        : 'Gestionar relevo'
  const openAction = (action: JourneyAction) => {
    onClose()
    onAction(action, journey)
  }

  return (
    <Modal
      onClose={onClose}
      subtitle={`${journey.bus.codigoInterno} · ${journey.conductor.nombre}`}
      title={title}
    >
      <div className="space-y-4 p-5 text-sm text-slate-700">
        {category === 'CIERRE_PENDIENTE' && (
          <>
            <p>
              Para cerrar necesitas la hora real de llegada y la lectura real del odómetro. ¿Tienes
              esos datos?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openAction('finish')}>Sí, registrar datos reales</Button>
              <Button onClick={() => setChoice('missing')} variant="outline">
                No tengo la información
              </Button>
            </div>
          </>
        )}
        {category === 'SALIDA_SIN_CONFIRMAR' && (
          <>
            <p>
              La hora programada ya pasó, pero no hay registro de salida. ¿Qué ocurrió con esta
              jornada?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setChoice('departed')}>El bus sí salió</Button>
              {journey.acciones.puedeCancelar && (
                <Button onClick={() => openAction('cancel')} variant="outline">
                  El viaje no se realizó
                </Button>
              )}
              <Button onClick={() => setChoice('unknown')} variant="outline">
                No puedo confirmarlo
              </Button>
            </div>
            {choice === 'departed' && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                <p>
                  Registra solo la hora y el odómetro reales de salida. Si luego falta el cierre, la
                  jornada pasará a Cierre pendiente.
                </p>
                {journey.acciones.puedeIniciar ? (
                  <Button className="mt-3" onClick={() => openAction('start')}>
                    Registrar salida con datos reales
                  </Button>
                ) : (
                  <p className="mt-2 font-medium text-amber-900">
                    El sistema no permite registrar la salida con la restricción operativa actual.
                    Revisa la disponibilidad y confirma el hecho con Administración antes de
                    modificar el registro.
                  </p>
                )}
              </div>
            )}
          </>
        )}
        {category === 'RELEVO' && (
          <>
            <p>
              Este tramo ya comenzó. Su conductor y sus lecturas anteriores permanecerán en el
              historial.
            </p>
            {journey.estado === 'INTERRUMPIDA' ? (
              <Button onClick={() => openAction('reassign')}>Crear tramo con bus sustituto</Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => openAction('reassign')}>
                  Tengo la lectura final del tramo
                </Button>
                <Button onClick={() => setChoice('no-reading')} variant="outline">
                  No tengo la lectura final
                </Button>
              </div>
            )}
            {choice === 'no-reading' && journey.acciones.puedeInterrumpir && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p>
                  Si una incidencia impide continuar, registra la interrupción sin inventar
                  kilometraje. El tramo anterior conservará su historial.
                </p>
                <Button className="mt-3" onClick={() => openAction('interrupt')} variant="outline">
                  Registrar interrupción
                </Button>
              </div>
            )}
          </>
        )}
        {(choice === 'missing' || choice === 'unknown') && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" role="status">
            <p>
              No inventes la lectura ni la salida. Confirma lo ocurrido con el Conductor o utiliza
              el escalamiento interno disponible. La jornada seguirá pendiente.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
