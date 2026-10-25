/**
 * 未配置 NUXT_PUBLIC_ICE_SERVERS 时使用的默认 ICE 服务器
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
 * 解析 ICE 服务器配置。
 * Nuxt 会把 JSON 形式的环境变量预先解析成对象，因此同时接受字符串和数组。
 * 无效 JSON 或没有任何合法条目时回退到默认值。
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
 * 解析 ICE 传输策略，只接受 all / relay，其余返回 undefined（浏览器默认 all）
 */
export function parseIceTransportPolicy(raw: unknown): RTCIceTransportPolicy | undefined {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return v === 'all' || v === 'relay' ? v : undefined
}
