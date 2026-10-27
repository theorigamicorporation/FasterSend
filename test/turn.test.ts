import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_TURN_TTL_SECONDS,
  IceIssuer,
  MAX_TURN_TTL_SECONDS,
  MINTS_PER_TICKET,
  mintIceServers,
  parseTurnConfig,
  sanitizeIceServers,
  type TurnConfig
} from '../server/utils/turn'

const CONFIG: TurnConfig = {
  keyId: 'key-id',
  apiToken: 'secret-token',
  ttlSeconds: 7200,
  apiBase: 'https://rtc.example.test/v1'
}

// Shape of Cloudflare's generate-ice-servers 201 response
const CF_RESPONSE = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:53?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turn:turn.cloudflare.com:80?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
        'turns:turn.cloudflare.com:443?transport=tcp'
      ],
      username: 'short-lived-user',
      credential: 'short-lived-credential'
    }
  ]
}

function cfFetch(status = 201, body: unknown = CF_RESPONSE) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
  )
}

const TICKET = 'abcdefghijklmnopqrstuvwxyz012345'

describe('parseTurnConfig', () => {
  it('is disabled without both the key id and the token', () => {
    expect(parseTurnConfig({})).toBeNull()
    expect(parseTurnConfig({ turnKeyId: 'a', turnKeyApiToken: ' ' })).toBeNull()
    expect(parseTurnConfig({ turnKeyId: '', turnKeyApiToken: 'b' })).toBeNull()
  })

  it('clamps the TTL and defaults the API base', () => {
    const c = parseTurnConfig({ turnKeyId: 'a', turnKeyApiToken: 'b', turnCredentialTtl: '999999' })
    expect(c).toEqual({
      keyId: 'a',
      apiToken: 'b',
      ttlSeconds: MAX_TURN_TTL_SECONDS,
      apiBase: 'https://rtc.live.cloudflare.com/v1'
    })
    expect(
      parseTurnConfig({ turnKeyId: 'a', turnKeyApiToken: 'b', turnCredentialTtl: 'x' })!.ttlSeconds
    ).toBe(DEFAULT_TURN_TTL_SECONDS)
    expect(
      parseTurnConfig({ turnKeyId: 'a', turnKeyApiToken: 'b', turnCredentialTtl: 10 })!.ttlSeconds
    ).toBe(300)
    expect(
      parseTurnConfig({ turnKeyId: 'a', turnKeyApiToken: 'b', turnApiBase: 'http://mock/v1/' })!
        .apiBase
    ).toBe('http://mock/v1')
  })
})

describe('sanitizeIceServers', () => {
  it('drops port 53, non ICE URLs and unknown fields', () => {
    expect(
      sanitizeIceServers([
        { urls: 'stun:a:53' },
        {
          urls: ['http://evil', 'turn:a:3478?transport=udp', 'turn:a:53?transport=udp'],
          username: 'u',
          credential: 'c',
          x: 1
        },
        null
      ])
    ).toEqual([{ urls: ['turn:a:3478?transport=udp'], username: 'u', credential: 'c' }])
    expect(sanitizeIceServers('nope')).toEqual([])
  })
})

describe('mintIceServers', () => {
  it('calls Cloudflare with the bearer token and TTL', async () => {
    const f = cfFetch()
    const servers = await mintIceServers(CONFIG, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledOnce()
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe(
      'https://rtc.example.test/v1/turn/keys/key-id/credentials/generate-ice-servers'
    )
    expect(init!.method).toBe('POST')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer secret-token')
    expect(JSON.parse(init!.body as string)).toEqual({ ttl: 7200 })
    expect(servers).toHaveLength(2)
    expect(servers[1]!.urls).not.toContain('turn:turn.cloudflare.com:53?transport=udp')
    expect(servers[1]!.username).toBe('short-lived-user')
  })

  it('fails on errors without leaking the token', async () => {
    for (const f of [
      cfFetch(401, { error: 'bad token' }),
      cfFetch(201, { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] }),
      vi.fn(async () => new Response('not json', { status: 201 })),
      vi.fn(async () => {
        throw new TypeError('network')
      })
    ]) {
      const err = await mintIceServers(CONFIG, f as unknown as typeof fetch).catch((e) => e)
      expect(err).toBeInstanceOf(Error)
      expect(String(err.message)).not.toContain('secret-token')
    }
  })
})

describe('IceIssuer', () => {
  function setup(
    opts: { active?: boolean; mintsPerMinute?: number; config?: TurnConfig | null } = {}
  ) {
    let now = 0
    const fetchFn = cfFetch()
    const onMintError = vi.fn()
    const issuer = new IceIssuer({
      config: opts.config === undefined ? CONFIG : opts.config,
      isActiveTicket: () => opts.active ?? true,
      mintsPerMinute: opts.mintsPerMinute ?? 60,
      fetchFn: fetchFn as unknown as typeof fetch,
      now: () => now,
      onMintError
    })
    return { issuer, fetchFn, onMintError, advance: (ms: number) => (now += ms) }
  }

  it('mints for an active ticket and returns the TTL', async () => {
    const { issuer, fetchFn } = setup()
    const res = await issuer.handle(TICKET)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ttl: 7200 })
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  it('returns 404 when no key is configured', async () => {
    const { issuer, fetchFn } = setup({ config: null })
    expect(issuer.enabled).toBe(false)
    expect((await issuer.handle(TICKET)).status).toBe(404)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects malformed and unknown tickets without calling Cloudflare', async () => {
    const { issuer, fetchFn } = setup({ active: false })
    expect((await issuer.handle(undefined)).status).toBe(400)
    expect((await issuer.handle('short')).status).toBe(400)
    expect((await issuer.handle({ ticket: TICKET })).status).toBe(400)
    expect((await issuer.handle(TICKET)).status).toBe(403)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('limits mints per ticket within one TTL', async () => {
    const { issuer, fetchFn, advance } = setup()
    for (let i = 0; i < MINTS_PER_TICKET; i++) {
      expect((await issuer.handle(TICKET)).status).toBe(200)
    }
    expect((await issuer.handle(TICKET)).status).toBe(429)
    expect((await issuer.handle(`${TICKET}x`)).status).toBe(200)
    advance(CONFIG.ttlSeconds * 1e3 + 1)
    expect((await issuer.handle(TICKET)).status).toBe(200)
    expect(fetchFn).toHaveBeenCalledTimes(MINTS_PER_TICKET + 2)
  })

  it('limits mints across the server', async () => {
    const { issuer, advance } = setup({ mintsPerMinute: 2 })
    expect((await issuer.handle(`${TICKET}1`)).status).toBe(200)
    expect((await issuer.handle(`${TICKET}2`)).status).toBe(200)
    expect((await issuer.handle(`${TICKET}3`)).status).toBe(429)
    advance(60e3 + 1)
    expect((await issuer.handle(`${TICKET}3`)).status).toBe(200)
  })

  it('maps Cloudflare failures to 502', async () => {
    const onMintError = vi.fn()
    const issuer = new IceIssuer({
      config: CONFIG,
      isActiveTicket: () => true,
      mintsPerMinute: 60,
      fetchFn: cfFetch(500, {}) as unknown as typeof fetch,
      onMintError
    })
    const res = await issuer.handle(TICKET)
    expect(res).toEqual({ status: 502, body: { error: 'mint-failed' } })
    expect(onMintError).toHaveBeenCalledOnce()
  })
})
