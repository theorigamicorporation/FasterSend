import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ICE_SERVERS,
  hasRelayServer,
  IceSession,
  parseIceServers,
  parseIceTransportPolicy,
  requestIceServers
} from '../app/utils/iceConfig'

vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('parseIceServers', () => {
  it('returns the default when unset', () => {
    expect(parseIceServers(undefined)).toEqual(DEFAULT_ICE_SERVERS)
    expect(parseIceServers('')).toEqual(DEFAULT_ICE_SERVERS)
    expect(DEFAULT_ICE_SERVERS).toEqual([{ urls: 'stun:stun.cloudflare.com:3478' }])
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

const TURN = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' }
]

const okFetch = (body: unknown = { iceServers: TURN, ttl: 7200 }, status = 200) =>
  vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status })
  )

describe('hasRelayServer', () => {
  it('detects turn and turns URLs', () => {
    expect(hasRelayServer(DEFAULT_ICE_SERVERS)).toBe(false)
    expect(hasRelayServer(TURN)).toBe(true)
    expect(hasRelayServer([{ urls: ['stun:a:1', 'turns:a:443'] }])).toBe(true)
  })
})

describe('requestIceServers', () => {
  it('posts the ticket and returns servers with the TTL', async () => {
    const f = okFetch()
    const res = await requestIceServers('t1', f as unknown as typeof fetch)
    expect(res).toEqual({ iceServers: TURN, ttl: 7200 })
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('/api/ice-servers')
    expect(JSON.parse(init!.body as string)).toEqual({ ticket: 't1' })
  })

  it('returns null on errors and responses without a relay', async () => {
    const throwing = vi.fn(async () => {
      throw new TypeError('offline')
    })
    for (const f of [
      okFetch({ error: 'rate-limited' }, 429),
      okFetch({ iceServers: DEFAULT_ICE_SERVERS, ttl: 7200 }),
      okFetch({ iceServers: TURN }),
      throwing
    ]) {
      expect(await requestIceServers('t1', f as unknown as typeof fetch)).toBeNull()
    }
  })
})

describe('IceSession', () => {
  it('uses the fallback without a ticket and without a request', async () => {
    const f = okFetch()
    const session = new IceSession(undefined, DEFAULT_ICE_SERVERS, f as unknown as typeof fetch)
    expect(await session.resolve()).toEqual({ iceServers: DEFAULT_ICE_SERVERS, ttl: null })
    expect(f).not.toHaveBeenCalled()
  })

  it('falls back to the public config when minting fails', async () => {
    const f = okFetch({ error: 'mint-failed' }, 502)
    const session = new IceSession('t1', DEFAULT_ICE_SERVERS, f as unknown as typeof fetch)
    expect(await session.resolve()).toEqual({ iceServers: DEFAULT_ICE_SERVERS, ttl: null })
  })

  it('refreshes credentials before they expire and stops after dispose', async () => {
    vi.useFakeTimers()
    try {
      const f = okFetch({ iceServers: TURN, ttl: 100 })
      const session = new IceSession('t1', DEFAULT_ICE_SERVERS, f as unknown as typeof fetch)
      const { ttl } = await session.resolve()
      const apply = vi.fn()
      session.keepFresh(ttl!, apply)
      await vi.advanceTimersByTimeAsync(74e3)
      expect(apply).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1e3)
      expect(apply).toHaveBeenCalledWith(TURN)
      await vi.advanceTimersByTimeAsync(75e3)
      expect(apply).toHaveBeenCalledTimes(2)
      session.dispose()
      await vi.advanceTimersByTimeAsync(300e3)
      expect(apply).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
