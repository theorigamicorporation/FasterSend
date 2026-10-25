/**
 * Default ICE servers, used when NUXT_PUBLIC_ICE_SERVERS is not set
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

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
