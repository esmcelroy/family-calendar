// @ts-nocheck
/**
 * Test stubs for LocalStorageAdapter.
 *
 * ⚠️  REQUIRES spec 006 (Vitest + jsdom setup) to run.
 *     All tests are marked `.todo` until that setup is complete.
 */
import { describe, it } from 'vitest'

// US1 stubs — LocalStorageAdapter behaviour
describe('LocalStorageAdapter', () => {
  it.todo('get — key present → returns parsed value typed as T')

  it.todo('get — key absent → returns defaultValue')

  it.todo('set — serialises value and writes to window.localStorage')

  // US2 stubs — error hardening
  it.todo('get — malformed JSON in storage → returns defaultValue without throwing')

  it.todo('set — write to window storage throws QuotaExceededError → silently no-ops (does not throw)')

  // US3 stubs — architecture contract
  it.todo('localStorageAdapter is assignable to StorageAdapter interface')

  it.todo(
    'injecting a mock StorageAdapter into useLocalStorage routes calls to mock, not window.localStorage',
  )
})
