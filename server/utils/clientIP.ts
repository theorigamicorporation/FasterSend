/**
 * 解析 trustProxy 配置，返回可信反向代理的跳数。
 * true / "true" 表示信任 1 跳；数字表示信任对应跳数；其余情况一律不信任 X-Forwarded-For。
 */
export function parseTrustProxy(value: unknown): number {
  if (value === true || value === 'true') {
    return 1
  }
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(n) && n > 0 ? n : 0
}

// IPv4 映射的 IPv6 地址统一还原为 IPv4，避免同一客户端被计为两个地址
function normalizeIP(ip: string): string {
  const v = ip.trim()
  return v.startsWith('::ffff:') && v.includes('.') ? v.slice(7) : v
}

/**
 * 获取客户端 IP。
 * 只有在配置了可信代理时才读取 X-Forwarded-For，并且从右往左数可信跳数取值：
 * 最左侧的条目由客户端自行填写，可以被伪造，不能直接使用。
 */
export function getClientIP(
  xForwardedFor: string | null | undefined,
  remoteAddress: string | null | undefined,
  trustProxyHops: number
): string {
  if (trustProxyHops > 0 && xForwardedFor) {
    const entries = xForwardedFor
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (entries.length > 0) {
      const index = Math.max(0, entries.length - trustProxyHops)
      return normalizeIP(entries[index]!)
    }
  }
  return remoteAddress ? normalizeIP(remoteAddress) : 'unknown'
}
