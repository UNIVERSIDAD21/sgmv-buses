import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedValue } from './useDebouncedValue'

afterEach(() => vi.useRealTimers())

describe('useDebouncedValue', () => {
  it('coalesces rapid changes and publishes only the latest value after the delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      { initialProps: { value: '' } },
    )

    rerender({ value: 'b' })
    rerender({ value: 'bu' })
    rerender({ value: 'bus' })

    act(() => vi.advanceTimersByTime(249))
    expect(result.current).toBe('')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('bus')
  })
})
