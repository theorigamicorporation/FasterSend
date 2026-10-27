/**
 * Default ICE servers, used when NUXT_PUBLIC_ICE_SERVERS is not set. STUN only, so it cannot relay.
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]

const ICE_URL_PATTERN = /^(stun|stuns|turn|turns):/i

function isValidIceServer(v: unknown): v is RTCIceServer {
  if (!v || typeof v !== 'object') {
    return false
  }
  const s = v as Record<string, unknown>
  const urls = Array.isArray(s.urls) ? s.urls : [s.urls]
  if (urls.length === 0 || !urls.every((u) => typeof u === 'string' && ICE_URL_PATTERN.test(u))) {
    return false
  }
  if (s.username !== undefined && typeof s.username !== 'string') {
    return false
  }
  if (s.credential !== undefined && typeof s.credential !== 'string') {
    return false
  }
  return true
}

/**
 * Parses the ICE server config.
 * Nuxt pre-parses JSON env vars into objects, so both strings and arrays are accepted.
 * Falls back to the defaults on invalid JSON or when no valid entries remain.
 */
export function parseIceServers(raw: unknown): RTCIceServer[] {
  let value = raw
  if (typeof value === 'string') {
    if (!value.trim()) {
      return DEFAULT_ICE_SERVERS
    }
    try {
      value = JSON.parse(value)
    } catch {
      console.warn('NUXT_PUBLIC_ICE_SERVERS is not valid JSON, using default')
      return DEFAULT_ICE_SERVERS
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    value = [value]
  }
  if (!Array.isArray(value)) {
    return DEFAULT_ICE_SERVERS
  }
  const servers = value.filter(isValidIceServer).map((s) => {
    const server: RTCIceServer = { urls: s.urls }
    if (s.username !== undefined) server.username = s.username
    if (s.credential !== undefined) server.credential = s.credential
    return server
  })
  if (servers.length !== value.length) {
    console.warn('NUXT_PUBLIC_ICE_SERVERS contains invalid entries, they were ignored')
  }
  return servers.length > 0 ? servers : DEFAULT_ICE_SERVERS
}

/**
 * Parses the ICE transport policy; only all / relay are accepted, anything else yields undefined (browser default is all)
 */
export function parseIceTransportPolicy(raw: unknown): RTCIceTransportPolicy | undefined {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return v === 'all' || v === 'relay' ? v : undefined
}

/**
 * Whether any server can relay traffic (TURN). Without one, peers behind symmetric NAT on both sides cannot connect.
 */
export function hasRelayServer(servers: RTCIceServer[]): boolean {
  return servers.some((s) => [s.urls].flat().some((u) => /^turns?:/i.test(u)))
}

export interface MintedIceServers {
  iceServers: RTCIceServer[]
  /** Credential lifetime in seconds */
  ttl: number
}

/**
 * Exchanges the signalling ticket for short-lived TURN credentials.
 * Returns null on any failure so the caller falls back to the public ICE config.
 * Credentials live only in memory for this transfer.
 */
export async function requestIceServers(
  ticket: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 5000
): Promise<MintedIceServers | null> {
  try {
    const res = await fetchFn('/api/ice-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!res.ok) {
      console.warn(`TURN credentials unavailable (${res.status}), using the public ICE config`)
      return null
    }
    const body = (await res.json()) as { iceServers?: unknown; ttl?: unknown }
    const iceServers = Array.isArray(body.iceServers) ? parseIceServers(body.iceServers) : []
    const ttl = Number(body.ttl)
    if (!hasRelayServer(iceServers) || !Number.isFinite(ttl) || ttl <= 0) {
      console.warn('TURN credentials response is invalid, using the public ICE config')
      return null
    }
    return { iceServers, ttl }
  } catch (e) {
    console.warn('TURN credentials request failed, using the public ICE config', e)
    return null
  }
}

/**
 * Resolves the ICE servers for one peer connection and keeps TURN credentials fresh while it lives.
 * Credentials are refreshed at 3/4 of their TTL; Cloudflare drops relayed traffic once a credential expires.
 */
export class IceSession {
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(
    private readonly ticket: string | undefined,
    private readonly fallback: RTCIceServer[],
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args)
  ) {}

  /**
   * ICE servers for the initial connection: minted when a ticket is available, else the public config.
   * ttl is null for the public config, which never needs refreshing.
   */
  public async resolve(): Promise<{ iceServers: RTCIceServer[]; ttl: number | null }> {
    const minted = this.ticket ? await requestIceServers(this.ticket, this.fetchFn) : null
    return minted ?? { iceServers: this.fallback, ttl: null }
  }

  /** Re-mints credentials every ttl * 0.75 seconds and hands them to apply */
  public keepFresh(ttlSeconds: number, apply: (servers: RTCIceServer[]) => void): void {
    if (!this.ticket || this.disposed) {
      return
    }
    this.clearTimer()
    this.timer = setTimeout(async () => {
      this.timer = null
      const minted = await requestIceServers(this.ticket!, this.fetchFn)
      if (this.disposed || !minted) {
        return
      }
      apply(minted.iceServers)
      this.keepFresh(minted.ttl, apply)
    }, ttlSeconds * 750)
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  public dispose(): void {
    this.disposed = true
    this.clearTimer()
  }
}
