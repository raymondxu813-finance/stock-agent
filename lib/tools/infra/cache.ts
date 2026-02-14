/**
 * TTLCache - Stale-While-Revalidate 内存缓存
 *
 * 数据分两个阶段:
 *   fresh (TTL 内)  → 直接返回
 *   stale (过期但在 staleMs 内) → 返回旧数据 + 后台异步刷新
 *   expired (超过 staleMs) → 视为未命中
 *
 * LRU 淘汰 + 定时清理
 */

export interface CacheOptions {
  /** 新鲜期 (ms) */
  freshMs: number;
  /** 过期可用期 (ms), 从写入时间起算, 必须 > freshMs */
  staleMs: number;
  /** 最大条目数, 默认 1000 */
  maxSize?: number;
}

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  lastAccessed: number;
}

export type CacheHitType = 'fresh' | 'stale' | 'miss';

export interface CacheGetResult<T> {
  hit: CacheHitType;
  value: T | undefined;
}

export class TTLCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>();
  private readonly freshMs: number;
  private readonly staleMs: number;
  private readonly maxSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly name: string, options: CacheOptions) {
    this.freshMs = options.freshMs;
    this.staleMs = options.staleMs;
    this.maxSize = options.maxSize ?? 1000;

    // 每 10 分钟清理超过 staleMs 的条目
    this.cleanupTimer = setInterval(() => this.cleanup(), 10 * 60_000);
    // 允许 Node.js 进程在 timer 存活时退出
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 获取缓存值, 返回命中类型 + 值
   */
  get(key: string): CacheGetResult<T> {
    const entry = this.map.get(key);
    if (!entry) {
      return { hit: 'miss', value: undefined };
    }

    const age = Date.now() - entry.createdAt;

    // 超过 stale 期限, 视为过期删除
    if (age > this.staleMs) {
      this.map.delete(key);
      return { hit: 'miss', value: undefined };
    }

    // 更新 LRU 访问时间
    entry.lastAccessed = Date.now();

    if (age <= this.freshMs) {
      return { hit: 'fresh', value: entry.value };
    }

    // stale: 仍返回值, 调用方负责后台刷新
    return { hit: 'stale', value: entry.value };
  }

  /**
   * 写入缓存
   */
  set(key: string, value: T): void {
    // LRU 淘汰
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      this.evictLRU();
    }

    this.map.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });
  }

  /**
   * 删除指定 key
   */
  delete(key: string): void {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.map) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.map.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.map) {
      if (now - entry.createdAt > this.staleMs) {
        this.map.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[Cache:${this.name}] cleanup: removed ${removed} expired entries, ${this.map.size} remaining`);
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.map.clear();
  }
}
