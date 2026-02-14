/**
 * StockResolver - 股票名称/代码解析器
 *
 * 解析优先级:
 *   1. 本地热门股映射表 (~80只, 0网络开销)
 *   2. 格式检测 (纯数字/带后缀/英文代码 → 直接构造)
 *   3. 东方财富搜索 API (有熔断+限流+缓存保护)
 *
 * 结果缓存 24h, Singleflight 去重。
 */

import { TTLCache } from '../infra/cache';
import { Singleflight } from '../infra/singleflight';
import { CircuitBreaker } from '../infra/circuitBreaker';
import { RateLimiter } from '../infra/rateLimiter';
import { EastMoneySearchProvider } from '../providers/eastmoneySearch';
import type { StockInfo } from '../providers/types';

// ─── 缓存: 24h fresh, 7d stale ───
const cache = new TTLCache<StockInfo>('resolver', {
  freshMs: 24 * 60 * 60_000,
  staleMs: 7 * 24 * 60 * 60_000,
  maxSize: 500,
});

const singleflight = new Singleflight();

// 东方财富搜索 Provider 的熔断/限流
const searchCB = new CircuitBreaker('EastMoneySearch', {
  failureThreshold: 3,
  cooldownMs: 60_000,
});
const searchRL = new RateLimiter('EastMoneySearch', {
  tokensPerMinute: 40,
  burstSize: 5,
});

// ─── 热门股映射表 ───
const HOT_STOCKS: Record<string, StockInfo> = {};

function addHot(
  keywords: string[],
  info: StockInfo,
): void {
  for (const kw of keywords) {
    HOT_STOCKS[kw.toLowerCase()] = info;
  }
}

// A股热门
addHot(['比亚迪', 'byd', '002594'], { qqCode: 'sz002594', sinaCode: 'sz002594', code: '002594', name: '比亚迪', market: 'A股', exchange: 'SZ' });
addHot(['贵州茅台', '茅台', '600519'], { qqCode: 'sh600519', sinaCode: 'sh600519', code: '600519', name: '贵州茅台', market: 'A股', exchange: 'SH' });
addHot(['宁德时代', '300750'], { qqCode: 'sz300750', sinaCode: 'sz300750', code: '300750', name: '宁德时代', market: 'A股', exchange: 'SZ' });
addHot(['中国平安', '平安', '601318'], { qqCode: 'sh601318', sinaCode: 'sh601318', code: '601318', name: '中国平安', market: 'A股', exchange: 'SH' });
addHot(['招商银行', '招行', '600036'], { qqCode: 'sh600036', sinaCode: 'sh600036', code: '600036', name: '招商银行', market: 'A股', exchange: 'SH' });
addHot(['万科', '万科A', '000002'], { qqCode: 'sz000002', sinaCode: 'sz000002', code: '000002', name: '万科A', market: 'A股', exchange: 'SZ' });
addHot(['中芯国际', '688981'], { qqCode: 'sh688981', sinaCode: 'sh688981', code: '688981', name: '中芯国际', market: 'A股', exchange: 'SH' });
addHot(['隆基绿能', '隆基', '601012'], { qqCode: 'sh601012', sinaCode: 'sh601012', code: '601012', name: '隆基绿能', market: 'A股', exchange: 'SH' });
addHot(['中国中免', '中免', '601888'], { qqCode: 'sh601888', sinaCode: 'sh601888', code: '601888', name: '中国中免', market: 'A股', exchange: 'SH' });
addHot(['药明康德', '603259'], { qqCode: 'sh603259', sinaCode: 'sh603259', code: '603259', name: '药明康德', market: 'A股', exchange: 'SH' });
addHot(['海天味业', '海天', '603288'], { qqCode: 'sh603288', sinaCode: 'sh603288', code: '603288', name: '海天味业', market: 'A股', exchange: 'SH' });
addHot(['五粮液', '000858'], { qqCode: 'sz000858', sinaCode: 'sz000858', code: '000858', name: '五粮液', market: 'A股', exchange: 'SZ' });
addHot(['立讯精密', '立讯', '002475'], { qqCode: 'sz002475', sinaCode: 'sz002475', code: '002475', name: '立讯精密', market: 'A股', exchange: 'SZ' });
addHot(['紫金矿业', '紫金', '601899'], { qqCode: 'sh601899', sinaCode: 'sh601899', code: '601899', name: '紫金矿业', market: 'A股', exchange: 'SH' });
addHot(['工商银行', '601398'], { qqCode: 'sh601398', sinaCode: 'sh601398', code: '601398', name: '工商银行', market: 'A股', exchange: 'SH' });
addHot(['美的集团', '美的', '000333'], { qqCode: 'sz000333', sinaCode: 'sz000333', code: '000333', name: '美的集团', market: 'A股', exchange: 'SZ' });
addHot(['中国神华', '神华', '601088'], { qqCode: 'sh601088', sinaCode: 'sh601088', code: '601088', name: '中国神华', market: 'A股', exchange: 'SH' });
addHot(['长江电力', '600900'], { qqCode: 'sh600900', sinaCode: 'sh600900', code: '600900', name: '长江电力', market: 'A股', exchange: 'SH' });
addHot(['迈瑞医疗', '迈瑞', '300760'], { qqCode: 'sz300760', sinaCode: 'sz300760', code: '300760', name: '迈瑞医疗', market: 'A股', exchange: 'SZ' });
addHot(['恒瑞医药', '恒瑞', '600276'], { qqCode: 'sh600276', sinaCode: 'sh600276', code: '600276', name: '恒瑞医药', market: 'A股', exchange: 'SH' });

// 港股热门
addHot(['腾讯', '腾讯控股', '00700'], { qqCode: 'r_hk00700', sinaCode: 'rt_hk00700', code: '00700', name: '腾讯控股', market: '港股', exchange: 'HK' });
addHot(['阿里巴巴', '阿里', '09988'], { qqCode: 'r_hk09988', sinaCode: 'rt_hk09988', code: '09988', name: '阿里巴巴-SW', market: '港股', exchange: 'HK' });
addHot(['美团', '03690'], { qqCode: 'r_hk03690', sinaCode: 'rt_hk03690', code: '03690', name: '美团-W', market: '港股', exchange: 'HK' });
addHot(['小米', '小米集团', '01810'], { qqCode: 'r_hk01810', sinaCode: 'rt_hk01810', code: '01810', name: '小米集团-W', market: '港股', exchange: 'HK' });
addHot(['京东', '09618'], { qqCode: 'r_hk09618', sinaCode: 'rt_hk09618', code: '09618', name: '京东集团-SW', market: '港股', exchange: 'HK' });
addHot(['网易', '09999'], { qqCode: 'r_hk09999', sinaCode: 'rt_hk09999', code: '09999', name: '网易-S', market: '港股', exchange: 'HK' });
addHot(['百度', '09888'], { qqCode: 'r_hk09888', sinaCode: 'rt_hk09888', code: '09888', name: '百度集团-SW', market: '港股', exchange: 'HK' });
addHot(['中国移动', '00941'], { qqCode: 'r_hk00941', sinaCode: 'rt_hk00941', code: '00941', name: '中国移动', market: '港股', exchange: 'HK' });
addHot(['汇丰控股', '汇丰', '00005'], { qqCode: 'r_hk00005', sinaCode: 'rt_hk00005', code: '00005', name: '汇丰控股', market: '港股', exchange: 'HK' });

// 美股热门
addHot(['苹果', 'apple', 'aapl'], { qqCode: 'usAAPL', sinaCode: 'gb_aapl', code: 'AAPL', name: '苹果', market: '美股', exchange: 'US' });
addHot(['英伟达', 'nvidia', 'nvda'], { qqCode: 'usNVDA', sinaCode: 'gb_nvda', code: 'NVDA', name: '英伟达', market: '美股', exchange: 'US' });
addHot(['特斯拉', 'tesla', 'tsla'], { qqCode: 'usTSLA', sinaCode: 'gb_tsla', code: 'TSLA', name: '特斯拉', market: '美股', exchange: 'US' });
addHot(['微软', 'microsoft', 'msft'], { qqCode: 'usMSFT', sinaCode: 'gb_msft', code: 'MSFT', name: '微软', market: '美股', exchange: 'US' });
addHot(['谷歌', 'google', 'googl'], { qqCode: 'usGOOGL', sinaCode: 'gb_googl', code: 'GOOGL', name: '谷歌', market: '美股', exchange: 'US' });
addHot(['亚马逊', 'amazon', 'amzn'], { qqCode: 'usAMZN', sinaCode: 'gb_amzn', code: 'AMZN', name: '亚马逊', market: '美股', exchange: 'US' });
addHot(['meta', 'facebook', 'meta'], { qqCode: 'usMETA', sinaCode: 'gb_meta', code: 'META', name: 'Meta', market: '美股', exchange: 'US' });
addHot(['台积电', 'tsmc', 'tsm'], { qqCode: 'usTSM', sinaCode: 'gb_tsm', code: 'TSM', name: '台积电', market: '美股', exchange: 'US' });

// 指数
addHot(['上证指数', '上证', '000001'], { qqCode: 'sh000001', sinaCode: 'sh000001', code: '000001', name: '上证指数', market: '指数', exchange: 'SH' });
addHot(['深证成指', '深成指', '399001'], { qqCode: 'sz399001', sinaCode: 'sz399001', code: '399001', name: '深证成指', market: '指数', exchange: 'SZ' });
addHot(['创业板指', '创业板', '399006'], { qqCode: 'sz399006', sinaCode: 'sz399006', code: '399006', name: '创业板指', market: '指数', exchange: 'SZ' });

// ─── 格式检测 ───

/**
 * 纯 A 股代码 (6位数字): 自动判断沪/深
 */
function detectAShareCode(code: string): StockInfo | null {
  if (!/^\d{6}$/.test(code)) return null;

  // 6/9 开头 → 上海, 0/3 开头 → 深圳
  const isShanghai = code.startsWith('6') || code.startsWith('9');
  const prefix = isShanghai ? 'sh' : 'sz';
  const exchange = isShanghai ? 'SH' : 'SZ';

  return {
    qqCode: `${prefix}${code}`,
    sinaCode: `${prefix}${code}`,
    code,
    name: code,
    market: 'A股',
    exchange,
  };
}

/**
 * 带后缀的代码: "600519.SH", "002594.SZ", "0700.HK", "AAPL.US"
 */
function detectSuffixedCode(input: string): StockInfo | null {
  const match = input.match(/^(\w+)\.(SH|SZ|HK|US)$/i);
  if (!match) return null;

  const code = match[1];
  const ex = match[2].toUpperCase();

  switch (ex) {
    case 'SH':
      return { qqCode: `sh${code}`, sinaCode: `sh${code}`, code, name: code, market: 'A股', exchange: 'SH' };
    case 'SZ':
      return { qqCode: `sz${code}`, sinaCode: `sz${code}`, code, name: code, market: 'A股', exchange: 'SZ' };
    case 'HK':
      return { qqCode: `r_hk${code}`, sinaCode: `rt_hk${code}`, code, name: code, market: '港股', exchange: 'HK' };
    case 'US':
      return { qqCode: `us${code}`, sinaCode: `gb_${code.toLowerCase()}`, code, name: code, market: '美股', exchange: 'US' };
    default:
      return null;
  }
}

/**
 * 全英文大写字母 (1-5位): 视为美股代码
 */
function detectUSCode(input: string): StockInfo | null {
  if (!/^[A-Z]{1,5}$/.test(input)) return null;
  return {
    qqCode: `us${input}`,
    sinaCode: `gb_${input.toLowerCase()}`,
    code: input,
    name: input,
    market: '美股',
    exchange: 'US',
  };
}

// ─── 主解析函数 ───

export async function resolveStock(symbol: string): Promise<StockInfo | null> {
  const trimmed = symbol.trim();
  if (!trimmed) return null;

  const cacheKey = `resolve:${trimmed.toLowerCase()}`;

  // 1. 检查缓存
  const cached = cache.get(cacheKey);
  if (cached.hit !== 'miss' && cached.value) {
    return cached.value;
  }

  // 2. 本地热门股映射
  const hotKey = trimmed.toLowerCase();
  const hot = HOT_STOCKS[hotKey];
  if (hot) {
    cache.set(cacheKey, hot);
    return hot;
  }

  // 3. 格式检测
  const suffixed = detectSuffixedCode(trimmed);
  if (suffixed) {
    cache.set(cacheKey, suffixed);
    return suffixed;
  }

  const aShare = detectAShareCode(trimmed);
  if (aShare) {
    cache.set(cacheKey, aShare);
    return aShare;
  }

  const usCode = detectUSCode(trimmed.toUpperCase());
  if (usCode) {
    cache.set(cacheKey, usCode);
    return usCode;
  }

  // 4. 东方财富远程搜索 (有熔断 + 限流 + singleflight)
  return singleflight.execute(cacheKey, async () => {
    // 再检查一次缓存
    const rechecked = cache.get(cacheKey);
    if (rechecked.hit !== 'miss' && rechecked.value) {
      return rechecked.value;
    }

    try {
      searchRL.acquire();
      const result = await searchCB.execute(() =>
        EastMoneySearchProvider.execute(trimmed),
      );

      if (result) {
        cache.set(cacheKey, result);
        console.log(`[StockResolver] resolved "${trimmed}" -> ${result.name} (${result.code}) via EastMoneySearch`);
      } else {
        console.log(`[StockResolver] no match for "${trimmed}" from EastMoneySearch`);
      }

      return result;
    } catch (err) {
      console.error(`[StockResolver] search failed for "${trimmed}":`, err instanceof Error ? err.message : err);
      return null;
    }
  });
}
