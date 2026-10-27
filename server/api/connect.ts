import { getClientIP } from '../utils/clientIP'
import { log, useSignallingHub, useTrustProxyHops } from '../utils/services'
import { DEFAULT_SIGNALLING_OPTIONS, type SignalPeer } from '../utils/signalling'

const MAX_MESSAGE_BYTES = DEFAULT_SIGNALLING_OPTIONS.maxMessageBytes

// crossws passes the same peer instance to every callback, so cache its adapter
const adapters = new WeakMap<object, SignalPeer>()

const getHub = useSignallingHub

function adapt(peer: any): SignalPeer {
  let a = adapters.get(peer)
  if (!a) {
    a = {
      id: peer.id,
      ip: getClientIP(
        peer.request?.headers?.get?.('x-forwarded-for'),
        peer.remoteAddress,
        useTrustProxyHops()
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
    // Skip decoding oversize messages; the hub closes them by length
    const text = size !== undefined && size > MAX_MESSAGE_BYTES ? '' : msg.text()
    getHub().message(adapt(peer), text, size ?? text.length)
  },

  error(peer, error) {
    log(
      'error',
      `socket error: #${peer.id} ${error instanceof Error ? error.message : String(error)}`
    )
    getHub().close(adapt(peer))
  }
})
