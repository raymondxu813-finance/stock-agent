// /lib/tools/stockPrice.ts

/**
 * 实时股票价格查询工具
 *
 * 数据源 (failover 链):
 *   1. 腾讯行情 (qt.gtimg.cn) — 主源, A/港/美
 *   2. 新浪行情 (hq.sinajs.cn) — 备源, A/港/美
 *
 * 基础设施:
 *   - Singleflight 并发合并 (12 agent 查同一股票 = 1 次 API 调用)
 *   - SWR 缓存 (fresh 30s + stale 120s)
 *   - 熔断器 + 令牌桶限流
 */

import { tool } from 'ai';
import { z } from 'zod';
import { ProviderChain } from './infra/providerChain';
import { CircuitBreaker } from './infra/circuitBreaker';
import { RateLimiter } from './infra/rateLimiter';
import { TencentQuoteProvider } from './providers/tencentQuote';
import { SinaQuoteProvider } from './providers/sinaQuote';
import { resolveStock } from './utils/stockResolver';
import type { QuoteArgs, QuoteResult } from './providers/types';

// ─── 构建 ProviderChain (模块级单例) ───

const CACHE_FRESH = parseInt(process.env.STOCK_CACHE_TTL_QUOTE || '30', 10) * 1000;
const CACHE_STALE = parseInt(process.env.STOCK_CACHE_STALE_QUOTE || '120', 10) * 1000;

const quoteChain = new ProviderChain<QuoteArgs, QuoteResult>({
  name: 'quote',
  cacheOptions: {
    freshMs: CACHE_FRESH,
    staleMs: CACHE_FRESH + CACHE_STALE,
  },
  cacheKeyFn: (args) => `price:${args.qqCode}`,
});

quoteChain
  .addProvider(
    TencentQuoteProvider,
    new CircuitBreaker('TencentQuote'),
    new RateLimiter('TencentQuote', { tokensPerMinute: 25, burstSize: 3 }),
  )
  .addProvider(
    SinaQuoteProvider,
    new CircuitBreaker('SinaQuote'),
    new RateLimiter('SinaQuote', { tokensPerMinute: 20, burstSize: 3 }),
  );

// ─── Vercel AI SDK tool 定义 ───

export const getStockPrice = tool({
  description: '查询股票或指数的实时价格、涨跌幅、成交量等行情数据。支持A股、港股、美股。',
  inputSchema: z.object({
    symbol: z.string().describe('股票代码或名称，如 "比亚迪"、"600519"、"腾讯"、"AAPL"'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    console.log(`[Tool:getStockPrice] Querying price for: ${symbol}`);

    try {
      // 1. 解析股票代码
      const stockInfo = await resolveStock(symbol);
      if (!stockInfo) {
        return {
          error: `未找到匹配的股票: "${symbol}"`,
          symbol,
        };
      }

      // 2. 通过 ProviderChain 获取行情
      const result = await quoteChain.execute({
        qqCode: stockInfo.qqCode,
        sinaCode: stockInfo.sinaCode,
        market: stockInfo.market,
      });

      // 用解析到的名称补充 (API 返回的名称可能是编码问题)
      if (stockInfo.name && stockInfo.name !== stockInfo.code) {
        result.name = result.name || stockInfo.name;
      }

      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Tool:getStockPrice] Error for "${symbol}":`, errMsg);
      return {
        error: `行情获取失败: ${errMsg}`,
        symbol,
      };
    }
  },
});
