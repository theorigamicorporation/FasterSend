import { randomBytes, randomInt } from 'node:crypto'
import { TTLCache } from '@isaacs/ttlcache'
import { ConcurrencyCounter, RateLimiter } from './rateLimiter'

/**
 * Minimal WebSocket abstraction for the signalling service, so it can be unit tested without a real socket.
 */
export interface SignalPeer {
  id: string
  ip: string
  send(data: string): void
  close(): void
  isOpen(): boolean
}

export type RejectReason =
  'too-many-connections' | 'rate-limited' | 'invalid-code' | 'oversize' | 'code-allocation-failed'

export interface SignallingOptions {
  /** Pickup code length */
  codeLength: number
  /** Max bytes per signalling message; larger ones disconnect */
  maxMessageBytes: number
  /** Max concurrent connections per IP */
  maxConnectionsPerIp: number
  /** Failed pickup-code lookups allowed per IP per minute */
  receiveFailuresPerMinute: number
  /** Heartbeat interval; keeps reverse proxies from closing idle connections, since ICE restart needs the signalling channel */
  heartbeatMs: number
  /** TTL for uninitialised connections */
  initTtlMs: number
  /** TTL for a sender waiting for a receiver */
  waitTtlMs: number
  /** TTL for the signalling channel after pairing */
  pairedTtlMs: number
  /** Hand each paired peer a ticket it can exchange for TURN credentials at /api/ice-servers */
  issueIceTickets?: boolean
  /** Pickup code generator; defaults to crypto.randomInt */
  genCode?: (length: number) => string
  /** Called when a pair is established */
  onPaired?: (senderId: string, receiverId: string) => void
  /** Called when a connection is rejected or force-closed, for logging */
  onReject?: (peerId: string, reason: RejectReason) => void
  now?: () => number
}

export const DEFAULT_SIGNALLING_OPTIONS: SignallingOptions = {
  codeLength: 6,
  maxMessageBytes: 64 * 1024,
  maxConnectionsPerIp: 32,
  receiveFailuresPerMinute: 10,
  heartbeatMs: 20e3,
  initTtlMs: 600e3,
  waitTtlMs: 600e3,
  pairedTtlMs: 12 * 3600e3
}

/** Message types that may be relayed between paired peers */
const RELAY_TYPES = new Set(['sdp', 'candidate'])

/**
 * Generate a numeric pickup code with a cryptographically secure RNG
 */
export function genDigitCode(length: number, rand: (max: number) => number = randomInt): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('length must be a positive integer')
  }
  let code = ''
  for (let i = 0; i < length; i++) {
    code += rand(10)
  }
  return code
}

/**
 * Generate an unused pickup code, retrying on collision; null when retries run out
 */
export function allocateCode(
  isTaken: (code: string) => boolean,
  gen: () => string,
  retries = 2048
): string | null {
  for (let i = 0; i <= retries; i++) {
    const code = gen()
    if (!isTaken(code)) {
      return code
    }
  }
  return null
}

/**
 * Parse a signalling message: 'oversize' if too long, null if not a JSON object or missing type
 */
export function parseSignalMessage(
  text: string,
  byteLength: number,
  maxBytes: number
): { type: string; [k: string]: unknown } | null | 'oversize' {
  if (byteLength > maxBytes) {
    return 'oversize'
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  const type = (data as { type?: unknown }).type
  if (typeof type !== 'string') {
    return null
  }
  return data as { type: string }
}

interface PeerState {
  peer: SignalPeer
  role: 'send' | 'receive' | null
  code: string | null
  pair: PeerState | null
  disposed: boolean
  counted: boolean
  iceTicket: string | null
  heartbeat: ReturnType<typeof setInterval> | null
}

/**
 * Signalling hub: allocates pickup codes, pairs sender and receiver, and relays SDP / ICE messages.
 */
export class SignallingHub {
  private readonly opts: SignallingOptions
  private readonly states = new Map<string, PeerState>()
  // TURN tickets of paired peers; removed when the peer goes away
  private readonly iceTickets = new Map<string, PeerState>()
  private readonly connections: ConcurrencyCounter
  private readonly receiveFailures: RateLimiter
  private readonly genCode: (length: number) => string
  // Uninitialised connections; closed if not initialised in time
  private readonly initPool: TTLCache<string, PeerState>
  // Senders waiting for a receiver, keyed by pickup code
  private readonly waitPool: TTLCache<string, PeerState>
  // Paired connections
  private readonly pairedPool: TTLCache<string, PeerState>

  constructor(options: Partial<SignallingOptions> = {}) {
    this.opts = { ...DEFAULT_SIGNALLING_OPTIONS, ...options }
    this.genCode = this.opts.genCode || ((n) => genDigitCode(n))
    this.connections = new ConcurrencyCounter(this.opts.maxConnectionsPerIp)
    this.receiveFailures = new RateLimiter(this.opts.receiveFailuresPerMinute, 60e3, this.opts.now)
    // Only closes on expiry or eviction; explicit deletes are handled by disposePeer
    const onExpire = (s: PeerState, _k: string, reason: string) => {
      if (reason === 'stale' || reason === 'evict') {
        this.disposePeer(s)
      }
    }
    this.initPool = new TTLCache({ max: 8192, ttl: this.opts.initTtlMs, dispose: onExpire })
    this.waitPool = new TTLCache({ max: 20000, ttl: this.opts.waitTtlMs, dispose: onExpire })
    this.pairedPool = new TTLCache({ max: 40000, ttl: this.opts.pairedTtlMs, dispose: onExpire })
  }

  private sendJSON(s: PeerState, data: unknown): void {
    if (s.peer.isOpen()) {
      s.peer.send(JSON.stringify(data))
    }
  }

  private startHeartbeat(s: PeerState): void {
    if (s.heartbeat || this.opts.heartbeatMs <= 0) {
      return
    }
    s.heartbeat = setInterval(() => {
      if (s.peer.isOpen()) {
        s.peer.send(JSON.stringify({ type: 'ping' }))
      } else {
        this.disposePeer(s)
      }
    }, this.opts.heartbeatMs)
    s.heartbeat.unref?.()
  }

  /**
   * Close and clean up a connection. The disposed flag ensures each connection is handled once, so paired peers cleaning up each other cannot recurse forever.
   */
  private disposePeer(s: PeerState): void {
    if (s.disposed) {
      return
    }
    s.disposed = true
    this.states.delete(s.peer.id)
    if (s.heartbeat) {
      clearInterval(s.heartbeat)
      s.heartbeat = null
    }
    this.initPool.delete(s.peer.id)
    this.pairedPool.delete(s.peer.id)
    if (s.code && this.waitPool.get(s.code) === s) {
      this.waitPool.delete(s.code)
    }
    if (s.iceTicket) {
      this.iceTickets.delete(s.iceTicket)
      s.iceTicket = null
    }
    if (s.counted) {
      s.counted = false
      this.connections.release(s.peer.ip)
    }
    try {
      if (s.peer.isOpen()) {
        s.peer.close()
      }
    } catch {
      // The connection may already be closed
    }
    if (s.pair) {
      this.disposePeer(s.pair)
    }
  }

  /**
   * Handle a new connection; closes it if the per-IP limit is exceeded. Returns whether it was accepted
   */
  public open(peer: SignalPeer): boolean {
    const s: PeerState = {
      peer,
      role: null,
      code: null,
      pair: null,
      disposed: false,
      counted: false,
      iceTicket: null,
      heartbeat: null
    }
    this.states.set(peer.id, s)
    if (!this.connections.acquire(peer.ip)) {
      this.opts.onReject?.(peer.id, 'too-many-connections')
      this.sendJSON(s, { type: 'err', data: 429, msg: 'Too many connections' })
      this.disposePeer(s)
      return false
    }
    s.counted = true
    this.initPool.set(peer.id, s)
    return true
  }

  public close(peer: SignalPeer): void {
    const s = this.states.get(peer.id)
    if (s) {
      this.disposePeer(s)
    }
  }

  public message(peer: SignalPeer, text: string, byteLength = text.length): void {
    const s = this.states.get(peer.id)
    if (!s || s.disposed) {
      return
    }
    const data = parseSignalMessage(text, byteLength, this.opts.maxMessageBytes)
    if (data === 'oversize') {
      this.opts.onReject?.(peer.id, 'oversize')
      this.disposePeer(s)
      return
    }
    if (!data) {
      // Drop non-JSON or malformed messages
      return
    }
    if (data.type === 'send') {
      this.initSend(s)
    } else if (data.type === 'receive') {
      this.initReceive(s, data.code)
    } else if (RELAY_TYPES.has(data.type)) {
      // Relay only SDP / ICE messages; drop when unpaired
      if (s.pair && !s.pair.disposed) {
        s.pair.peer.send(text)
      }
    }
  }

  // Init sender: allocate a pickup code and join the waiting pool
  private initSend(s: PeerState): void {
    if (s.role) {
      return
    }
    const code = allocateCode(
      (c) => this.waitPool.has(c),
      () => this.genCode(this.opts.codeLength)
    )
    if (!code) {
      this.opts.onReject?.(s.peer.id, 'code-allocation-failed')
      this.sendJSON(s, { type: 'err', data: -1, msg: 'Init code fail' })
      this.disposePeer(s)
      return
    }
    s.role = 'send'
    s.code = code
    this.initPool.delete(s.peer.id)
    this.waitPool.set(code, s)
    this.sendJSON(s, { type: 'code', code })
    this.startHeartbeat(s)
  }

  // Init receiver: look up the sender by pickup code and pair; failures count against the IP's rate limit
  private initReceive(s: PeerState, code: unknown): void {
    if (s.role) {
      return
    }
    const ip = s.peer.ip
    if (this.receiveFailures.isLimited(ip)) {
      this.opts.onReject?.(s.peer.id, 'rate-limited')
      this.sendJSON(s, { type: 'status', code: 429 })
      this.disposePeer(s)
      return
    }
    const pattern = new RegExp(`^\\d{${this.opts.codeLength}}$`)
    const target =
      typeof code === 'string' && pattern.test(code) ? this.waitPool.get(code) : undefined
    if (!target || target.pair || target.disposed || !target.peer.isOpen()) {
      this.receiveFailures.hit(ip)
      this.opts.onReject?.(s.peer.id, 'invalid-code')
      this.sendJSON(s, { type: 'status', code: 404 })
      this.disposePeer(s)
      return
    }

    s.role = 'receive'
    s.pair = target
    target.pair = s
    this.waitPool.delete(target.code!)
    this.initPool.delete(s.peer.id)
    this.pairedPool.set(s.peer.id, s)
    this.pairedPool.set(target.peer.id, target)
    // Paired. TURN tickets are only handed out here, so credentials need a live pair, not just an open socket.
    // The sender learns about the pair from 'paired'; older clients ignore unknown types.
    const receiverTicket = this.issueIceTicket(s)
    const senderTicket = this.issueIceTicket(target)
    this.sendJSON(s, {
      type: 'status',
      code: 0,
      ...(receiverTicket && { iceTicket: receiverTicket })
    })
    this.sendJSON(target, { type: 'paired', ...(senderTicket && { iceTicket: senderTicket }) })
    this.startHeartbeat(s)
    this.opts.onPaired?.(target.peer.id, s.peer.id)
  }

  private issueIceTicket(s: PeerState): string | null {
    if (!this.opts.issueIceTickets) {
      return null
    }
    const ticket = randomBytes(24).toString('base64url')
    s.iceTicket = ticket
    this.iceTickets.set(ticket, s)
    return ticket
  }

  /** Whether a ticket belongs to a peer that is still paired and connected */
  public isActiveTicket(ticket: string): boolean {
    const s = this.iceTickets.get(ticket)
    return !!s && !s.disposed && !!s.pair && !s.pair.disposed && s.peer.isOpen()
  }

  /** For tests and monitoring: current state counts */
  public stats() {
    return {
      peers: this.states.size,
      waiting: this.waitPool.size,
      paired: this.pairedPool.size,
      iceTickets: this.iceTickets.size,
      connectionsFor: (ip: string) => this.connections.count(ip)
    }
  }
}
