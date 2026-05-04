import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useOnlineStatus } from '../../src/hooks/useOnlineStatus'

describe('useOnlineStatus', () => {
  it('tracks online/offline browser events', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true)

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})

