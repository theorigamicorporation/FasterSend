import { getClientIP, parseTrustProxy } from '../utils/clientIP'
import { DEFAULT_SIGNALLING_OPTIONS, SignallingHub, type SignalPeer } from '../utils/signalling'

// 不记录 IP，只记录连接 id 和事件
function log(level: 'info' | 'warn' | 'error', msg: string) {
  const line = `${new Date().toISOString()} ${level}: ${msg}`
  if (level === 'info') console.log(line)
  else if (level === 'warn') console.warn(line)
  else console.error(line)
}

const MAX_MESSAGE_BYTES = DEFAULT_SIGNALLING_OPTIONS.maxMessageBytes

// crossws 的 peer 在每个回调里都是同一个实例，这里缓存其适配对象
const adapters = new WeakMap<object, SignalPeer>()
let hub: SignallingHub | null = null
let trustProxyHops = 0

function getHub(): SignallingHub {
  if (!hub) {
    const config = useRuntimeConfig()
    trustProxyHops = parseTrustProxy(config.trustProxy)
    const positive = (v: unknown, d: number) => (Number(v) > 0 ? Number(v) : d)
    hub = new SignallingHub({
      maxConnectionsPerIp: positive(config.maxConnectionsPerIp, 32),
      receiveFailuresPerMinute: positive(config.receiveFailuresPerMinute, 10),
      onPaired: (sender, receiver) => log('info', `paired: #${sender} -> #${receiver}`),
      onReject: (id, reason) => log('warn', `rejected: #${id} ${reason}`)
    })
  }
  return hub
}

function adapt(peer: any): SignalPeer {
  let a = adapters.get(peer)
  if (!a) {
    a = {
      id: peer.id,
      ip: getClientIP(
        peer.request?.headers?.get?.('x-forwarded-for'),
        peer.remoteAddress,
        trustProxyHops
      ),
      send: (data) => peer.send(data),
      close: () => peer.close(),
      // readyState 1 = OPEN
      isOpen: () => peer.websocket?.readyState === 1
    }
    adapters.set(peer, a)
  }
  return a
}

export default defineWebSocketHandler({
  open(peer) {
    const h = getHub()
    const p = adapt(peer)
    log('info', `open: #${p.id}`)
    h.open(p)
  },

  close(peer) {
    log('info', `close: #${peer.id}`)
    getHub().close(adapt(peer))
  },

  message(peer, msg) {
    const raw = msg.rawData as { byteLength?: number } | undefined
    const size = raw?.byteLength
    // 超长消息不做解码，交给 hub 按长度直接断开
    const text = size !== undefined && size > MAX_MESSAGE_BYTES ? '' : msg.text()
    getHub().message(adapt(peer), text, size ?? text.length)
  },

  error(peer, error) {
    log('error', `socket error: #${peer.id} ${error instanceof Error ? error.message : String(error)}`)
    getHub().close(adapt(peer))
  }
})
