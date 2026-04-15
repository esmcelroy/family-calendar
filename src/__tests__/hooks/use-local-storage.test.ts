// @ts-nocheck
/**
 * Test stubs for useLocalStorage hook.
 *
 * ⚠️  REQUIRES spec 006 (Vitest + jsdom setup + @testing-library/react) to run.
 *     All tests are marked `.todo` until that setup is complete.
 */
import { describe, it } from 'vitest'

// US1 stubs
describe('useLocalStorage', () => {
  it.todo('initial state reads from adapter on mount')

  it.todo('direct setter call (setValue(newVal)) updates React state and writes to adapter')

  it.todo(
    'functional updater (setValue(prev => [...prev, item])) updates state and writes result to adapter',
  )

  // US2 stubs
  it.todo(
    'StorageEvent with matching key on window triggers setState with newly parsed value in mounted hook',
  )
})
