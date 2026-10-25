/**
 * 滑动窗口计数限流器：记录每个 key 在窗口期内的命中时间，命中数达到上限即视为受限。
 * 用于限制同一 IP 的取件码查询失败次数，防止枚举取件码。
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

  /** 当前 key 是否已经达到上限 */
  public isLimited(key: string): boolean {
    return this.prune(key).length >= this.limit
  }

  /** 记录一次命中，返回记录后是否达到上限 */
  public hit(key: string): boolean {
    const list = this.prune(key)
    list.push(this.now())
    this.hits.set(key, list)
    if (this.hits.size > 10000) {
      this.sweep()
    }
    return list.length >= this.limit
  }

  /** 清理所有过期记录，避免长时间运行时内存增长 */
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
 * 每个 key 的并发计数器，用于限制同一 IP 的并发 WebSocket 连接数。
 */
export class ConcurrencyCounter {
  private counts = new Map<string, number>()

  constructor(private readonly max: number) {}

  /** 尝试占用一个名额，超过上限时返回 false 且不计数 */
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
