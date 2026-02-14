/**
 * ProviderChain - 故障转移链编排器
 *
 * 集成: SWR 缓存 → Singleflight → CircuitBreaker → RateLimiter → Provider
 *
 * 降级层次 (从优到劣):
 *   1. 新鲜缓存 (0ms)
 *   2. Singleflight 共享结果
 *   3. 主源 Provider
 *   4. 备源 Provider
 *   5. 过期缓存 (标记 stale)
 *   6. 错误响应
 */

import { TTLCache, type CacheOptions } from './cache';
import { Singleflight } from './singleflight';
import { CircuitBreaker, CircuitBreakerError } from './circuitBreaker';
import { RateLimiter, RateLimitError } from './rateLimiter';

export interface DataProvider<TArgs, TResult> {
  name: string;
  execute(args: TArgs): Promise<TResult>;
}

interface ProviderEntry<TArgs, TResult> {
  provider: DataProvider<TArgs, TResult>;
  circuitBreaker: CircuitBreaker;
  rateLimiter: RateLimiter;
}

export interface ProviderChainOptions<TArgs> {
  /** 链名称, 用于日志 */
  name: string;
  /** 缓存配置 */
  cacheOptions: CacheOptions;
  /** 从参数生成缓存 key */
  cacheKeyFn: (args: TArgs) => string;
}

export class ProviderChain<TArgs, TResult> {
  private readonly name: string;
  private readonly cache: TTLCache<TResult>;
  private readonly singleflight = new Singleflight();
  private readonly providers: ProviderEntry<TArgs, TResult>[] = [];
  private readonly cacheKeyFn: (args: TArgs) => string;

  constructor(options: ProviderChainOptions<TArgs>) {
    this.name = options.name;
    this.cache = new TTLCache<TResult>(options.name, options.cacheOptions);
    this.cacheKeyFn = options.cacheKeyFn;
  }

  /**
   * 注册 Provider (按添加顺序决定优先级)
   */
  addProvider(
    provider: DataProvider<TArgs, TResult>,
    circuitBreaker: CircuitBreaker,
    rateLimiter: RateLimiter,
  ): this {
    this.providers.push({ provider, circuitBreaker, rateLimiter });
    return this;
  }

  /**
   * 执行请求, 完整降级链:
   *   cache → singleflight → providers (failover) → stale cache → error
   */
  async execute(args: TArgs): Promise<TResult> {
    const cacheKey = this.cacheKeyFn(args);

    // ── 1. 检查缓存 ──
    const cached = this.cache.get(cacheKey);
    if (cached.hit === 'fresh') {
      console.log(`[ProviderChain:${this.name}] cache HIT (fresh) key=${cacheKey}`);
      return cached.value!;
    }

    if (cached.hit === 'stale') {
      console.log(`[ProviderChain:${this.name}] cache HIT (stale) key=${cacheKey}, background revalidate`);
      // 后台异步刷新, 不阻塞返回
      this.backgroundRevalidate(args, cacheKey);
      return cached.value!;
    }

    // ── 2. Singleflight 合并并发请求 ──
    return this.singleflight.execute(cacheKey, async () => {
      // singleflight 进入后再检查一次缓存 (可能前一个 flight 刚写入)
      const rechecked = this.cache.get(cacheKey);
      if (rechecked.hit === 'fresh') {
        return rechecked.value!;
      }

      // ── 3. 遍历 Provider 链 ──
      const errors: string[] = [];

      for (const entry of this.providers) {
        const { provider, circuitBreaker, rateLimiter } = entry;

        try {
          // 熔断检查 + 限流检查 + 执行
          rateLimiter.acquire();

          const result = await circuitBreaker.execute(() =>
            provider.execute(args),
          );

          // 成功: 写入缓存并返回
          this.cache.set(cacheKey, result);
          console.log(
            `[ProviderChain:${this.name}] provider ${provider.name} SUCCESS`,
          );
          return result;
        } catch (err) {
          const errMsg =
            err instanceof Error ? err.message : String(err);

          if (
            err instanceof CircuitBreakerError ||
            err instanceof RateLimitError
          ) {
            console.log(
              `[ProviderChain:${this.name}] provider ${provider.name} SKIPPED: ${errMsg}`,
            );
          } else {
            console.log(
              `[ProviderChain:${this.name}] provider ${provider.name} FAILED: ${errMsg}, failover to next`,
            );
          }

          errors.push(`${provider.name}: ${errMsg}`);
          continue;
        }
      }

      // ── 4. 全部 Provider 失败, 尝试返回 stale 缓存 ──
      if (cached.hit === 'stale' && cached.value !== undefined) {
        console.log(
          `[ProviderChain:${this.name}] all providers failed, returning STALE cache key=${cacheKey}`,
        );
        return cached.value;
      }

      // ── 5. 无任何可用数据 ──
      const errorMessage = `所有数据源均不可用: ${errors.join('; ')}`;
      console.error(`[ProviderChain:${this.name}] ${errorMessage}`);
      throw new Error(errorMessage);
    });
  }

  /**
   * 后台异步刷新 (SWR), 不影响当前请求
   */
  private backgroundRevalidate(args: TArgs, cacheKey: string): void {
    // 用 singleflight 避免重复刷新
    this.singleflight
      .execute(`bg:${cacheKey}`, async () => {
        for (const entry of this.providers) {
          try {
            entry.rateLimiter.acquire();
            const result = await entry.circuitBreaker.execute(() =>
              entry.provider.execute(args),
            );
            this.cache.set(cacheKey, result);
            console.log(
              `[ProviderChain:${this.name}] background revalidate SUCCESS via ${entry.provider.name}`,
            );
            return result;
          } catch {
            continue;
          }
        }
        console.log(
          `[ProviderChain:${this.name}] background revalidate FAILED (all providers)`,
        );
        return undefined;
      })
      .catch(() => {
        /* swallow - background task */
      });
  }
}
