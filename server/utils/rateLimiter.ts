/**
 * Sliding-window rate limiter: records hit times per key within the window; a key is limited once hits reach the cap.
 * Used to cap failed pickup-code lookups per IP and prevent code enumeration.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  private prune(key: string): number[] {
    const list = this.hits.get(key)
    if (!list) {
      return []
    }
    const cutoff = this.now() - this.windowMs
    while (list.length > 0 && list[0]! <= cutoff) {
      list.shift()
    }
    if (list.length === 0) {
      this.hits.delete(key)
    }
    return list
  }

  /** Whether the key has reached the cap */
  public isLimited(key: string): boolean {
    return this.prune(key).length >= this.limit
  }

  /** Record a hit; returns whether the cap is now reached */
  public hit(key: string): boolean {
    const list = this.prune(key)
    list.push(this.now())
    this.hits.set(key, list)
    if (this.hits.size > 10000) {
      this.sweep()
    }
    return list.length >= this.limit
  }

  /** Drop expired entries to avoid memory growth over long runs */
  public sweep(): void {
    for (const key of [...this.hits.keys()]) {
      this.prune(key)
    }
  }

  public get size(): number {
    return this.hits.size
  }
}

/**
 * Per-key concurrency counter, used to cap concurrent WebSocket connections per IP.
 */
export class ConcurrencyCounter {
  private counts = new Map<string, number>()

  constructor(private readonly max: number) {}

  /** Try to take a slot; returns false without counting if over the cap */
  public acquire(key: string): boolean {
    const n = this.counts.get(key) || 0
    if (n >= this.max) {
      return false
    }
    this.counts.set(key, n + 1)
    return true
  }

  public release(key: string): void {
    const n = (this.counts.get(key) || 0) - 1
    if (n > 0) {
      this.counts.set(key, n)
    } else {
      this.counts.delete(key)
    }
  }

  public count(key: string): number {
    return this.counts.get(key) || 0
  }
}
