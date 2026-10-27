import { describe, expect, it, vi } from 'vitest'
import { SignallingHub, parseSignalMessage, type SignalPeer } from '../server/utils/signalling'

class FakePeer implements SignalPeer {
  static n = 0
  id = `p${FakePeer.n++}`
  open = true
  sent: any[] = []
  closeCalls = 0
  constructor(
    public ip = '1.1.1.1',
    private hub?: SignallingHub
  ) {}
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closeCalls++
    this.open = false
    // Mimic crossws: call the close hook synchronously on close
    this.hub?.close(this)
  }
  isOpen() {
    return this.open
  }
  last() {
    return this.sent[this.sent.length - 1]
  }
}

function setup(opts = {}) {
  const onPaired = vi.fn()
  const hub = new SignallingHub({ heartbeatMs: 0, onPaired, ...opts })
  const peer = (ip?: string) => {
    const p = new FakePeer(ip, hub)
    hub.open(p)
    return p
  }
  return { hub, peer, onPaired }
}

const msg = (o: unknown) => JSON.stringify(o)

describe('parseSignalMessage', () => {
  it('rejects oversize, non JSON and typeless messages', () => {
    expect(parseSignalMessage('{"type":"x"}', 100, 10)).toBe('oversize')
    expect(parseSignalMessage('not json', 8, 100)).toBeNull()
    expect(parseSignalMessage('[1]', 3, 100)).toBeNull()
    expect(parseSignalMessage('{"a":1}', 7, 100)).toBeNull()
    expect(parseSignalMessage('{"type":"sdp"}', 14, 100)).toEqual({ type: 'sdp' })
  })
})

describe('SignallingHub pairing', () => {
  it('pairs a sender and a recipient and relays signalling', () => {
    const { hub, peer, onPaired } = setup()
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    const { code } = sender.last()
    expect(code).toMatch(/^\d{6}$/)

    const recipient = peer('2.2.2.2')
    hub.message(recipient, msg({ type: 'receive', code }))
    expect(recipient.last()).toEqual({ type: 'status', code: 0 })
    expect(onPaired).toHaveBeenCalledOnce()

    hub.message(recipient, msg({ type: 'sdp', data: { type: 'offer', sdp: 'x' } }))
    expect(sender.last()).toEqual({ type: 'sdp', data: { type: 'offer', sdp: 'x' } })
    hub.message(sender, msg({ type: 'candidate', data: { candidate: 'c' } }))
    expect(recipient.last()).toEqual({ type: 'candidate', data: { candidate: 'c' } })

    // A pickup code is single-use
    const third = peer('3.3.3.3')
    hub.message(third, msg({ type: 'receive', code }))
    expect(third.last()).toEqual({ type: 'status', code: 404 })
    expect(third.open).toBe(false)
  })

  it('does not relay unknown types and drops non JSON without closing', () => {
    const { hub, peer } = setup()
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    const recipient = peer('2.2.2.2')
    hub.message(recipient, msg({ type: 'receive', code: sender.last().code }))
    const before = sender.sent.length
    hub.message(recipient, msg({ type: 'code', code: '123456' }))
    hub.message(recipient, 'garbage')
    expect(sender.sent.length).toBe(before)
    expect(recipient.open).toBe(true)
  })

  it('closes on oversize messages', () => {
    const { hub, peer } = setup({ maxMessageBytes: 32 })
    const p = peer()
    hub.message(p, msg({ type: 'sdp', data: 'x'.repeat(100) }))
    expect(p.open).toBe(false)
  })

  it('rejects wrong length or non digit codes', () => {
    const { hub, peer } = setup()
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    const code: string = sender.last().code
    for (const bad of [code.slice(0, 4), `${code}0`, 'abcdef', 123456]) {
      const r = peer(`9.9.9.${String(bad).length}`)
      hub.message(r, msg({ type: 'receive', code: bad }))
      expect(r.last()).toEqual({ type: 'status', code: 404 })
    }
    expect(sender.open).toBe(true)
  })

  it('a sender cannot pair with itself or re-init', () => {
    const { hub, peer } = setup()
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    const code = sender.last().code
    hub.message(sender, msg({ type: 'send' }))
    hub.message(sender, msg({ type: 'receive', code }))
    expect(sender.sent).toHaveLength(1)
    const r = peer('2.2.2.2')
    hub.message(r, msg({ type: 'receive', code }))
    expect(r.last()).toEqual({ type: 'status', code: 0 })
    expect(sender.last()).toEqual({ type: 'paired' })
  })

  it('closing one side closes the other without recursing forever', () => {
    const { hub, peer } = setup()
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    const recipient = peer('2.2.2.2')
    hub.message(recipient, msg({ type: 'receive', code: sender.last().code }))
    // FakePeer.close calls hub.close synchronously, the case most prone to recursion
    recipient.close()
    expect(sender.open).toBe(false)
    expect(sender.closeCalls).toBe(1)
    expect(recipient.closeCalls).toBe(1)
    expect(hub.stats().peers).toBe(0)
    expect(hub.stats().paired).toBe(0)
  })

  it('frees the code when a waiting sender leaves', () => {
    const { hub, peer } = setup()
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    const code = sender.last().code
    hub.close(sender)
    expect(hub.stats().waiting).toBe(0)
    const r = peer('2.2.2.2')
    hub.message(r, msg({ type: 'receive', code }))
    expect(r.last()).toEqual({ type: 'status', code: 404 })
  })

  it('regenerates the code on collision', () => {
    const seq = ['111111', '111111', '222222']
    let i = 0
    const { hub, peer } = setup({ genCode: () => seq[i++]! })
    const a = peer()
    hub.message(a, msg({ type: 'send' }))
    const b = peer()
    hub.message(b, msg({ type: 'send' }))
    expect(a.last().code).toBe('111111')
    expect(b.last().code).toBe('222222')
  })
})

describe('SignallingHub limits', () => {
  it('rate limits failed lookups per IP', () => {
    let now = 0
    const { hub, peer } = setup({ receiveFailuresPerMinute: 3, now: () => now })
    for (let i = 0; i < 3; i++) {
      const r = peer('6.6.6.6')
      hub.message(r, msg({ type: 'receive', code: '000000' }))
      expect(r.last()).toEqual({ type: 'status', code: 404 })
      expect(r.open).toBe(false)
    }
    // A rate-limited IP is rejected even with a correct code
    const sender = peer('1.1.1.1')
    hub.message(sender, msg({ type: 'send' }))
    const code = sender.last().code
    const blocked = peer('6.6.6.6')
    hub.message(blocked, msg({ type: 'receive', code }))
    expect(blocked.last()).toEqual({ type: 'status', code: 429 })
    expect(blocked.open).toBe(false)

    // Other IPs are unaffected
    const other = peer('7.7.7.7')
    hub.message(other, msg({ type: 'receive', code }))
    expect(other.last()).toEqual({ type: 'status', code: 0 })

    now = 61e3
    const later = peer('6.6.6.6')
    hub.message(later, msg({ type: 'receive', code: '000000' }))
    expect(later.last()).toEqual({ type: 'status', code: 404 })
  })

  it('caps concurrent connections per IP and releases slots on close', () => {
    const { hub, peer } = setup({ maxConnectionsPerIp: 2 })
    const a = peer('5.5.5.5')
    const b = peer('5.5.5.5')
    const c = peer('5.5.5.5')
    expect(a.open && b.open).toBe(true)
    expect(c.open).toBe(false)
    expect(c.sent[0]).toMatchObject({ type: 'err', data: 429 })
    expect(hub.stats().connectionsFor('5.5.5.5')).toBe(2)
    a.close()
    expect(hub.stats().connectionsFor('5.5.5.5')).toBe(1)
    const d = peer('5.5.5.5')
    expect(d.open).toBe(true)
    expect(peer('8.8.8.8').open).toBe(true)
  })

  it('sends heartbeats and cleans up dead sockets', () => {
    vi.useFakeTimers()
    try {
      const hub = new SignallingHub({ heartbeatMs: 1000 })
      const p = new FakePeer('1.1.1.1')
      hub.open(p)
      hub.message(p, msg({ type: 'send' }))
      vi.advanceTimersByTime(3000)
      expect(p.sent.filter((m) => m.type === 'ping')).toHaveLength(3)
      p.open = false
      vi.advanceTimersByTime(1000)
      expect(hub.stats().peers).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('SignallingHub logging hooks', () => {
  it('reports each rejection reason', () => {
    const onReject = vi.fn()
    const { hub, peer } = setup({
      onReject,
      maxConnectionsPerIp: 2,
      receiveFailuresPerMinute: 1,
      maxMessageBytes: 64
    })
    const bad = peer('2.2.2.2')
    hub.message(bad, msg({ type: 'receive', code: '000000' }))
    expect(onReject).toHaveBeenLastCalledWith(bad.id, 'invalid-code')

    const limited = peer('2.2.2.2')
    hub.message(limited, msg({ type: 'receive', code: '000000' }))
    expect(onReject).toHaveBeenLastCalledWith(limited.id, 'rate-limited')

    const big = peer('3.3.3.3')
    hub.message(big, 'x'.repeat(100), 100)
    expect(onReject).toHaveBeenLastCalledWith(big.id, 'oversize')

    peer('4.4.4.4')
    peer('4.4.4.4')
    const third = peer('4.4.4.4')
    expect(onReject).toHaveBeenLastCalledWith(third.id, 'too-many-connections')
    expect(onReject).toHaveBeenCalledTimes(4)
  })

  it('reports both peer ids on pairing', () => {
    const { hub, peer, onPaired } = setup()
    const s = peer()
    hub.message(s, msg({ type: 'send' }))
    const r = peer('9.9.9.9')
    hub.message(r, msg({ type: 'receive', code: s.last().code }))
    expect(onPaired).toHaveBeenCalledWith(s.id, r.id)
  })
})

describe('SignallingHub ICE tickets', () => {
  function pair(opts = {}) {
    const { hub, peer } = setup(opts)
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    const recipient = peer('2.2.2.2')
    hub.message(recipient, msg({ type: 'receive', code: sender.last().code }))
    return { hub, peer, sender, recipient }
  }

  it('issues no tickets unless enabled', () => {
    const { hub, sender, recipient } = pair()
    expect(recipient.last()).toEqual({ type: 'status', code: 0 })
    expect(sender.last()).toEqual({ type: 'paired' })
    expect(hub.stats().iceTickets).toBe(0)
  })

  it('gives each paired peer its own ticket', () => {
    const { hub, sender, recipient } = pair({ issueIceTickets: true })
    const rt = recipient.last().iceTicket
    const st = sender.last().iceTicket
    expect(recipient.last()).toMatchObject({ type: 'status', code: 0 })
    expect(sender.last()).toMatchObject({ type: 'paired' })
    expect(rt).toMatch(/^[\w-]{32}$/)
    expect(st).toMatch(/^[\w-]{32}$/)
    expect(rt).not.toBe(st)
    expect(hub.isActiveTicket(rt)).toBe(true)
    expect(hub.isActiveTicket(st)).toBe(true)
    expect(hub.isActiveTicket('x'.repeat(32))).toBe(false)
  })

  it('does not issue tickets to a waiting sender', () => {
    const { hub, peer } = setup({ issueIceTickets: true })
    const sender = peer()
    hub.message(sender, msg({ type: 'send' }))
    expect(sender.last()).toEqual({ type: 'code', code: expect.any(String) })
    expect(hub.stats().iceTickets).toBe(0)
  })

  it('revokes both tickets when either side disconnects', () => {
    const { hub, sender, recipient } = pair({ issueIceTickets: true })
    const rt = recipient.last().iceTicket
    const st = sender.last().iceTicket
    sender.close()
    expect(hub.isActiveTicket(rt)).toBe(false)
    expect(hub.isActiveTicket(st)).toBe(false)
    expect(hub.stats().iceTickets).toBe(0)
  })
})
