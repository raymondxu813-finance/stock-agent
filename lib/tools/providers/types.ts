/**
 * Provider 接口定义
 *
 * 所有数据 Provider 实现统一接口, 便于 ProviderChain 编排。
 */

// ─── 行情数据 ───

export interface QuoteResult {
  name: string;
  code: string;
  price: number;
  change: string;
  changePercent: string;
  volume: string;
  market: string;
  time: string;
  high?: number;
  low?: number;
  open?: number;
}

export interface QuoteArgs {
  /** 腾讯格式代码, 如 "sz002594", "r_hk00700", "usAAPL" */
  qqCode: string;
  /** 新浪格式代码, 如 "sz002594", "rt_hk00700", "gb_aapl" */
  sinaCode: string;
  /** 市场类型 */
  market: string;
}

// ─── 新闻数据 ───

export interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  time: string;
  url?: string;
}

export interface NewsResult {
  query: string;
  count: number;
  articles: NewsArticle[];
}

export interface NewsArgs {
  query: string;
  limit: number;
}

// ─── 股票搜索 ───

export interface StockInfo {
  /** 腾讯格式: "sz002594" | "r_hk00700" | "usAAPL" */
  qqCode: string;
  /** 新浪格式: "sz002594" | "rt_hk00700" | "gb_aapl" */
  sinaCode: string;
  /** 纯代码: "002594" */
  code: string;
  /** 中文名: "比亚迪" */
  name: string;
  /** 市场: "A股" | "港股" | "美股" */
  market: string;
  /** 交易所: "SZ" | "SH" | "HK" | "US" */
  exchange: string;
}
