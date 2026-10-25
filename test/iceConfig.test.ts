import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ICE_SERVERS,
  parseIceServers,
  parseIceTransportPolicy
} from '../app/utils/iceConfig'

vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('parseIceServers', () => {
  it('returns the default when unset', () => {
    expect(parseIceServers(undefined)).toEqual(DEFAULT_ICE_SERVERS)
    expect(parseIceServers('')).toEqual(DEFAULT_ICE_SERVERS)
    expect(DEFAULT_ICE_SERVERS).toEqual([{ urls: 'stun:stun.l.google.com:19302' }])
  })

  it('parses a JSON string with stun and turn servers', () => {
    const raw = JSON.stringify([
      { urls: 'stun:stun.example.com:3478' },
      {
        urls: ['turn:turn.example.com:3478?transport=udp', 'turns:turn.example.com:5349'],
        username: 'u',
        credential: 'p'
      }
    ])
    expect(parseIceServers(raw)).toEqual([
      { urls: 'stun:stun.example.com:3478' },
      {
        urls: ['turn:turn.example.com:3478?transport=udp', 'turns:turn.example.com:5349'],
        username: 'u',
        credential: 'p'
      }
    ])
  })

  it('accepts values Nuxt already parsed from env', () => {
    expect(parseIceServers([{ urls: 'stun:a:1' }])).toEqual([{ urls: 'stun:a:1' }])
    expect(parseIceServers({ urls: 'turn:a:1', username: 'x', credential: 'y' })).toEqual([
      { urls: 'turn:a:1', username: 'x', credential: 'y' }
    ])
  })

  it('falls back to the default on invalid JSON', () => {
    expect(parseIceServers('[{urls: nope')).toEqual(DEFAULT_ICE_SERVERS)
    expect(parseIceServers('42')).toEqual(DEFAULT_ICE_SERVERS)
  })

  it('drops invalid entries and strips unknown fields', () => {
    expect(
      parseIceServers([
        { urls: 'http://evil' },
        { urls: [] },
        { urls: 'stun:ok:1', username: 1 },
        { urls: 'stun:good:1', extra: true },
        null
      ])
    ).toEqual([{ urls: 'stun:good:1' }])
    expect(parseIceServers([{ urls: 'http://evil' }])).toEqual(DEFAULT_ICE_SERVERS)
  })
})

describe('parseIceTransportPolicy', () => {
  it('only accepts all or relay', () => {
    expect(parseIceTransportPolicy('relay')).toBe('relay')
    expect(parseIceTransportPolicy(' ALL ')).toBe('all')
    expect(parseIceTransportPolicy('')).toBeUndefined()
    expect(parseIceTransportPolicy('none')).toBeUndefined()
    expect(parseIceTransportPolicy(undefined)).toBeUndefined()
  })
})
