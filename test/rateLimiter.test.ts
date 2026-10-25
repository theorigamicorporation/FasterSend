import { describe, expect, it } from 'vitest'
import { ConcurrencyCounter, RateLimiter } from '../server/utils/rateLimiter'

describe('RateLimiter', () => {
  it('limits after N hits within the window and recovers after it', () => {
    let now = 0
    const rl = new RateLimiter(3, 60e3, () => now)
    expect(rl.isLimited('a')).toBe(false)
    expect(rl.hit('a')).toBe(false)
    expect(rl.hit('a')).toBe(false)
    expect(rl.hit('a')).toBe(true)
    expect(rl.isLimited('a')).toBe(true)
    expect(rl.isLimited('b')).toBe(false)
    now = 59e3
    expect(rl.isLimited('a')).toBe(true)
    now = 60e3 + 1
    expect(rl.isLimited('a')).toBe(false)
    expect(rl.size).toBe(0)
  })

  it('uses a sliding window', () => {
    let now = 0
    const rl = new RateLimiter(2, 1000, () => now)
    rl.hit('a')
    now = 600
    rl.hit('a')
    expect(rl.isLimited('a')).toBe(true)
    now = 1001
    // first hit expired, second still counts
    expect(rl.isLimited('a')).toBe(false)
    rl.hit('a')
    expect(rl.isLimited('a')).toBe(true)
  })

  it('sweep drops expired keys', () => {
    let now = 0
    const rl = new RateLimiter(5, 100, () => now)
    rl.hit('a')
    rl.hit('b')
    now = 200
    rl.sweep()
    expect(rl.size).toBe(0)
  })
})

describe('ConcurrencyCounter', () => {
  it('caps concurrent slots per key', () => {
    const c = new ConcurrencyCounter(2)
    expect(c.acquire('a')).toBe(true)
    expect(c.acquire('a')).toBe(true)
    expect(c.acquire('a')).toBe(false)
    expect(c.acquire('b')).toBe(true)
    c.release('a')
    expect(c.acquire('a')).toBe(true)
    c.release('a')
    c.release('a')
    c.release('a')
    expect(c.count('a')).toBe(0)
  })
})
