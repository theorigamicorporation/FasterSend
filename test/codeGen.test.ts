import { describe, expect, it } from 'vitest'
import { allocateCode, genDigitCode } from '../server/utils/signalling'

describe('genDigitCode', () => {
  it('produces digits only with the requested length', () => {
    for (let i = 0; i < 500; i++) {
      expect(genDigitCode(6)).toMatch(/^\d{6}$/)
    }
  })

  it('keeps leading zeros', () => {
    expect(genDigitCode(6, () => 0)).toBe('000000')
  })

  it('uses the injected random source', () => {
    let i = 0
    expect(genDigitCode(4, () => i++ % 10)).toBe('0123')
  })

  it('rejects invalid lengths', () => {
    expect(() => genDigitCode(0)).toThrow()
    expect(() => genDigitCode(-1)).toThrow()
    expect(() => genDigitCode(1.5)).toThrow()
  })

  it('is spread across the code space', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) seen.add(genDigitCode(6))
    // 2000 draws from 1e6 codes: collisions should be rare
    expect(seen.size).toBeGreaterThan(1980)
  })
})

describe('allocateCode', () => {
  it('retries on collision and returns a free code', () => {
    const taken = new Set(['111111', '222222'])
    const seq = ['111111', '222222', '111111', '333333']
    let i = 0
    const code = allocateCode(
      (c) => taken.has(c),
      () => seq[i++]!
    )
    expect(code).toBe('333333')
    expect(i).toBe(4)
  })

  it('gives up after the retry budget', () => {
    let calls = 0
    const code = allocateCode(
      () => true,
      () => {
        calls++
        return '000000'
      },
      10
    )
    expect(code).toBeNull()
    expect(calls).toBe(11)
  })
})
