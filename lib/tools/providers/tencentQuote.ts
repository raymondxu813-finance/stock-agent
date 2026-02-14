/**
 * TencentQuoteProvider - 腾讯财经实时行情
 *
 * 端点: https://qt.gtimg.cn/q={code}
 * 编码: GBK
 * 字段: ~ 分隔
 *
 * A 股 / 港股 (r_hk) / 美股 (us) 字段索引统一:
 *   [1]=名称, [2]=代码, [3]=当前价, [4]=昨收, [5]=开盘
 *   [6]=成交量, [30]=时间, [31]=涨跌额, [32]=涨跌幅%
 *   [33]=最高, [34]=最低, [37]=成交额
 */

import { httpGetText, PermanentError } from '../infra/httpClient';
import type { QuoteArgs, QuoteResult } from './types';

export const TencentQuoteProvider = {
  name: 'TencentQuote',

  async execute(args: QuoteArgs): Promise<QuoteResult> {
    const { qqCode, market } = args;
    const url = `https://qt.gtimg.cn/q=${qqCode}`;

    const text = await httpGetText(url, { decodeGBK: true });

    // 提取引号内内容
    const match = text.match(/="(.*)"/);
    if (!match || !match[1]) {
      throw new PermanentError(`TencentQuote: empty response for ${qqCode}`);
    }

    const fields = match[1].split('~');
    if (fields.length < 35) {
      throw new PermanentError(`TencentQuote: unexpected fields count ${fields.length} for ${qqCode}`);
    }

    // A 股 / 港股 / 美股 / 指数 — 统一字段布局
    return parseQuote(fields, qqCode, market);
  },
};

function parseQuote(f: string[], qqCode: string, market: string): QuoteResult {
  const price = parseFloat(f[3]);
  const change = parseFloat(f[31]);
  const changePct = parseFloat(f[32]);
  const turnover = parseFloat(f[37]); // 成交额

  // 港股成交额单位为港元, A 股成交额单位为万元
  const isHK = qqCode.startsWith('r_hk');
  const volumeStr = isHK
    ? formatHKVolume(turnover)
    : formatVolume(turnover);

  return {
    name: f[1],
    code: f[2],
    price,
    change: formatChange(change),
    changePercent: formatChangePct(changePct),
    volume: volumeStr,
    market,
    time: formatTime(f[30]),
    high: parseFloat(f[33]) || undefined,
    low: parseFloat(f[34]) || undefined,
    open: parseFloat(f[5]) || undefined,
  };
}

// ─── 格式化工具函数 ───

function formatChange(v: number): string {
  if (isNaN(v)) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function formatChangePct(v: number): string {
  if (isNaN(v)) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function formatVolume(wanYuan: number): string {
  if (isNaN(wanYuan) || wanYuan <= 0) return '--';
  if (wanYuan >= 10000) {
    return (wanYuan / 10000).toFixed(1) + '亿';
  }
  return wanYuan.toFixed(0) + '万';
}

function formatHKVolume(amount: number): string {
  if (isNaN(amount) || amount <= 0) return '--';
  const yi = amount / 1_0000_0000;
  if (yi >= 1) return yi.toFixed(1) + '亿港元';
  return (amount / 10000).toFixed(0) + '万港元';
}

function formatTime(raw: string): string {
  if (!raw) return new Date().toLocaleString('zh-CN');
  // 已经是 "2026/02/13 16:08:11" 格式 (港股)
  if (raw.includes('/') || raw.includes('-')) {
    return raw.replace(/\//g, '-');
  }
  // "20260213161415" 格式 (A 股)
  if (raw.length >= 14) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`;
  }
  return raw;
}
