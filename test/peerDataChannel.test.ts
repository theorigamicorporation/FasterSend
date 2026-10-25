import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 最小化的 RTCDataChannel 替身：按顺序把消息投递给对端，并异步触发 bufferedamountlow
class FakeDataChannel {
  bufferedAmountLowThreshold = 0
  onmessage: ((e: { data: unknown }) => void) | null = null
  onopen: (() => void) | null = null
  onbufferedamountlow: (() => void) | null = null
  peer: FakeDataChannel | null = null
  sent: unknown[] = []
  private lowPending = false

  send(data: unknown) {
    // 模拟浏览器：发送时复制数据
    const copy = typeof data === 'string' ? data : (data as Uint8Array | ArrayBuffer).slice(0)
    this.sent.push(copy)
    const peer = this.peer
    queueMicrotask(() => peer?.onmessage?.({ data: copy }))
    if (!this.lowPending) {
      this.lowPending = true
      setTimeout(() => {
        this.lowPending = false
        this.onbufferedamountlow?.()
      }, 0)
    }
  }
  close() {}
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = []
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: RTCSessionDescriptionInit | null = null
  onconnectionstatechange: (() => void) | null = null
  ondatachannel: ((e: { channel: FakeDataChannel }) => void) | null = null
  onnegotiationneeded: (() => void) | null = null
  onicecandidate: unknown = null
  onicecandidateerror: unknown = null
  restartIce = vi.fn()
  closed = false
  constructor(public config: RTCConfiguration) {
    FakePeerConnection.instances.push(this)
  }
  createDataChannel() {
    return new FakeDataChannel()
  }
  async createOffer() {
    return { type: 'offer', sdp: 'v=0' }
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d
  }
  close() {
    this.closed = true
  }
  setState(s: RTCPeerConnectionState) {
    this.connectionState = s
    this.onconnectionstatechange?.()
  }
}

vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
const { PeerDataChannel } = await import('../app/utils/PeerDataChannel')

function pair(blockSize = 1024) {
  const a = new PeerDataChannel({ initializeDataChannel: true, blockSize })
  const b = new PeerDataChannel({ blockSize })
  const dcA = (a as any).dc as FakeDataChannel
  const dcB = new FakeDataChannel()
  dcA.peer = dcB
  dcB.peer = dcA
  ;(b as any).pc.ondatachannel({ channel: dcB })
  const received: { data: ArrayBuffer | string; size: number }[] = []
  let notify: () => void = () => {}
  b.onReceive = async (data, info) => {
    received.push({ data, size: info.size })
    notify()
  }
  const next = () => new Promise<void>((r) => (notify = r))
  return { a, b, dcA, received, next }
}

describe('PeerDataChannel framing', () => {
  it('round trips a multi-chunk string', async () => {
    const { a, received, next, dcA } = pair(1024)
    const text = JSON.stringify({ type: 'files', data: 'x'.repeat(5000) })
    const got = next()
    await a.sendData(text)
    await got
    expect(received[0]!.data).toBe(text)
    // 1 个头 + ceil(len / blockSize) 个分片
    expect(dcA.sent).toHaveLength(1 + Math.ceil(text.length / 1024))
    expect(JSON.parse(dcA.sent[0] as string)).toEqual({
      count: Math.ceil(text.length / 1024),
      type: 'string'
    })
  })

  it('keeps multi-byte characters intact across chunk boundaries', async () => {
    const { a, received, next } = pair(16)
    const text = 'a' + '😀文件'.repeat(50)
    const got = next()
    await a.sendData(text)
    await got
    expect(received[0]!.data).toBe(text)
  })

  it('round trips binary data in order, including a short last chunk', async () => {
    const { a, received, next } = pair(1000)
    const buf = new Uint8Array(100_123)
    for (let i = 0; i < buf.length; i++) buf[i] = (i * 31 + 7) & 0xff
    const got = next()
    await a.sendData(buf.buffer)
    await got
    const out = new Uint8Array(received[0]!.data as ArrayBuffer)
    expect(received[0]!.size).toBe(buf.length)
    expect(out).toEqual(buf)
  })

  it('handles several messages sent back to back', async () => {
    const { a, received, next } = pair(64)
    for (const m of ['one', 'two'.repeat(100), '{"type":"done"}']) {
      const got = next()
      await a.sendData(m)
      await got
    }
    expect(received.map((r) => r.data)).toEqual(['one', 'two'.repeat(100), '{"type":"done"}'])
  })
})

describe('PeerDataChannel connection recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function make(offerer: boolean) {
    const p = new PeerDataChannel({
      initializeDataChannel: offerer,
      iceServers: [{ urls: 'stun:example:3478' }],
      iceTransportPolicy: 'relay'
    })
    const pc = FakePeerConnection.instances[FakePeerConnection.instances.length - 1]!
    const onDispose = vi.fn()
    const onConnected = vi.fn()
    p.onDispose = onDispose
    p.onConnected = onConnected
    return { p, pc, onDispose, onConnected }
  }

  it('passes ICE config through to RTCPeerConnection', () => {
    const { pc } = make(true)
    expect(pc.config).toEqual({
      iceServers: [{ urls: 'stun:example:3478' }],
      iceTransportPolicy: 'relay'
    })
  })

  it('survives a short disconnected blip without reporting a new connection', () => {
    const { pc, onDispose, onConnected } = make(true)
    pc.setState('connected')
    pc.setState('disconnected')
    vi.advanceTimersByTime(9000)
    pc.setState('connected')
    vi.advanceTimersByTime(60000)
    expect(onDispose).not.toHaveBeenCalled()
    expect(pc.restartIce).not.toHaveBeenCalled()
    expect(onConnected).toHaveBeenCalledTimes(1)
  })

  it('restarts ICE after the grace period and gives up if it does not recover', () => {
    const { pc, onDispose } = make(true)
    pc.setState('connected')
    pc.setState('disconnected')
    vi.advanceTimersByTime(10000)
    expect(pc.restartIce).toHaveBeenCalledTimes(1)
    pc.setState('failed')
    vi.advanceTimersByTime(14000)
    expect(onDispose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onDispose).toHaveBeenCalledTimes(1)
    expect(pc.closed).toBe(true)
  })

  it('restarts ICE immediately on failed and recovers', () => {
    const { pc, onDispose } = make(true)
    pc.setState('connected')
    pc.setState('failed')
    expect(pc.restartIce).toHaveBeenCalledTimes(1)
    pc.setState('connected')
    vi.advanceTimersByTime(60000)
    expect(onDispose).not.toHaveBeenCalled()
    // 恢复后再次失败，允许再重启一次
    pc.setState('failed')
    expect(pc.restartIce).toHaveBeenCalledTimes(2)
  })

  it('the answerer waits for the remote restart instead of starting one', () => {
    const { pc, onDispose } = make(false)
    pc.setState('connected')
    pc.setState('failed')
    expect(pc.restartIce).not.toHaveBeenCalled()
    vi.advanceTimersByTime(24000)
    expect(onDispose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onDispose).toHaveBeenCalledTimes(1)
  })

  it('treats closed as terminal and disposes only once', () => {
    const { p, pc, onDispose } = make(true)
    pc.setState('connected')
    pc.setState('closed')
    p.dispose()
    expect(onDispose).toHaveBeenCalledTimes(1)
  })
})
