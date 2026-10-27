import { RateLimiter } from './rateLimiter'

/**
 * Short-lived TURN credentials from Cloudflare Realtime TURN.
 * The TURN key ID and API token stay on the server; browsers only ever see a credential that expires after the TTL.
 * https://developers.cloudflare.com/realtime/turn/generate-credentials/
 */

export const DEFAULT_TURN_API_BASE = 'https://rtc.live.cloudflare.com/v1'
/** 2 hours: covers pairing plus a long transfer; the client refreshes before expiry for anything longer */
export const DEFAULT_TURN_TTL_SECONDS = 7200
/** Cloudflare rejects credentials that live longer than 48 hours */
export const MAX_TURN_TTL_SECONDS = 48 * 3600
export const MIN_TURN_TTL_SECONDS = 300
/** Mints per ticket inside one TTL window: the first request, one retry and one refresh */
export const MINTS_PER_TICKET = 3

export interface IceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export interface TurnConfig {
  keyId: string
  apiToken: string
  ttlSeconds: number
  apiBase: string
}

/**
 * Builds the TURN config from runtime config; null when no key is configured, which disables minting.
 */
export function parseTurnConfig(config: {
  turnKeyId?: unknown
  turnKeyApiToken?: unknown
  turnCredentialTtl?: unknown
  turnApiBase?: unknown
}): TurnConfig | null {
  const keyId = typeof config.turnKeyId === 'string' ? config.turnKeyId.trim() : ''
  const apiToken = typeof config.turnKeyApiToken === 'string' ? config.turnKeyApiToken.trim() : ''
  if (!keyId || !apiToken) {
    return null
  }
  const base =
    typeof config.turnApiBase === 'string' && config.turnApiBase.trim()
      ? config.turnApiBase.trim()
      : DEFAULT_TURN_API_BASE
  return {
    keyId,
    apiToken,
    ttlSeconds: clampTtl(config.turnCredentialTtl),
    apiBase: base.replace(/\/+$/, '')
  }
}

export function clampTtl(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_TURN_TTL_SECONDS
  }
  return Math.min(MAX_TURN_TTL_SECONDS, Math.max(MIN_TURN_TTL_SECONDS, Math.floor(n)))
}

const ICE_URL_PATTERN = /^(stun|stuns|turn|turns):/i
// Browsers block port 53, so these URLs only time out; Cloudflare's docs suggest dropping them
const PORT_53_PATTERN = /^(stun|stuns|turn|turns):[^?]*:53(\?|$)/i

/**
 * Keeps only well-formed ICE servers and drops URLs browsers cannot use.
 */
export function sanitizeIceServers(raw: unknown): IceServer[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: IceServer[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const s = entry as Record<string, unknown>
    const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter(
      (u): u is string =>
        typeof u === 'string' && ICE_URL_PATTERN.test(u) && !PORT_53_PATTERN.test(u)
    )
    if (urls.length === 0) {
      continue
    }
    const server: IceServer = { urls }
    if (typeof s.username === 'string') server.username = s.username
    if (typeof s.credential === 'string') server.credential = s.credential
    out.push(server)
  }
  return out
}

export class TurnMintError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message)
  }
}

/**
 * Asks Cloudflare for a fresh set of ICE servers with a credential valid for ttlSeconds.
 * Throws TurnMintError on any failure; the error never contains the API token.
 */
export async function mintIceServers(
  config: TurnConfig,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 5000
): Promise<IceServer[]> {
  const url = `${config.apiBase}/turn/keys/${encodeURIComponent(config.keyId)}/credentials/generate-ice-servers`
  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ttl: config.ttlSeconds }),
      signal: AbortSignal.timeout(timeoutMs)
    })
  } catch (e) {
    throw new TurnMintError(`request failed: ${e instanceof Error ? e.name : 'unknown'}`)
  }
  if (!res.ok) {
    throw new TurnMintError(`unexpected status ${res.status}`, res.status)
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new TurnMintError('invalid JSON')
  }
  const servers = sanitizeIceServers((body as { iceServers?: unknown } | null)?.iceServers)
  if (!servers.some((s) => [s.urls].flat().some((u) => /^turns?:/i.test(u)))) {
    throw new TurnMintError('response has no TURN servers')
  }
  return servers
}

export type IceRequestResult =
  | { status: 200; body: { iceServers: IceServer[]; ttl: number } }
  | { status: 400 | 403 | 404 | 429 | 502; body: { error: string } }

export interface IceIssuerOptions {
  config: TurnConfig | null
  /** Whether the ticket belongs to a live, paired signalling session */
  isActiveTicket: (ticket: string) => boolean
  /** Credentials minted per minute across the whole server */
  mintsPerMinute: number
  fetchFn?: typeof fetch
  now?: () => number
  onMintError?: (err: TurnMintError) => void
}

/**
 * Hands out TURN credentials only to paired signalling sessions.
 * The client IP is not used: behind Cloudflare and the ingress every client shares an address, so limits are per ticket and global.
 */
export class IceIssuer {
  private readonly perTicket: RateLimiter
  private readonly global: RateLimiter

  constructor(private readonly opts: IceIssuerOptions) {
    const ttlMs = (opts.config?.ttlSeconds ?? DEFAULT_TURN_TTL_SECONDS) * 1e3
    this.perTicket = new RateLimiter(MINTS_PER_TICKET, ttlMs, opts.now)
    this.global = new RateLimiter(Math.max(1, opts.mintsPerMinute), 60e3, opts.now)
  }

  public get enabled(): boolean {
    return this.opts.config !== null
  }

  public async handle(ticket: unknown): Promise<IceRequestResult> {
    const config = this.opts.config
    if (!config) {
      return { status: 404, body: { error: 'turn-not-configured' } }
    }
    if (typeof ticket !== 'string' || !/^[\w-]{16,128}$/.test(ticket)) {
      return { status: 400, body: { error: 'invalid-ticket' } }
    }
    if (!this.opts.isActiveTicket(ticket)) {
      return { status: 403, body: { error: 'unknown-ticket' } }
    }
    if (this.perTicket.isLimited(ticket) || this.global.isLimited('all')) {
      return { status: 429, body: { error: 'rate-limited' } }
    }
    this.perTicket.hit(ticket)
    this.global.hit('all')
    try {
      const iceServers = await mintIceServers(config, this.opts.fetchFn)
      return { status: 200, body: { iceServers, ttl: config.ttlSeconds } }
    } catch (e) {
      const err = e instanceof TurnMintError ? e : new TurnMintError('unknown error')
      this.opts.onMintError?.(err)
      return { status: 502, body: { error: 'mint-failed' } }
    }
  }
}
