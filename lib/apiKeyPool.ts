// /lib/apiKeyPool.ts

/**
 * API Key 池化管理器
 * 
 * 功能：
 * - 统一管理所有 LLM API Key（替换 llmClient.ts 和 agentExecutor.ts 中的分散逻辑）
 * - 带健康感知的加权轮询选择策略
 * - 熔断器（连续失败 3 次后自动熔断，60 秒后半开重试）
 * - 滑动窗口频率控制（Per-Key RPM）
 * - 全局并发上限
 * - 带指数退避的自动重试
 * - 运行时动态增删 Key
 * - 健康报告
 */

import { logger } from './logger';

// ============================================
// 类型定义
// ============================================

export type KeyStatus = 'healthy' | 'degraded' | 'disabled';
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface ApiKeyEntry {
  /** 唯一标识（自动生成） */
  id: string;
  /** API Key 值 */
  key: string;
  /** 提供商标识（如 deepseek, openai） */
  provider: string;
  /** Key 状态 */
  status: KeyStatus;
  /** 每分钟最大请求数配额 */
  rpmLimit: number;
  /** 当前滑动窗口内的请求时间戳队列 */
  requestTimestamps: number[];
  /** 连续错误计数 */
  consecutiveErrors: number;
  /** 总错误计数 */
  totalErrors: number;
  /** 总成功计数 */
  totalSuccesses: number;
  /** 最后一次错误时间 */
  lastErrorAt: number | null;
  /** 最后一次成功时间 */
  lastSuccessAt: number | null;
  /** 最后一次错误信息 */
  lastErrorMessage: string | null;
  /** 熔断器状态 */
  circuitBreaker: CircuitBreakerState;
  /** 熔断器打开时间（用于计算半开时机） */
  circuitBreakerOpenedAt: number | null;
}

export interface PoolConfig {
  /** 每个 Key 的默认 RPM 限制 */
  defaultRpmLimit: number;
  /** 触发熔断的连续错误次数 */
  circuitBreakerThreshold: number;
  /** 熔断器恢复时间（毫秒） */
  circuitBreakerResetMs: number;
  /** 全局最大并发 LLM 调用数 */
  maxConcurrentCalls: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试基础延迟（毫秒） */
  retryBaseDelayMs: number;
  /** 重试最大延迟（毫秒） */
  retryMaxDelayMs: number;
}

export interface KeyHealthReport {
  id: string;
  /** Key 的脱敏显示（前4后4） */
  keyMasked: string;
  provider: string;
  status: KeyStatus;
  circuitBreaker: CircuitBreakerState;
  rpmLimit: number;
  currentRpm: number;
  consecutiveErrors: number;
  totalSuccesses: number;
  totalErrors: number;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
}

/** 可重试的错误判断 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  // 429 频率限制, 500/502/503/504 服务端错误, 超时
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  const message = (error.message || '').toLowerCase();
  if (message.includes('timeout') || message.includes('econnreset') || message.includes('enotfound')) return true;
  if (message.includes('rate limit') || message.includes('too many requests')) return true;
  return false;
}

/** Key 脱敏显示 */
function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// ============================================
// ApiKeyPoolManager 实现
// ============================================

export class ApiKeyPoolManager {
  private keys: ApiKeyEntry[] = [];
  private config: PoolConfig;
  private currentIndex: number = 0;
  private activeCalls: number = 0;
  private waitingQueue: Array<{ resolve: () => void }> = [];

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      defaultRpmLimit: parseInt(process.env.RATE_LIMIT_RPM_PER_KEY || '60'),
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 60_000,
      maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_LLM_CALLS || '50'),
      maxRetries: 3,
      retryBaseDelayMs: 1000,
      retryMaxDelayMs: 8000,
      ...config,
    };
  }

  // ========== Key 管理 ==========

  /**
   * 从环境变量初始化 Key 池
   */
  initFromEnv(): void {
    const envKeys = process.env.OPENAI_API_KEYS || '';
    const envKey = process.env.OPENAI_API_KEY || '';

    const keyStrings: string[] = [];
    if (envKeys) {
      keyStrings.push(...envKeys.split(',').map(k => k.trim()).filter(k => k.length > 0));
    } else if (envKey) {
      keyStrings.push(envKey);
    }

    // 添加主持人专用 Key（如果配置了且不在通用池中）
    const moderatorKey = process.env.MODERATOR_API_KEY;
    if (moderatorKey && !keyStrings.includes(moderatorKey)) {
      // 主持人 Key 单独添加，标记 provider
      this.addKey(moderatorKey, 'deepseek-moderator');
    }

    for (const key of keyStrings) {
      this.addKey(key, 'deepseek');
    }

    logger.info({ keyCount: this.keys.length, maxConcurrent: this.config.maxConcurrentCalls }, '[ApiKeyPool] Initialized');
  }

  /**
   * 动态添加 Key
   */
  addKey(key: string, provider: string = 'deepseek', rpmLimit?: number): string {
    // 检查是否已存在
    const existing = this.keys.find(k => k.key === key);
    if (existing) {
      logger.debug({ keyId: existing.id, keyMasked: maskKey(key) }, '[ApiKeyPool] Key already exists');
      return existing.id;
    }

    const entry: ApiKeyEntry = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      key,
      provider,
      status: 'healthy',
      rpmLimit: rpmLimit || this.config.defaultRpmLimit,
      requestTimestamps: [],
      consecutiveErrors: 0,
      totalErrors: 0,
      totalSuccesses: 0,
      lastErrorAt: null,
      lastSuccessAt: null,
      lastErrorMessage: null,
      circuitBreaker: 'closed',
      circuitBreakerOpenedAt: null,
    };

    this.keys.push(entry);
    logger.info({ keyId: entry.id, keyMasked: maskKey(key), provider }, '[ApiKeyPool] Key added');
    return entry.id;
  }

  /**
   * 动态移除 Key
   */
  removeKey(keyId: string): boolean {
    const index = this.keys.findIndex(k => k.id === keyId);
    if (index === -1) return false;
    const removed = this.keys.splice(index, 1)[0];
    logger.info({ keyId, keyMasked: maskKey(removed.key) }, '[ApiKeyPool] Key removed');
    return true;
  }

  /**
   * 禁用/启用 Key
   */
  setKeyStatus(keyId: string, status: KeyStatus): boolean {
    const entry = this.keys.find(k => k.id === keyId);
    if (!entry) return false;
    entry.status = status;
    if (status === 'healthy') {
      entry.consecutiveErrors = 0;
      entry.circuitBreaker = 'closed';
      entry.circuitBreakerOpenedAt = null;
    }
    logger.info({ keyId, keyMasked: maskKey(entry.key), status }, '[ApiKeyPool] Key status changed');
    return true;
  }

  // ========== Key 选择 ==========

  /**
   * 获取下一个可用的 API Key（带并发控制）
   * 等待直到并发数低于上限，然后返回最优 Key
   */
  async acquireKey(preferProvider?: string): Promise<{ keyId: string; apiKey: string }> {
    // 等待并发槽位
    while (this.activeCalls >= this.config.maxConcurrentCalls) {
      await new Promise<void>(resolve => {
        this.waitingQueue.push({ resolve });
      });
    }
    this.activeCalls++;

    const entry = this.selectBestKey(preferProvider);
    if (!entry) {
      this.activeCalls--;
      this.notifyWaiting();
      throw new Error('[ApiKeyPool] No available API keys. All keys are disabled or circuit-breaker open.');
    }

    // 记录请求时间戳
    entry.requestTimestamps.push(Date.now());
    this.cleanOldTimestamps(entry);

    return { keyId: entry.id, apiKey: entry.key };
  }

  /**
   * 释放 Key（调用完成后必须调用）
   */
  releaseKey(keyId: string): void {
    this.activeCalls = Math.max(0, this.activeCalls - 1);
    this.notifyWaiting();
  }

  /**
   * 选择最优 Key
   */
  private selectBestKey(preferProvider?: string): ApiKeyEntry | null {
    const now = Date.now();

    // 更新熔断器状态
    for (const key of this.keys) {
      if (
        key.circuitBreaker === 'open' &&
        key.circuitBreakerOpenedAt &&
        now - key.circuitBreakerOpenedAt >= this.config.circuitBreakerResetMs
      ) {
        key.circuitBreaker = 'half-open';
        logger.info({ keyMasked: maskKey(key.key) }, '[ApiKeyPool] Circuit breaker -> half-open');
      }
    }

    // 可用 Key：非 disabled、非 open 熔断
    let available = this.keys.filter(
      k => k.status !== 'disabled' && k.circuitBreaker !== 'open'
    );

    // 如果有首选 provider，优先使用
    if (preferProvider) {
      const preferred = available.filter(k => k.provider === preferProvider);
      if (preferred.length > 0) {
        available = preferred;
      }
    }

    if (available.length === 0) return null;

    // 按剩余 RPM 配额排序（配额越多越优先）
    available.sort((a, b) => {
      this.cleanOldTimestamps(a);
      this.cleanOldTimestamps(b);
      const remainA = a.rpmLimit - a.requestTimestamps.length;
      const remainB = b.rpmLimit - b.requestTimestamps.length;
      // 如果 RPM 配额相同，优先选 healthy 状态和 half-open（让它试一试）
      if (remainA === remainB) {
        if (a.status === 'healthy' && b.status !== 'healthy') return -1;
        if (b.status === 'healthy' && a.status !== 'healthy') return 1;
      }
      return remainB - remainA;
    });

    // 选择 RPM 配额最多的 Key
    const best = available[0];

    // 检查是否已超出 RPM 限制
    this.cleanOldTimestamps(best);
    if (best.requestTimestamps.length >= best.rpmLimit) {
      // 所有 Key 都超限，选最早能释放的
      logger.warn('[ApiKeyPool] All available keys at RPM limit, proceeding with least loaded key');
    }

    return best;
  }

  /** 清理超过 60 秒的时间戳 */
  private cleanOldTimestamps(entry: ApiKeyEntry): void {
    const oneMinuteAgo = Date.now() - 60_000;
    entry.requestTimestamps = entry.requestTimestamps.filter(t => t > oneMinuteAgo);
  }

  /** 通知等待队列中的下一个请求 */
  private notifyWaiting(): void {
    if (this.waitingQueue.length > 0 && this.activeCalls < this.config.maxConcurrentCalls) {
      const next = this.waitingQueue.shift();
      next?.resolve();
    }
  }

  // ========== 反馈上报 ==========

  /**
   * 上报成功
   */
  reportSuccess(keyId: string): void {
    const entry = this.keys.find(k => k.id === keyId);
    if (!entry) return;

    entry.consecutiveErrors = 0;
    entry.totalSuccesses++;
    entry.lastSuccessAt = Date.now();

    // 半开 -> 闭合
    if (entry.circuitBreaker === 'half-open') {
      entry.circuitBreaker = 'closed';
      entry.status = 'healthy';
      logger.info({ keyMasked: maskKey(entry.key) }, '[ApiKeyPool] Circuit breaker -> closed (recovered)');
    }

    // 降级恢复
    if (entry.status === 'degraded') {
      entry.status = 'healthy';
    }
  }

  /**
   * 上报失败
   */
  reportFailure(keyId: string, error: any): void {
    const entry = this.keys.find(k => k.id === keyId);
    if (!entry) return;

    entry.consecutiveErrors++;
    entry.totalErrors++;
    entry.lastErrorAt = Date.now();
    entry.lastErrorMessage = error?.message || String(error);

    const status = error?.status || error?.statusCode;

    // 429 -> 标记降级
    if (status === 429) {
      entry.status = 'degraded';
      logger.warn({ keyMasked: maskKey(entry.key) }, '[ApiKeyPool] Key rate limited (429), status -> degraded');
    }

    // 连续失败达到阈值 -> 熔断
    if (entry.consecutiveErrors >= this.config.circuitBreakerThreshold) {
      entry.circuitBreaker = 'open';
      entry.circuitBreakerOpenedAt = Date.now();
      logger.warn(
        { keyMasked: maskKey(entry.key), consecutiveErrors: entry.consecutiveErrors },
        '[ApiKeyPool] Circuit breaker OPEN'
      );
    }
  }

  // ========== 带重试的调用封装 ==========

  /**
   * 带自动重试和 Key 切换的 LLM 调用封装
   * 
   * @param fn 实际的 LLM 调用函数，接收 apiKey 参数
   * @param preferProvider 首选提供商
   * @returns 调用结果
   */
  async executeWithRetry<T>(
    fn: (apiKey: string) => Promise<T>,
    preferProvider?: string,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const { keyId, apiKey } = await this.acquireKey(preferProvider);

      try {
        const result = await fn(apiKey);
        this.reportSuccess(keyId);
        this.releaseKey(keyId);
        return result;
      } catch (error: any) {
        this.reportFailure(keyId, error);
        this.releaseKey(keyId);
        lastError = error;

        // 不可重试的错误，直接抛出
        if (!isRetryableError(error)) {
          throw error;
        }

        // 最后一次重试，不再等待
        if (attempt >= this.config.maxRetries) {
          break;
        }

        // 指数退避 + 随机抖动
        const delay = Math.min(
          this.config.retryBaseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
          this.config.retryMaxDelayMs,
        );
        logger.warn(
          { attempt: attempt + 1, maxRetries: this.config.maxRetries, delayMs: Math.round(delay), keyMasked: maskKey(apiKey), error: error.message || String(error) },
          '[ApiKeyPool] Retrying LLM call'
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('[ApiKeyPool] All retries exhausted');
  }

  // ========== 健康报告 ==========

  /**
   * 获取所有 Key 的健康报告
   */
  getHealthReport(): KeyHealthReport[] {
    return this.keys.map(k => {
      this.cleanOldTimestamps(k);
      return {
        id: k.id,
        keyMasked: maskKey(k.key),
        provider: k.provider,
        status: k.status,
        circuitBreaker: k.circuitBreaker,
        rpmLimit: k.rpmLimit,
        currentRpm: k.requestTimestamps.length,
        consecutiveErrors: k.consecutiveErrors,
        totalSuccesses: k.totalSuccesses,
        totalErrors: k.totalErrors,
        lastSuccessAt: k.lastSuccessAt ? new Date(k.lastSuccessAt).toISOString() : null,
        lastErrorAt: k.lastErrorAt ? new Date(k.lastErrorAt).toISOString() : null,
        lastErrorMessage: k.lastErrorMessage,
      };
    });
  }

  /**
   * 获取池概览统计
   */
  getPoolStats(): {
    totalKeys: number;
    healthyKeys: number;
    degradedKeys: number;
    disabledKeys: number;
    openCircuitBreakers: number;
    activeCalls: number;
    maxConcurrent: number;
    waitingRequests: number;
  } {
    return {
      totalKeys: this.keys.length,
      healthyKeys: this.keys.filter(k => k.status === 'healthy').length,
      degradedKeys: this.keys.filter(k => k.status === 'degraded').length,
      disabledKeys: this.keys.filter(k => k.status === 'disabled').length,
      openCircuitBreakers: this.keys.filter(k => k.circuitBreaker === 'open').length,
      activeCalls: this.activeCalls,
      maxConcurrent: this.config.maxConcurrentCalls,
      waitingRequests: this.waitingQueue.length,
    };
  }

  /** Key 池中 Key 的数量 */
  get size(): number {
    return this.keys.length;
  }

  // ========== 健康监控与告警 ==========

  /**
   * 输出一次健康指标日志（供定期调用）
   */
  logHealthMetrics(): void {
    const stats = this.getPoolStats();
    const report = this.getHealthReport();

    // 基本指标
    logger.info({
      totalKeys: stats.totalKeys,
      healthyKeys: stats.healthyKeys,
      degradedKeys: stats.degradedKeys,
      disabledKeys: stats.disabledKeys,
      openCircuitBreakers: stats.openCircuitBreakers,
      activeCalls: stats.activeCalls,
      maxConcurrent: stats.maxConcurrent,
      waitingRequests: stats.waitingRequests,
      // 每个 Key 的 RPM 使用率
      keyRpmUsage: report.map(k => ({
        id: k.id,
        keyMasked: k.keyMasked,
        currentRpm: k.currentRpm,
        rpmLimit: k.rpmLimit,
        status: k.status,
        circuitBreaker: k.circuitBreaker,
        successRate: k.totalSuccesses + k.totalErrors > 0
          ? Math.round(k.totalSuccesses / (k.totalSuccesses + k.totalErrors) * 100)
          : 100,
      })),
    }, '[ApiKeyPool] Health metrics');

    // === 告警检查 ===

    // 告警 1：所有 Key 都不健康
    if (stats.healthyKeys === 0 && stats.totalKeys > 0) {
      logger.error({ stats }, '[ApiKeyPool] ALERT: No healthy keys available!');
    }

    // 告警 2：Key 池使用率超过 80%
    const rpmUtilization = report.reduce((sum, k) => sum + k.currentRpm, 0);
    const rpmCapacity = report.reduce((sum, k) => sum + k.rpmLimit, 0);
    if (rpmCapacity > 0 && rpmUtilization / rpmCapacity > 0.8) {
      logger.warn(
        { rpmUtilization, rpmCapacity, utilizationPct: Math.round(rpmUtilization / rpmCapacity * 100) },
        '[ApiKeyPool] ALERT: RPM utilization > 80%, consider adding more keys'
      );
    }

    // 告警 3：并发等待队列积压
    if (stats.waitingRequests > 5) {
      logger.warn(
        { waitingRequests: stats.waitingRequests, activeCalls: stats.activeCalls, maxConcurrent: stats.maxConcurrent },
        '[ApiKeyPool] ALERT: Request queue building up'
      );
    }

    // 告警 4：有 Key 处于熔断状态
    if (stats.openCircuitBreakers > 0) {
      const openKeys = report.filter(k => k.circuitBreaker === 'open');
      logger.warn(
        { openCircuitBreakers: stats.openCircuitBreakers, keys: openKeys.map(k => ({ id: k.id, keyMasked: k.keyMasked, lastError: k.lastErrorMessage })) },
        '[ApiKeyPool] ALERT: Keys with open circuit breakers'
      );
    }
  }

  /**
   * 启动定时健康指标输出（每 60 秒）
   */
  startHealthMonitoring(intervalMs: number = 60_000): NodeJS.Timeout {
    return setInterval(() => {
      this.logHealthMetrics();
    }, intervalMs);
  }
}

// ============================================
// 全局单例
// ============================================

let _pool: ApiKeyPoolManager | null = null;
let _healthMonitorInterval: NodeJS.Timeout | null = null;

/**
 * 获取全局 ApiKeyPoolManager 单例
 */
export function getApiKeyPool(): ApiKeyPoolManager {
  if (!_pool) {
    _pool = new ApiKeyPoolManager();
    _pool.initFromEnv();

    // 生产环境自动启动健康监控（每 60 秒输出指标）
    if (process.env.NODE_ENV === 'production' && !_healthMonitorInterval) {
      _healthMonitorInterval = _pool.startHealthMonitoring(60_000);
      logger.info('[ApiKeyPool] Health monitoring started (60s interval)');
    }
  }
  return _pool;
}
