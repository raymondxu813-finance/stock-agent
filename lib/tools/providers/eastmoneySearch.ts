/**
 * EastMoneySearchProvider - 东方财富股票搜索
 *
 * 端点: https://searchapi.eastmoney.com/api/suggest/get
 * 用于将用户输入 (中文名/代码) 解析为标准化的股票信息
 */

import { httpGetJSON, PermanentError } from '../infra/httpClient';
import type { StockInfo } from './types';

interface EMSearchResponse {
  QuotationCodeTable?: {
    Data?: Array<{
      Code: string;       // "002594"
      Name: string;       // "比亚迪"
      MktNum: string;     // "0"=深圳, "1"=上海, "116"=港股, "105"=美股
      QuoteID: string;    // "0.002594"
      SecurityTypeName: string; // "深A", "沪A", "港股", etc.
    }>;
    Status: number;
  };
}

const SEARCH_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8';

export const EastMoneySearchProvider = {
  name: 'EastMoneySearch',

  async execute(input: string): Promise<StockInfo | null> {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(input)}&type=14&token=${SEARCH_TOKEN}`;

    const data = await httpGetJSON<EMSearchResponse>(url);

    const results = data.QuotationCodeTable?.Data;
    if (!results || results.length === 0) {
      return null;
    }

    // 取第一个结果
    const r = results[0];
    return mapToStockInfo(r);
  },
};

function mapToStockInfo(r: {
  Code: string;
  Name: string;
  MktNum: string;
  QuoteID: string;
  SecurityTypeName: string;
}): StockInfo {
  const code = r.Code;
  const name = r.Name;
  const mktNum = r.MktNum;

  switch (mktNum) {
    case '0': // 深圳
      return {
        qqCode: `sz${code}`,
        sinaCode: `sz${code}`,
        code,
        name,
        market: 'A股',
        exchange: 'SZ',
      };

    case '1': // 上海
      return {
        qqCode: `sh${code}`,
        sinaCode: `sh${code}`,
        code,
        name,
        market: 'A股',
        exchange: 'SH',
      };

    case '116': // 港股
      return {
        qqCode: `r_hk${code}`,
        sinaCode: `rt_hk${code}`,
        code,
        name,
        market: '港股',
        exchange: 'HK',
      };

    case '105': // 美股
      return {
        qqCode: `us${code}`,
        sinaCode: `gb_${code.toLowerCase()}`,
        code,
        name,
        market: '美股',
        exchange: 'US',
      };

    default:
      // 默认按 A 股深圳处理
      return {
        qqCode: `sz${code}`,
        sinaCode: `sz${code}`,
        code,
        name,
        market: 'A股',
        exchange: 'SZ',
      };
  }
}
