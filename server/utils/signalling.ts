import { randomInt } from 'node:crypto'
import { TTLCache } from '@isaacs/ttlcache'
import { ConcurrencyCounter, RateLimiter } from './rateLimiter'

/**
 * 信令服务对 WebSocket 连接的最小抽象，便于脱离真实 socket 做单元测试。
 */
export interface SignalPeer {
  id: string
  ip: string
  send(data: string): void
  close(): void
  isOpen(): boolean
}

export type RejectReason =
  | 'too-many-connections'
  | 'rate-limited'
  | 'invalid-code'
  | 'oversize'
  | 'code-allocation-failed'

export interface SignallingOptions {
  /** 取件码位数 */
  codeLength: number
  /** 单条信令消息的最大字节数，超过即断开 */
  maxMessageBytes: number
  /** 同一 IP 的最大并发连接数 */
  maxConnectionsPerIp: number
  /** 同一 IP 每分钟允许的取件码查询失败次数 */
  receiveFailuresPerMinute: number
  /** 心跳间隔，保持反向代理不因空闲关闭连接，ICE 重启需要信令通道仍然可用 */
  heartbeatMs: number
  /** 未初始化连接的存活时间 */
  initTtlMs: number
  /** 发送端等待接收端的存活时间 */
  waitTtlMs: number
  /** 配对后信令通道的存活时间 */
  pairedTtlMs: number
  /** 生成取件码，默认使用 crypto.randomInt */
  genCode?: (length: number) => string
  /** 配对成功回调 */
  onPaired?: (senderId: string, receiverId: string) => void
  /** 连接被拒绝或强制断开时回调，用于日志 */
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

/** 允许在已配对的两端之间转发的消息类型 */
const RELAY_TYPES = new Set(['sdp', 'candidate'])

/**
 * 使用密码学安全随机数生成纯数字取件码
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
 * 生成一个未被占用的取件码，碰撞时重试，重试耗尽返回 null
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
 * 解析信令消息：超长返回 'oversize'，非 JSON 对象或缺少 type 返回 null
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
  heartbeat: ReturnType<typeof setInterval> | null
}

/**
 * 信令中心：管理取件码分配、收发两端配对和 SDP / ICE 消息转发。
 */
export class SignallingHub {
  private readonly opts: SignallingOptions
  private readonly states = new Map<string, PeerState>()
  private readonly connections: ConcurrencyCounter
  private readonly receiveFailures: RateLimiter
  private readonly genCode: (length: number) => string
  // 未初始化连接池，超时未初始化则断开
  private readonly initPool: TTLCache<string, PeerState>
  // 等待接收端连接的发送端，key 为取件码
  private readonly waitPool: TTLCache<string, PeerState>
  // 已配对连接池
  private readonly pairedPool: TTLCache<string, PeerState>

  constructor(options: Partial<SignallingOptions> = {}) {
    this.opts = { ...DEFAULT_SIGNALLING_OPTIONS, ...options }
    this.genCode = this.opts.genCode || ((n) => genDigitCode(n))
    this.connections = new ConcurrencyCounter(this.opts.maxConnectionsPerIp)
    this.receiveFailures = new RateLimiter(this.opts.receiveFailuresPerMinute, 60e3, this.opts.now)
    // 只在过期或被挤出时断开，主动 delete 由 disposePeer 自己处理
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
   * 断开并清理连接。disposed 标记保证每个连接只处理一次，配对双方互相清理不会无限递归。
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
    if (s.counted) {
      s.counted = false
      this.connections.release(s.peer.ip)
    }
    try {
      if (s.peer.isOpen()) {
        s.peer.close()
      }
    } catch {
      // 连接可能已经关闭
    }
    if (s.pair) {
      this.disposePeer(s.pair)
    }
  }

  /**
   * 新连接接入，超过同 IP 并发上限时直接断开，返回是否接受
   */
  public open(peer: SignalPeer): boolean {
    const s: PeerState = {
      peer,
      role: null,
      code: null,
      pair: null,
      disposed: false,
      counted: false,
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
      // 非 JSON 或格式不符的消息直接丢弃
      return
    }
    if (data.type === 'send') {
      this.initSend(s)
    } else if (data.type === 'receive') {
      this.initReceive(s, data.code)
    } else if (RELAY_TYPES.has(data.type)) {
      // 只转发 SDP / ICE 信令，未配对时丢弃
      if (s.pair && !s.pair.disposed) {
        s.pair.peer.send(text)
      }
    }
  }

  // 初始化发送端：分配取件码并进入等待池
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

  // 初始化接收端：按取件码查找发送端并配对，失败计入该 IP 的限流
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
    // 配对成功
    this.sendJSON(s, { type: 'status', code: 0 })
    this.startHeartbeat(s)
    this.opts.onPaired?.(target.peer.id, s.peer.id)
  }

  /** 测试与监控用：当前状态统计 */
  public stats() {
    return {
      peers: this.states.size,
      waiting: this.waitPool.size,
      paired: this.pairedPool.size,
      connectionsFor: (ip: string) => this.connections.count(ip)
    }
  }
}
