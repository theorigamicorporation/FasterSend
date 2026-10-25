/**
 * Parse the trustProxy setting into a trusted reverse-proxy hop count.
 * true / "true" trusts 1 hop; a number trusts that many hops; anything else ignores X-Forwarded-For.
 */
export function parseTrustProxy(value: unknown): number {
  if (value === true || value === 'true') {
    return 1
  }
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(n) && n > 0 ? n : 0
}

// Unmap IPv4-mapped IPv6 addresses so one client is not counted as two
function normalizeIP(ip: string): string {
  const v = ip.trim()
  return v.startsWith('::ffff:') && v.includes('.') ? v.slice(7) : v
}

/**
 * Get the client IP.
 * X-Forwarded-For is only read when a trusted proxy is configured, taking the entry
 * that many hops from the right. Leftmost entries are client-supplied and can be spoofed.
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
