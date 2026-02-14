/**
 * HttpClient - 统一 HTTP 请求封装
 *
 * 功能:
 * - 超时控制 (默认 8s)
 * - 自动重试 (1 次，仅对可重试错误)
 * - GBK 解码 (腾讯/新浪接口)
 * - JSONP 解析 (东方财富新闻接口)
 * - 随机 User-Agent 轮换
 * - 全局并发上限 (信号量)
 */

const TIMEOUT_MS = parseInt(process.env.STOCK_API_TIMEOUT || '8000', 10);
const MAX_CONCURRENT = parseInt(process.env.STOCK_MAX_CONCURRENT || '6', 10);

// ─── User-Agent 池 ───
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── 并发信号量 ───
let inFlight = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      inFlight++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  inFlight--;
  const next = waitQueue.shift();
  if (next) next();
}

// ─── 错误分类 ───
export class RetriableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetriableError';
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

function isRetriable(err: unknown): boolean {
  if (err instanceof PermanentError) return false;
  if (err instanceof RetriableError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('socket hang up') ||
      msg.includes('network') ||
      msg.includes('abort')
    );
  }
  return false;
}

// ─── 请求选项 ───
export interface HttpRequestOptions {
  /** 超时 ms */
  timeout?: number;
  /** 自动重试次数, 默认 1 */
  retries?: number;
  /** 额外请求头 */
  headers?: Record<string, string>;
  /** 是否使用 GBK 解码, 默认 false */
  decodeGBK?: boolean;
  /** 是否解析 JSONP 包装, 默认 false */
  parseJSONP?: boolean;
  /** Referer 头 */
  referer?: string;
}

/**
 * 发起 HTTP GET 请求 (文本)
 */
export async function httpGetText(
  url: string,
  options: HttpRequestOptions = {},
): Promise<string> {
  const {
    timeout = TIMEOUT_MS,
    retries = 1,
    headers = {},
    decodeGBK = false,
    referer,
  } = options;

  const reqHeaders: Record<string, string> = {
    'User-Agent': randomUA(),
    Accept: '*/*',
    ...headers,
  };
  if (referer) reqHeaders['Referer'] = referer;

  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      console.log(`[HttpClient] retry #${attempt} for ${new URL(url).hostname}`);
    }

    await acquireSlot();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: reqHeaders,
      });
      clearTimeout(timer);

      if (response.status >= 500) {
        throw new RetriableError(`HTTP ${response.status}`);
      }
      if (response.status >= 400) {
        throw new PermanentError(`HTTP ${response.status}`);
      }

      if (decodeGBK) {
        const buf = await response.arrayBuffer();
        return new TextDecoder('gbk').decode(buf);
      }

      return await response.text();
    } catch (err: unknown) {
      lastErr =
        err instanceof Error ? err : new Error(String(err));

      // AbortError → timeout
      if (lastErr.name === 'AbortError') {
        lastErr = new RetriableError(`Timeout ${timeout}ms`);
      }

      if (!isRetriable(lastErr) || attempt >= retries) {
        throw lastErr;
      }
    } finally {
      releaseSlot();
    }
  }

  throw lastErr ?? new Error('httpGetText failed');
}

/**
 * 发起 HTTP GET 并解析为 JSON
 */
export async function httpGetJSON<T = unknown>(
  url: string,
  options: HttpRequestOptions = {},
): Promise<T> {
  const text = await httpGetText(url, options);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PermanentError(`JSON parse failed for ${new URL(url).hostname}`);
  }
}

/**
 * 发起 HTTP GET 并解析 JSONP 包装
 * 如 `jQuery(...json...)` → 解析内部 JSON
 */
export async function httpGetJSONP<T = unknown>(
  url: string,
  options: HttpRequestOptions = {},
): Promise<T> {
  const text = await httpGetText(url, options);
  // 去掉 JSONP 回调包装: callbackName({...})
  const match = text.match(/^\w+\(([\s\S]+)\)\s*;?\s*$/);
  if (!match) {
    throw new PermanentError(`JSONP parse failed for ${new URL(url).hostname}`);
  }
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    throw new PermanentError(`JSONP inner JSON parse failed for ${new URL(url).hostname}`);
  }
}
