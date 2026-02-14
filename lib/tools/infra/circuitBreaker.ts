/**
 * CircuitBreaker - 轻量级三态熔断器
 *
 * 状态转换:
 *   CLOSED  ──连续 N 次失败──▶  OPEN  ──cooldown──▶  HALF_OPEN
 *   HALF_OPEN ──探测成功──▶ CLOSED
 *   HALF_OPEN ──探测失败──▶ OPEN
 *
 * 每个 Provider 独立一个 CircuitBreaker 实例。
 */

export type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** 连续失败多少次触发熔断, 默认 3 */
  failureThreshold?: number;
  /** OPEN 状态持续多久后进入 HALF_OPEN (ms), 默认 30000 */
  cooldownMs?: number;
  /** 健康度评分滑动窗口大小, 默认 20 */
  windowSize?: number;
}

export class CircuitBreakerError extends Error {
  constructor(name: string) {
    super(`CircuitBreaker [${name}] is OPEN — request rejected`);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  readonly providerName: string;
  private state: CBState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  // ── 健康度评分 ──
  private readonly windowSize: number;
  private readonly history: Array<{ ok: boolean; latencyMs: number }> = [];

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.providerName = name;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.windowSize = options.windowSize ?? 20;
  }

  get currentState(): CBState {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
      console.log(`[CircuitBreaker:${this.providerName}] state OPEN -> HALF_OPEN (cooldown ${this.cooldownMs}ms elapsed)`);
    }
    return this.state;
  }

  /**
   * 健康度评分 0~1
   * = successRate * (1 - avgLatency / 10000)
   */
  get healthScore(): number {
    if (this.history.length === 0) return 1;
    const successes = this.history.filter((h) => h.ok).length;
    const successRate = successes / this.history.length;
    const avgLatency =
      this.history.reduce((sum, h) => sum + h.latencyMs, 0) / this.history.length;
    return Math.max(0, successRate * (1 - avgLatency / 10_000));
  }

  /**
   * 包装执行: 检查熔断状态 → 执行 fn → 记录结果
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.currentState;

    if (state === 'OPEN') {
      throw new CircuitBreakerError(this.providerName);
    }

    const start = Date.now();
    try {
      const result = await fn();
      this.onSuccess(Date.now() - start);
      return result;
    } catch (err) {
      this.onFailure(Date.now() - start);
      throw err;
    }
  }

  private onSuccess(latencyMs: number): void {
    this.consecutiveFailures = 0;
    this.record(true, latencyMs);

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`[CircuitBreaker:${this.providerName}] state HALF_OPEN -> CLOSED (probe succeeded)`);
    }
  }

  private onFailure(latencyMs: number): void {
    this.consecutiveFailures++;
    this.record(false, latencyMs);

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      console.log(`[CircuitBreaker:${this.providerName}] state HALF_OPEN -> OPEN (probe failed)`);
      return;
    }

    if (
      this.state === 'CLOSED' &&
      this.consecutiveFailures >= this.failureThreshold
    ) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      console.log(
        `[CircuitBreaker:${this.providerName}] state CLOSED -> OPEN (${this.consecutiveFailures} consecutive failures)`,
      );
    }
  }

  private record(ok: boolean, latencyMs: number): void {
    this.history.push({ ok, latencyMs });
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
  }
}
