import { describe, expect, it } from 'vitest'
import { getClientIP, parseTrustProxy } from '../server/utils/clientIP'

describe('parseTrustProxy', () => {
  it('parses booleans, strings and hop counts', () => {
    expect(parseTrustProxy(undefined)).toBe(0)
    expect(parseTrustProxy(false)).toBe(0)
    expect(parseTrustProxy('false')).toBe(0)
    expect(parseTrustProxy('')).toBe(0)
    expect(parseTrustProxy(true)).toBe(1)
    expect(parseTrustProxy('true')).toBe(1)
    expect(parseTrustProxy(2)).toBe(2)
    expect(parseTrustProxy('3')).toBe(3)
    expect(parseTrustProxy('abc')).toBe(0)
  })
})

describe('getClientIP', () => {
  it('ignores X-Forwarded-For unless a proxy is trusted', () => {
    expect(getClientIP('6.6.6.6', '10.0.0.1', 0)).toBe('10.0.0.1')
  })

  it('takes the entry added by the trusted proxy, not the spoofable leftmost one', () => {
    expect(getClientIP('6.6.6.6, 1.2.3.4', '10.0.0.1', 1)).toBe('1.2.3.4')
    expect(getClientIP('6.6.6.6, 1.2.3.4, 172.16.0.1', '10.0.0.1', 2)).toBe('1.2.3.4')
    expect(getClientIP('1.2.3.4', '10.0.0.1', 3)).toBe('1.2.3.4')
  })

  it('falls back to the socket address', () => {
    expect(getClientIP(null, '::ffff:127.0.0.1', 1)).toBe('127.0.0.1')
    expect(getClientIP(' , ', '::1', 1)).toBe('::1')
    expect(getClientIP(undefined, undefined, 0)).toBe('unknown')
  })
})
