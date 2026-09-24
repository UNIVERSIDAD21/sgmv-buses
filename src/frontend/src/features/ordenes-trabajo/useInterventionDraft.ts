import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { updateWorkOrderIntervention } from './work-order.api'

// Only reversible text is autosaved. History, inventory and odometer events stay explicit.
export function useInterventionDraft(
  orderId: number,
  interventionId: number | undefined,
  initialDiagnosis: string,
  initialObservations: string,
  editable: boolean,
) {
  const [diagnostico, setDiagnosis] = useState(initialDiagnosis)
  const [observaciones, setObservations] = useState(initialObservations)
  const [status, setStatus] = useState('Borrador guardado')
  const [saved, setSaved] = useState(JSON.stringify([initialDiagnosis, initialObservations]))
  const current = useRef({ diagnostico: initialDiagnosis, observaciones: initialObservations })
  const savedRef = useRef(saved)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const mounted = useRef(true)
  const flush = useCallback(() => {
    if (!editable || !interventionId) return Promise.resolve()
    const snapshot = { ...current.current }
    const signature = JSON.stringify([snapshot.diagnostico, snapshot.observaciones])
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (signature === savedRef.current) return
        if (mounted.current) setStatus('Guardando borrador…')
        try {
          await updateWorkOrderIntervention(orderId, {
            ...snapshot,
            intervencionId: interventionId,
          })
          savedRef.current = signature
          if (mounted.current) {
            setSaved(signature)
            setStatus(
              signature ===
                JSON.stringify([current.current.diagnostico, current.current.observaciones])
                ? 'Guardado automáticamente'
                : 'Cambios pendientes de guardar',
            )
          }
        } catch (error) {
          if (mounted.current)
            setStatus(
              error instanceof ApiError
                ? `No guardado: ${error.message}`
                : 'No guardado. Revisa la conexión y reintenta.',
            )
          throw error
        }
      })
    return queue.current
  }, [editable, interventionId, orderId])
  const dirty = JSON.stringify([diagnostico, observaciones]) !== saved
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      void flush().catch(() => undefined)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [diagnostico, observaciones, dirty, flush])
  useEffect(() => {
    mounted.current = true
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        savedRef.current !==
        JSON.stringify([current.current.diagnostico, current.current.observaciones])
      )
        event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      mounted.current = false
      window.removeEventListener('beforeunload', beforeUnload)
      void flush().catch(() => undefined)
    }
  }, [flush])
  function setDiagnostico(value: string) {
    current.current.diagnostico = value
    setDiagnosis(value)
    setStatus('Cambios pendientes de guardar')
  }
  function setObservaciones(value: string) {
    current.current.observaciones = value
    setObservations(value)
    setStatus('Cambios pendientes de guardar')
  }
  return { diagnostico, observaciones, setDiagnostico, setObservaciones, dirty, flush, status }
}
