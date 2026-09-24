import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { updateWorkOrderIntervention } from './work-order.api'
import { useInterventionDraft } from './useInterventionDraft'

vi.mock('./work-order.api', () => ({ updateWorkOrderIntervention: vi.fn() }))
const save = vi.mocked(updateWorkOrderIntervention)

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

it('serializes drafts, keeps newer changes pending and retries a failed save without other events', async () => {
  vi.useFakeTimers()
  let finishFirst!: () => void
  save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFirst = () => resolve({} as Awaited<ReturnType<typeof save>>)
      }),
  )
  save.mockRejectedValueOnce(new Error('Offline'))
  save.mockResolvedValue({} as Awaited<ReturnType<typeof save>>)
  const { result, unmount } = renderHook(() => useInterventionDraft(10, 20, '', '', true))
  expect(save).not.toHaveBeenCalled()
  act(() => result.current.setDiagnostico('Primer diagnóstico'))
  await act(() => vi.advanceTimersByTimeAsync(700))
  act(() => result.current.setDiagnostico('Diagnóstico corregido'))
  await act(async () => finishFirst())
  expect(result.current.dirty).toBe(true)
  expect(result.current.status).toBe('Cambios pendientes de guardar')
  await act(() => vi.advanceTimersByTimeAsync(700))
  expect(result.current.status).toMatch(/^No guardado/)
  expect(result.current.diagnostico).toBe('Diagnóstico corregido')
  await act(async () => {
    await result.current.flush()
  })
  expect(result.current.dirty).toBe(false)
  expect(result.current.status).toBe('Guardado automáticamente')
  expect(save).toHaveBeenLastCalledWith(10, {
    intervencionId: 20,
    diagnostico: 'Diagnóstico corregido',
    observaciones: '',
  })
  unmount()
})

it('flushes reversible text when leaving the detail before the debounce and never saves read-only history', async () => {
  vi.useFakeTimers()
  save.mockResolvedValue({} as Awaited<ReturnType<typeof save>>)
  const first = renderHook(() => useInterventionDraft(10, 20, 'Anterior', '', true))
  act(() => first.result.current.setObservaciones('Observación pendiente'))
  await act(async () => first.unmount())
  expect(save).toHaveBeenCalledExactlyOnceWith(10, {
    intervencionId: 20,
    diagnostico: 'Anterior',
    observaciones: 'Observación pendiente',
  })
  const historical = renderHook(() => useInterventionDraft(11, 21, 'Histórico', '', false))
  await act(async () => {
    await historical.result.current.flush()
  })
  historical.unmount()
  expect(save).toHaveBeenCalledTimes(1)
})
