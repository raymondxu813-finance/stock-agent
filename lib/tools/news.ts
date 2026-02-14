// /lib/tools/news.ts

/**
 * 实时新闻/资讯获取工具
 *
 * 数据源:
 *   东方财富新闻搜索 (search-api-web.eastmoney.com)
 *
 * 基础设施:
 *   - Singleflight 并发合并
 *   - SWR 缓存 (fresh 5min + stale 30min)
 *   - 熔断器 + 令牌桶限流
 */

import { tool } from 'ai';
import { z } from 'zod';
import { ProviderChain } from './infra/providerChain';
import { CircuitBreaker } from './infra/circuitBreaker';
import { RateLimiter } from './infra/rateLimiter';
import { EastMoneyNewsProvider } from './providers/eastmoneyNews';
import type { NewsArgs, NewsResult } from './providers/types';

// ─── 构建 ProviderChain (模块级单例) ───

const CACHE_FRESH = parseInt(process.env.STOCK_CACHE_TTL_NEWS || '300', 10) * 1000;
const CACHE_STALE = parseInt(process.env.STOCK_CACHE_STALE_NEWS || '1800', 10) * 1000;

const newsChain = new ProviderChain<NewsArgs, NewsResult>({
  name: 'news',
  cacheOptions: {
    freshMs: CACHE_FRESH,
    staleMs: CACHE_FRESH + CACHE_STALE,
  },
  cacheKeyFn: (args) => `news:${args.query}:${args.limit}`,
});

newsChain.addProvider(
  EastMoneyNewsProvider,
  new CircuitBreaker('EastMoneyNews'),
  new RateLimiter('EastMoneyNews', { tokensPerMinute: 40, burstSize: 5 }),
);

// ─── Vercel AI SDK tool 定义 ───

export const getLatestNews = tool({
  description: '获取某只股票、行业或投资话题相关的最新新闻和资讯',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词，如 "比亚迪"、"新能源汽车"、"AI芯片"'),
    limit: z.number().optional().default(3).describe('返回新闻条数，默认3条'),
  }),
  execute: async ({ query, limit }: { query: string; limit: number }) => {
    console.log(`[Tool:getLatestNews] Searching news for: ${query}, limit: ${limit}`);

    try {
      const result = await newsChain.execute({ query, limit });
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Tool:getLatestNews] Error for "${query}":`, errMsg);
      return {
        error: `新闻获取失败: ${errMsg}`,
        query,
        count: 0,
        articles: [],
      };
    }
  },
});
