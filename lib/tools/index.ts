// /lib/tools/index.ts

/**
 * 工具注册中心
 * 
 * 集中导出所有 agent 可用的工具
 * 供 agentExecutor 的 streamText() 使用
 */

import { getStockPrice } from './stockPrice';
import { getLatestNews } from './news';
import { getKlineData } from './kline';

/**
 * 全部股票相关工具集合
 * 直接传给 Vercel AI SDK 的 streamText({ tools: stockTools })
 */
export const stockTools = {
  getStockPrice,
  getLatestNews,
  getKlineData,
};

/**
 * 工具名称到中文描述的映射，用于前端展示工具调用状态
 */
export const toolDisplayNames: Record<string, string> = {
  getStockPrice: '查询实时股价',
  getLatestNews: '获取最新资讯',
  getKlineData: '分析K线数据',
};
