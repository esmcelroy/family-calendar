import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

class LocalStorageMock implements Storage {
  [key: string]: any
  private store: Record<string, string> = {}

  get length() {
    return Object.keys(this.store).length
  }

  clear() {
    this.store = {}
  }

  getItem(key: string) {
    return this.store[key] ?? null
  }

  key(index: number) {
    return Object.keys(this.store)[index] ?? null
  }

  removeItem(key: string) {
    delete this.store[key]
  }

  setItem(key: string, value: string) {
    this.store[key] = value
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new LocalStorageMock())
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      // Default to no active media query; tests can override by stubbing `window.matchMedia`.
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
