// /lib/tools/news.ts

/**
 * 实时新闻/资讯获取工具
 * 
 * 目前使用 mock 数据，后续可接入：
 * - 财联社 API
 * - 东方财富资讯
 * - 新浪财经新闻
 * - 其他新闻聚合 API
 */

import { tool } from 'ai';
import { z } from 'zod';

export const getLatestNews = tool({
  description: '获取某只股票、行业或投资话题相关的最新新闻和资讯',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词，如 "比亚迪"、"新能源汽车"、"AI芯片"'),
    limit: z.number().optional().default(3).describe('返回新闻条数，默认3条'),
  }),
  execute: async ({ query, limit }: { query: string; limit: number }) => {
    // TODO: 接入实际新闻 API
    console.log(`[Tool:getLatestNews] Searching news for: ${query}, limit: ${limit}`);

    // 模拟新闻数据
    const mockNewsDB: Record<string, Array<{
      title: string;
      summary: string;
      source: string;
      time: string;
      sentiment: 'positive' | 'negative' | 'neutral';
    }>> = {
      '比亚迪': [
        {
          title: '比亚迪2025年全年销量突破500万辆创历史新高',
          summary: '比亚迪公布2025年全年销量数据，新能源汽车累计销售超过500万辆，同比增长45%，连续三年蝉联全球新能源汽车销量冠军。',
          source: '财联社',
          time: '2小时前',
          sentiment: 'positive',
        },
        {
          title: '比亚迪宣布投资200亿建设第二座刀片电池超级工厂',
          summary: '比亚迪计划在安徽合肥建设新一代刀片电池工厂，预计2027年投产，年产能达100GWh。',
          source: '东方财富',
          time: '5小时前',
          sentiment: 'positive',
        },
        {
          title: '机构观点：比亚迪估值仍有提升空间',
          summary: '多家券商发布研报，维持比亚迪"买入"评级，目标价上调至350元，看好其海外扩张和智能驾驶布局。',
          source: '新浪财经',
          time: '1天前',
          sentiment: 'positive',
        },
      ],
      '新能源': [
        {
          title: '工信部发布新能源汽车产业发展新政策',
          summary: '工信部出台新政策支持新能源汽车产业链发展，包括充电设施建设补贴和购置税减免延续等措施。',
          source: '中国政府网',
          time: '3小时前',
          sentiment: 'positive',
        },
        {
          title: '宁德时代发布新一代固态电池技术路线图',
          summary: '宁德时代宣布其固态电池将在2027年实现量产，能量密度提升50%，成本下降30%。',
          source: '财联社',
          time: '8小时前',
          sentiment: 'positive',
        },
      ],
      'AI': [
        {
          title: 'DeepSeek推出新一代推理模型，性能超越GPT-4o',
          summary: 'DeepSeek发布R2推理模型，在数学、编程和复杂推理任务上全面超越竞品，引发市场对中国AI产业链的关注。',
          source: '36氪',
          time: '1小时前',
          sentiment: 'positive',
        },
        {
          title: '英伟达股价创历史新高，AI芯片需求持续旺盛',
          summary: '受数据中心和AI训练需求推动，英伟达市值突破4万亿美元，成为全球市值最高的科技公司。',
          source: '华尔街日报',
          time: '6小时前',
          sentiment: 'positive',
        },
      ],
    };

    // 查找匹配的新闻
    const key = Object.keys(mockNewsDB).find(k =>
      query.includes(k) || k.includes(query)
    );

    const articles = key
      ? mockNewsDB[key].slice(0, limit)
      : [
          {
            title: `${query}相关：市场关注度持续提升`,
            summary: `近期${query}相关话题受到市场广泛关注，多家机构发布研究报告进行深度分析。`,
            source: '综合资讯',
            time: '今天',
            sentiment: 'neutral' as const,
            note: '当前为模拟数据，实际资讯请以权威来源为准',
          },
        ];

    return {
      query,
      count: articles.length,
      articles,
    };
  },
});
