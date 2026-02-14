/**
 * SinaQuoteProvider - 新浪财经实时行情 (备用)
 *
 * 端点: https://hq.sinajs.cn/list={code}
 * 编码: GBK
 * 字段: , 分隔
 * 注意: 2022年起需要 Referer 头
 *
 * A 股字段索引 (共 33 项):
 *   [0]=名称, [1]=开盘, [2]=昨收, [3]=当前价, [4]=最高, [5]=最低
 *   [8]=成交量(股), [9]=成交额(元)
 *   [30]=日期, [31]=时间
 *
 * 港股 (rt_hk 前缀, 字段不同):
 *   [0]=英文名, [1]=中文名, [2]=开盘, [3]=昨收, [4]=最高, [5]=最低
 *   [6]=当前价, [7]=涨跌额, [8]=涨跌幅, [9]=买入, [10]=卖出
 *   [11]=成交额, [12]=成交量
 *   [17]=日期时间
 *
 * 美股 (gb_ 前缀):
 *   [0]=名称, [1]=当前价, [2]=涨跌幅%, [3]=日期时间, [4]=涨跌额
 *   [5]=开盘, [6]=最高, [7]=最低, [8]=52周最高, [9]=52周最低
 *   [10]=成交量, [11]=平均成交量
 */

import { httpGetText, PermanentError } from '../infra/httpClient';
import type { QuoteArgs, QuoteResult } from './types';

const SINA_REFERER = 'https://finance.sina.com.cn';

export const SinaQuoteProvider = {
  name: 'SinaQuote',

  async execute(args: QuoteArgs): Promise<QuoteResult> {
    const { sinaCode, market } = args;
    const url = `https://hq.sinajs.cn/list=${sinaCode}`;

    const text = await httpGetText(url, {
      decodeGBK: true,
      referer: SINA_REFERER,
    });

    const match = text.match(/="(.*)"/);
    if (!match || !match[1]) {
      throw new PermanentError(`SinaQuote: empty response for ${sinaCode}`);
    }

    const raw = match[1];

    // 港股
    if (sinaCode.startsWith('rt_hk')) {
      return parseHK(raw, sinaCode, market);
    }

    // 美股
    if (sinaCode.startsWith('gb_')) {
      return parseUS(raw, sinaCode, market);
    }

    // A 股
    return parseA(raw, sinaCode, market);
  },
};

function parseA(raw: string, code: string, market: string): QuoteResult {
  const f = raw.split(',');
  if (f.length < 32) {
    throw new PermanentError(`SinaQuote: unexpected A-share fields for ${code}`);
  }

  const name = f[0];
  const price = parseFloat(f[3]);
  const prevClose = parseFloat(f[2]);
  const change = price - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const turnover = parseFloat(f[9]); // 成交额(元)

  // 提取纯代码
  const pureCode = code.replace(/^(sz|sh)/, '');

  return {
    name,
    code: pureCode,
    price,
    change: fmt(change),
    changePercent: fmtPct(changePct),
    volume: fmtYuan(turnover),
    market,
    time: `${f[30]} ${f[31]}`,
    high: parseFloat(f[4]) || undefined,
    low: parseFloat(f[5]) || undefined,
    open: parseFloat(f[1]) || undefined,
  };
}

function parseHK(raw: string, code: string, market: string): QuoteResult {
  const f = raw.split(',');
  if (f.length < 13) {
    throw new PermanentError(`SinaQuote: unexpected HK fields for ${code}`);
  }

  const name = f[1]; // 中文名
  const price = parseFloat(f[6]);
  const change = parseFloat(f[7]);
  const changePct = parseFloat(f[8]);
  const turnover = parseFloat(f[11]); // 成交额

  const pureCode = code.replace(/^rt_hk/, '');

  return {
    name,
    code: pureCode,
    price,
    change: fmt(change),
    changePercent: fmtPct(changePct),
    volume: fmtHKD(turnover),
    market,
    time: f[17] || new Date().toLocaleString('zh-CN'),
    high: parseFloat(f[4]) || undefined,
    low: parseFloat(f[5]) || undefined,
    open: parseFloat(f[2]) || undefined,
  };
}

function parseUS(raw: string, code: string, market: string): QuoteResult {
  const f = raw.split(',');
  if (f.length < 12) {
    throw new PermanentError(`SinaQuote: unexpected US fields for ${code}`);
  }

  const name = f[0];
  const price = parseFloat(f[1]);
  const changePct = parseFloat(f[2]);
  const change = parseFloat(f[4]);

  const pureCode = code.replace(/^gb_/, '').toUpperCase();

  return {
    name,
    code: pureCode,
    price,
    change: fmt(change),
    changePercent: fmtPct(changePct),
    volume: '--',
    market,
    time: f[3] || new Date().toLocaleString('zh-CN'),
    high: parseFloat(f[6]) || undefined,
    low: parseFloat(f[7]) || undefined,
    open: parseFloat(f[5]) || undefined,
  };
}

function fmt(v: number): string {
  if (isNaN(v)) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function fmtPct(v: number): string {
  if (isNaN(v)) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtYuan(yuan: number): string {
  if (isNaN(yuan) || yuan <= 0) return '--';
  const yi = yuan / 1_0000_0000;
  if (yi >= 1) return yi.toFixed(1) + '亿';
  return (yuan / 10000).toFixed(0) + '万';
}

function fmtHKD(amount: number): string {
  if (isNaN(amount) || amount <= 0) return '--';
  const yi = amount / 1_0000_0000;
  if (yi >= 1) return yi.toFixed(1) + '亿港元';
  return (amount / 10000).toFixed(0) + '万港元';
}
