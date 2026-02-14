/**
 * RateLimiter - 令牌桶限流器
 *
 * 每个 Provider 独立配额, 令牌按时间匀速恢复。
 * 令牌不足时抛 RateLimitError (非阻塞), ProviderChain 捕获后 failover。
 */

export class RateLimitError extends Error {
  constructor(name: string, nextRefillMs: number) {
    super(
      `RateLimiter [${name}] rejected (0 tokens, next refill in ${(nextRefillMs / 1000).toFixed(1)}s)`,
    );
    this.name = 'RateLimitError';
  }
}

export interface RateLimiterOptions {
  /** 每分钟令牌数 */
  tokensPerMinute: number;
  /** 瞬时突发上限 */
  burstSize: number;
}

export class RateLimiter {
  readonly providerName: string;
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRateMs: number; // ms per token
  private lastRefill: number;

  constructor(name: string, options: RateLimiterOptions) {
    this.providerName = name;
    this.maxTokens = options.burstSize;
    this.tokens = options.burstSize;
    this.refillRateMs = 60_000 / options.tokensPerMinute;
    this.lastRefill = Date.now();
  }

  /**
   * 尝试获取 1 个令牌。
   * 成功则消耗令牌, 失败则抛 RateLimitError。
   */
  acquire(): void {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      console.log(
        `[RateLimiter:${this.providerName}] token acquired (remaining: ${Math.floor(this.tokens)}/${this.maxTokens})`,
      );
      return;
    }

    const nextRefillMs = this.refillRateMs - (Date.now() - this.lastRefill);
    console.log(
      `[RateLimiter:${this.providerName}] REJECTED (0 tokens, next refill in ${(nextRefillMs / 1000).toFixed(1)}s)`,
    );
    throw new RateLimitError(this.providerName, Math.max(0, nextRefillMs));
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed / this.refillRateMs;
    if (newTokens >= 1) {
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}
