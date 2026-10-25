import { getClientIP, parseTrustProxy } from '../utils/clientIP'

export default defineEventHandler((event) => {
  const trustProxyHops = parseTrustProxy(useRuntimeConfig(event).trustProxy)
  return getClientIP(
    getRequestHeader(event, 'x-forwarded-for'),
    event.node.req.socket?.remoteAddress,
    trustProxyHops
  )
})
