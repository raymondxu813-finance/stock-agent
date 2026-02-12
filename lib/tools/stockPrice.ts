// /lib/tools/stockPrice.ts

/**
 * 实时股票价格查询工具
 * 
 * 目前使用 mock 数据，后续可接入：
 * - 东方财富 API
 * - 新浪财经 API
 * - Tushare
 * - 其他行情数据源
 */

import { tool } from 'ai';
import { z } from 'zod';

export const getStockPrice = tool({
  description: '查询股票或指数的实时价格、涨跌幅、成交量等行情数据。支持A股、港股、美股。',
  inputSchema: z.object({
    symbol: z.string().describe('股票代码或名称，如 "比亚迪"、"600519"、"腾讯"、"AAPL"'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    // TODO: 接入实际股票行情 API
    // 以下为 mock 数据，用于开发和测试
    console.log(`[Tool:getStockPrice] Querying price for: ${symbol}`);

    // 模拟一些常见股票的数据
    const mockData: Record<string, {
      name: string;
      code: string;
      price: number;
      change: string;
      changePercent: string;
      volume: string;
      market: string;
      time: string;
    }> = {
      '比亚迪': {
        name: '比亚迪',
        code: '002594.SZ',
        price: 285.50,
        change: '+6.42',
        changePercent: '+2.30%',
        volume: '12.5亿',
        market: 'A股',
        time: new Date().toLocaleString('zh-CN'),
      },
      '茅台': {
        name: '贵州茅台',
        code: '600519.SH',
        price: 1523.00,
        change: '-12.30',
        changePercent: '-0.80%',
        volume: '8.3亿',
        market: 'A股',
        time: new Date().toLocaleString('zh-CN'),
      },
      '贵州茅台': {
        name: '贵州茅台',
        code: '600519.SH',
        price: 1523.00,
        change: '-12.30',
        changePercent: '-0.80%',
        volume: '8.3亿',
        market: 'A股',
        time: new Date().toLocaleString('zh-CN'),
      },
      '腾讯': {
        name: '腾讯控股',
        code: '0700.HK',
        price: 398.20,
        change: '+5.80',
        changePercent: '+1.48%',
        volume: '15.2亿港元',
        market: '港股',
        time: new Date().toLocaleString('zh-CN'),
      },
      '宁德时代': {
        name: '宁德时代',
        code: '300750.SZ',
        price: 198.60,
        change: '+3.20',
        changePercent: '+1.64%',
        volume: '18.7亿',
        market: 'A股',
        time: new Date().toLocaleString('zh-CN'),
      },
    };

    // 查找匹配的股票（支持模糊匹配）
    const key = Object.keys(mockData).find(k => 
      symbol.includes(k) || k.includes(symbol)
    );

    if (key) {
      return mockData[key];
    }

    // 未匹配到的股票返回通用 mock 数据
    return {
      name: symbol,
      code: 'UNKNOWN',
      price: (Math.random() * 100 + 10).toFixed(2),
      change: (Math.random() > 0.5 ? '+' : '-') + (Math.random() * 5).toFixed(2),
      changePercent: (Math.random() > 0.5 ? '+' : '-') + (Math.random() * 3).toFixed(2) + '%',
      volume: (Math.random() * 20 + 1).toFixed(1) + '亿',
      market: 'A股',
      time: new Date().toLocaleString('zh-CN'),
      note: '当前为模拟数据，实际行情请以交易所数据为准',
    };
  },
});
