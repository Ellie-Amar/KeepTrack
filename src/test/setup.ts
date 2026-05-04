import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { server } from './msw/server'

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (!window.ResizeObserver) {
  class ResizeObserverMock implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  if (typeof window.localStorage?.clear === 'function') {
    window.localStorage.clear()
  }
  if (typeof window.sessionStorage?.clear === 'function') {
    window.sessionStorage.clear()
  }
  vi.restoreAllMocks()
})

afterAll(() => {
  server.close()
})
