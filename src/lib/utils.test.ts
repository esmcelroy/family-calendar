import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges and deduplicates class names', () => {
    expect(cn('p-2', { hidden: false, block: true }, 'p-4')).toBe('block p-4')
  })
})
