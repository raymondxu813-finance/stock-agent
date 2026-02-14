/**
 * Singleflight - 并发请求合并
 *
 * 相同 key 的并发请求只实际执行一次 fn, 其余等待共享同一个 Promise 的结果。
 *
 * 典型场景:
 *   12 个 agent 同时调用 getStockPrice("比亚迪"),
 *   只会发出 1 次 API 请求, 其余 11 个 agent 共享结果。
 */

export class Singleflight {
  private readonly flights = new Map<string, Promise<unknown>>();

  /**
   * 如果 key 已有 in-flight 请求, 直接复用其 Promise。
   * 否则发起新请求, 完成后自动清除 flight。
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.flights.get(key);
    if (existing) {
      console.log(`[Singleflight] JOINED key=${key} (waiting for in-flight request)`);
      return existing as Promise<T>;
    }

    const flight = fn().finally(() => {
      this.flights.delete(key);
    });

    this.flights.set(key, flight);
    return flight;
  }

  /** 当前 in-flight 请求数 */
  get pendingCount(): number {
    return this.flights.size;
  }
}
