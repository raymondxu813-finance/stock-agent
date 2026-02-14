/**
 * EastMoneyNewsProvider - 东方财富新闻搜索
 *
 * 端点: https://search-api-web.eastmoney.com/search/jsonp
 * 格式: JSONP (jQuery(...))
 */

import { httpGetJSONP, PermanentError } from '../infra/httpClient';
import type { NewsArgs, NewsResult } from './types';

interface EMNewsResponse {
  code: number;
  msg: string;
  result?: {
    cmsArticleWebOld?: Array<{
      title: string;
      content: string;
      mediaName: string;
      date: string;
      url: string;
    }>;
  };
}

export const EastMoneyNewsProvider = {
  name: 'EastMoneyNews',

  async execute(args: NewsArgs): Promise<NewsResult> {
    const { query, limit } = args;

    const param = JSON.stringify({
      uid: '',
      keyword: query,
      type: ['cmsArticleWebOld'],
      pageIndex: 1,
      pageSize: Math.min(limit, 10),
    });

    const url = `https://search-api-web.eastmoney.com/search/jsonp?cb=jQuery&param=${encodeURIComponent(param)}`;

    const data = await httpGetJSONP<EMNewsResponse>(url);

    if (data.code !== 0 || !data.result?.cmsArticleWebOld) {
      throw new PermanentError(
        `EastMoneyNews: unexpected response code=${data.code}, msg=${data.msg}`,
      );
    }

    const articles = data.result.cmsArticleWebOld.slice(0, limit).map((a) => ({
      title: stripHTML(a.title),
      summary: stripHTML(a.content).slice(0, 200),
      source: a.mediaName || '东方财富',
      time: formatTime(a.date),
      url: a.url || undefined,
    }));

    return {
      query,
      count: articles.length,
      articles,
    };
  },
};

/**
 * 去除 HTML 标签 (如 <em>...</em>)
 */
function stripHTML(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * 格式化时间: "2026-02-13 15:12:40" → "2026-02-13 15:12"
 */
function formatTime(raw: string): string {
  if (!raw) return '';
  // 截取到分钟
  return raw.slice(0, 16);
}
