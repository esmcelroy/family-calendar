import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveRuntimeMode } from './runtime-mode'

describe('runtime mode selection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults Vite to local mode without calling a backend endpoint', async () => {
    const fetcher = vi.fn()

    await expect(resolveRuntimeMode({ configuredMode: 'local', fetcher })).resolves.toEqual({
      mode: 'local',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fails closed in configured server mode and never accesses localStorage when discovery fails', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    const getItem = vi.spyOn(window.localStorage, 'getItem')
    const setItem = vi.spyOn(window.localStorage, 'setItem')

    await expect(resolveRuntimeMode({ configuredMode: 'server', fetcher })).rejects.toMatchObject({
      code: 'SERVER_UNAVAILABLE',
    })
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})
