'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, PenSquare, ChevronDown, ChevronRight, ArrowDown, ArrowRight, ArrowLeft, X, FileText, SendHorizontal, Square, Play, Check, AlertCircle, Lightbulb, Share2, Download, CheckCheck, Keyboard } from 'lucide-react';
import type { Discussion, AgentComment, RoundData, StockSentiment, SentimentSummaryItem, Agent, AvatarType, ToolCallRecord, TopicComparisonItem, HighlightInsight } from '@/types';
import { toolDisplayNames } from '@/lib/toolDisplayNames';
import { parseModeratorSections, parseEnhancedConsensusSection, parseEnhancedDisagreementsSection, parseLegacyConsensusSection, parseLegacyDisagreementsSection, parseSentimentSummarySection } from '@/lib/utils';
import { toPng, toBlob } from 'html-to-image';
import { HistoryTopicsDrawer } from './HistoryTopicsDrawer';
import { AgentAvatar } from './AgentAvatar';
import { useTheme } from '@/lib/ThemeContext';
import { getApiUrl } from '@/lib/apiConfig';

// 根据 agent 信息获取头像类型
const getAvatarType = (agent: Agent): AvatarType => {
  if (agent.avatarType) return agent.avatarType;
  // Fallback: 根据 agent id 映射
  if (agent.id.includes('macro_economist')) return 'rocket';
  if (agent.id.includes('finance_expert')) return 'safe';
  if (agent.id.includes('senior_stock')) return 'lightning';
  if (agent.id.includes('veteran_stock')) return 'rings';
  if (agent.id.includes('policy_analyst')) return 'compass';
  if (agent.id.includes('etf_auntie')) return 'piggybank';
  if (agent.id.includes('cross_border')) return 'globe';
  if (agent.id.includes('institutional')) return 'shield';
  if (agent.id.includes('finance_kol')) return 'megaphone';
  if (agent.id.includes('risk_controller')) return 'radar';
  if (agent.id.includes('industry_researcher')) return 'microscope';
  if (agent.id.includes('cycle_theorist')) return 'hourglass';
  if (agent.id.includes('crystal') || agent.id.includes('analyst')) return 'crystal';
  return 'sphere';
};

// 根据 agentId 从 agents 数组查找并获取头像类型
const getAvatarTypeById = (agentId: string, agents: Agent[]): AvatarType => {
  const agent = agents.find(a => a.id === agentId);
  if (agent) return getAvatarType(agent);
  return 'sphere';
};

// === 标的名称归一化工具 ===
// 将各种写法（AAPL、苹果、苹果公司、苹果(AAPL)）统一识别为同一标的

/** 提取标的名的"核心key"，用于分组比较 */
const extractStockCoreKey = (name: string): string => {
  // 去掉括号内容：苹果(AAPL) → 苹果
  let key = name.replace(/[（(][^）)]*[）)]/g, '').trim();
  // 去掉常见后缀：苹果公司 → 苹果
  key = key.replace(/(公司|集团|控股|股份有限|有限|股份)$/g, '').trim();
  return key || name;
};

/** 判断两个标的名是否指向同一实体 */
const isSameStock = (a: string, b: string): boolean => {
  if (a === b) return true;
  const coreA = extractStockCoreKey(a);
  const coreB = extractStockCoreKey(b);
  if (coreA === coreB) return true;
  // 包含关系：苹果 ⊂ 苹果公司
  if (coreA.includes(coreB) || coreB.includes(coreA)) return true;
  // 提取纯中文字符比较
  const cnA = coreA.replace(/[A-Za-z0-9.\s\-]/g, '');
  const cnB = coreB.replace(/[A-Za-z0-9.\s\-]/g, '');
  if (cnA && cnB && (cnA === cnB || cnA.includes(cnB) || cnB.includes(cnA))) return true;
  // 检查括号中的ticker是否匹配另一个纯英文名
  const tickerA = a.match(/[（(]([A-Za-z0-9.]+)[）)]/)?.[1]?.toUpperCase();
  const tickerB = b.match(/[（(]([A-Za-z0-9.]+)[）)]/)?.[1]?.toUpperCase();
  const isEnglishOnly = (s: string) => /^[A-Za-z0-9.\-]+$/.test(s.trim());
  if (tickerA && isEnglishOnly(b) && tickerA === b.trim().toUpperCase()) return true;
  if (tickerB && isEnglishOnly(a) && tickerB === a.trim().toUpperCase()) return true;
  // 纯英文名与括号ticker比较：a="AAPL", b="苹果(AAPL)"
  if (isEnglishOnly(a) && tickerB && a.trim().toUpperCase() === tickerB) return true;
  if (isEnglishOnly(b) && tickerA && b.trim().toUpperCase() === tickerA) return true;
  return false;
};

/** 从一组同义标的名中选出最佳展示名，格式优先 "中文简称(代码)" */
const pickCanonicalStockName = (names: string[]): string => {
  // 1. 优先选已经是 "中文(代码)" 格式的
  const withTicker = names.filter(n => /[\u4e00-\u9fff]/.test(n) && /[（(][A-Za-z0-9.]+[）)]/.test(n));
  if (withTicker.length > 0) {
    // 选中文部分最短的
    return withTicker.sort((a, b) => extractStockCoreKey(a).length - extractStockCoreKey(b).length)[0];
  }
  // 2. 有中文名 + 有纯英文ticker → 组合成 "中文(代码)"
  const chineseNames = names.filter(n => /[\u4e00-\u9fff]/.test(n));
  const englishTickers = names.filter(n => /^[A-Za-z0-9.\-]+$/.test(n.trim()));
  if (chineseNames.length > 0 && englishTickers.length > 0) {
    const shortCn = chineseNames.sort((a, b) => extractStockCoreKey(a).length - extractStockCoreKey(b).length)[0];
    return `${extractStockCoreKey(shortCn)}(${englishTickers[0].trim().toUpperCase()})`;
  }
  // 3. 只有中文名 → 用最短的中文核心名
  if (chineseNames.length > 0) {
    return extractStockCoreKey(chineseNames.sort((a, b) => extractStockCoreKey(a).length - extractStockCoreKey(b).length)[0]);
  }
  // 4. 只有英文 → 原样返回
  return names.sort((a, b) => a.length - b.length)[0];
};

// 从 agent 发言中的 sentiments 汇总构建情绪（当 LLM 未生成 sentimentSummary 时用作 fallback）
const buildSentimentSummaryFromAgentData = (
  agentSentiments: Array<{ agentName: string; sentiments?: StockSentiment[] }>
): SentimentSummaryItem[] => {
  // 使用分组归一化：维护一组"标的簇"
  type StockGroup = { names: string[]; bullish: string[]; bearish: string[]; neutral: string[] };
  const groups: StockGroup[] = [];

  const findGroup = (stockName: string): StockGroup | undefined =>
    groups.find(g => g.names.some(n => isSameStock(n, stockName)));

  for (const { agentName, sentiments } of agentSentiments) {
    if (!sentiments || sentiments.length === 0) continue;
    for (const s of sentiments) {
      const stock = s.stock?.trim();
      if (!stock) continue;
      let group = findGroup(stock);
      if (!group) {
        group = { names: [stock], bullish: [], bearish: [], neutral: [] };
        groups.push(group);
      } else if (!group.names.includes(stock)) {
        group.names.push(stock);
      }
      // 每个 agent 对同一标的只计一次
      if (!group.bullish.includes(agentName) && !group.bearish.includes(agentName) && !group.neutral.includes(agentName)) {
        if (s.sentiment === 'bullish') group.bullish.push(agentName);
        else if (s.sentiment === 'bearish') group.bearish.push(agentName);
        else group.neutral.push(agentName);
      }
    }
  }

  if (groups.length === 0) return [];
  const result: SentimentSummaryItem[] = [];
  for (const group of groups) {
    const canonicalName = pickCanonicalStockName(group.names);
    let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (group.bullish.length > group.bearish.length) overallSentiment = 'bullish';
    else if (group.bearish.length > group.bullish.length) overallSentiment = 'bearish';
    result.push({
      stock: canonicalName,
      bullishAgents: group.bullish,
      bearishAgents: group.bearish,
      neutralAgents: group.neutral,
      overallSentiment,
    });
  }
  return result;
};

// 工具调用去重（按 toolName 只保留第一次）
const dedupToolCalls = (calls?: ToolCallRecord[]): ToolCallRecord[] | undefined => {
  if (!calls || calls.length === 0) return undefined;
  const seen = new Set<string>();
  return calls.filter(tc => {
    if (seen.has(tc.toolName)) return false;
    seen.add(tc.toolName);
    return true;
  });
};

// Figma 统一气泡背景色
const BUBBLE_BG = 'bg-surface-bubble';

// ===== SVG 图标组件 =====

/** 看涨图标 — 向上折线箭头 */
const BullishIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M2 12L6 7L9 9.5L14 4" stroke="#E05454" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 4H14V8" stroke="#E05454" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 看跌图标 — 向下折线箭头 */
const BearishIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M2 4L6 9L9 6.5L14 12" stroke="#2EA66E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 12H14V8" stroke="#2EA66E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 中性图标 — 水平横线 */
const NeutralIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M2 8H14" stroke="#999999" strokeWidth="2" strokeLinecap="round" />
    <path d="M2 5H8" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    <path d="M8 11H14" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
  </svg>
);

/** 多空分歧图标 — 交叉箭头 */
const DividedIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M3 11L8 6L13 11" stroke="#E05454" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    <path d="M3 5L8 10L13 5" stroke="#2EA66E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
  </svg>
);

/** 工具图标 — 查询实时股价 (折线图) */
const ToolStockPriceIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect x="1" y="1" width="18" height="18" rx="5" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="0.5" />
    <path d="M4 14L8 9L11 11.5L16 6" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8" cy="9" r="1" fill="#F97316" />
    <circle cx="11" cy="11.5" r="1" fill="#F97316" />
    <circle cx="16" cy="6" r="1" fill="#F97316" />
  </svg>
);

/** 工具图标 — 获取最新资讯 (新闻/文档) */
const ToolNewsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect x="1" y="1" width="18" height="18" rx="5" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="0.5" />
    <rect x="5" y="5" width="10" height="2" rx="1" fill="#3B82F6" opacity="0.7" />
    <rect x="5" y="9" width="7" height="1.5" rx="0.75" fill="#3B82F6" opacity="0.45" />
    <rect x="5" y="12.5" width="10" height="1.5" rx="0.75" fill="#3B82F6" opacity="0.3" />
  </svg>
);

/** 工具图标 — 通用/未知工具 (齿轮) */
const ToolGenericIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect x="1" y="1" width="18" height="18" rx="5" fill="#F8F8F8" stroke="#E5E5E5" strokeWidth="0.5" />
    <circle cx="10" cy="10" r="3" stroke="#999999" strokeWidth="1.5" />
    <path d="M10 3V5M10 15V17M3 10H5M15 10H17M5.05 5.05L6.46 6.46M13.54 13.54L14.95 14.95M14.95 5.05L13.54 6.46M6.46 13.54L5.05 14.95" stroke="#999999" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

/** 情绪图标 — 用于标题 */
const SentimentChartIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect x="1" y="1" width="18" height="18" rx="5" fill="#FEF2F2" stroke="#FECACA" strokeWidth="0.5" />
    <rect x="4" y="10" width="2.5" height="6" rx="1" fill="#EF4444" opacity="0.7" />
    <rect x="8.5" y="7" width="2.5" height="9" rx="1" fill="#22C55E" opacity="0.7" />
    <rect x="13" y="4" width="2.5" height="12" rx="1" fill="#EF4444" opacity="0.7" />
  </svg>
);

/** 根据 agent 名称查找头像类型 */
const getAvatarTypeByName = (name: string, agents: Agent[]): AvatarType => {
  const agent = agents.find(a => a.name === name);
  if (agent) return getAvatarType(agent);
  return 'sphere';
};

/** 带边框的情绪头像 */
const SentimentAvatar = ({ name, borderColor, agents, size = 28 }: { name: string; borderColor: string; agents: Agent[]; size?: number }) => (
  <div className="flex flex-col items-center gap-0.5" title={name}>
    <div className="rounded-full p-[2px]" style={{ background: borderColor }}>
      <div className="rounded-full overflow-hidden bg-surface-card">
        <AgentAvatar type={getAvatarTypeByName(name, agents)} size={size} />
      </div>
    </div>
  </div>
);

/** 情绪汇总区块 — 共享组件
 *  compact=true: 简约版（信息流），单行列表式，无进度条无头像
 *  compact=false: 详细版（分析报告），分组列表式，按看涨/看跌/中性展示 agent 头像+名称
 */
const SentimentSection = ({ items, agents, compact = false }: { items: SentimentSummaryItem[]; agents: Agent[]; compact?: boolean }) => {
  if (!items || items.length === 0) return null;

  const getSentimentLabel = (s: string) =>
    s === 'bullish' ? '看涨' : s === 'bearish' ? '看跌' : '中性';
  const getSentimentTagClass = (s: string) =>
    s === 'bullish' ? 'bg-[#E05454]/10 text-[#E05454] border border-[#E05454]/20' :
    s === 'bearish' ? 'bg-[#2EA66E]/10 text-[#2EA66E] border border-[#2EA66E]/20' :
    'bg-surface-page text-content-muted border border-line-light';

  // === 简约版：每个标的分2行显示 ===
  // 第1行：涨跌图标(w-4) + 中文股票代号(股票编号)
  // 第2行：情绪标签 + agent头像（缩进pl-6对齐文字）
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <SentimentChartIcon size={16} />
          <h4 className="text-[14px] font-bold text-content-heading">情绪</h4>
        </div>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="space-y-1">
              {/* 第1行：涨跌图标 + 股票名字 */}
              <div className="flex items-center gap-2">
                <span className="w-4 flex-shrink-0 flex justify-center">
                  {item.overallSentiment === 'bullish' ? <BullishIcon size={14} /> :
                   item.overallSentiment === 'bearish' ? <BearishIcon size={14} /> : <NeutralIcon size={14} />}
                </span>
                <span className="text-[13px] text-content-primary leading-relaxed font-bold">{item.stock}</span>
              </div>
              {/* 第2行：情绪标签 + agent头像 */}
              <div className="flex items-center gap-1.5 flex-wrap pl-6">
                {/* 看涨组 */}
                {item.bullishAgents.length > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-[#E05454]/20 bg-[#E05454]/10">
                    <span className="text-[10px] text-[#E05454] font-semibold flex-shrink-0">看涨</span>
                    <div className="flex items-center">
                      {item.bullishAgents.map((name, i) => {
                        const agent = agents.find(a => a.name === name);
                        return agent ? (
                          <span key={`b-${i}`} className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-card" style={{ marginLeft: i > 0 ? -4 : 0, zIndex: i }} title={`${name} 看涨`}>
                            <AgentAvatar type={getAvatarType(agent)} size={20} />
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                {/* 中性组 */}
                {item.neutralAgents.length > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-line-dashed bg-surface-page">
                    <span className="text-[10px] text-content-muted font-semibold flex-shrink-0">中性</span>
                    <div className="flex items-center">
                      {item.neutralAgents.map((name, i) => {
                        const agent = agents.find(a => a.name === name);
                        return agent ? (
                          <span key={`n-${i}`} className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-card" style={{ marginLeft: i > 0 ? -4 : 0, zIndex: i }} title={`${name} 中性`}>
                            <AgentAvatar type={getAvatarType(agent)} size={20} />
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                {/* 看跌组 */}
                {item.bearishAgents.length > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-[#2EA66E]/20 bg-[#2EA66E]/10">
                    <span className="text-[10px] text-[#2EA66E] font-semibold flex-shrink-0">看跌</span>
                    <div className="flex items-center">
                      {item.bearishAgents.map((name, i) => {
                        const agent = agents.find(a => a.name === name);
                        return agent ? (
                          <span key={`e-${i}`} className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-card" style={{ marginLeft: i > 0 ? -4 : 0, zIndex: i }} title={`${name} 看跌`}>
                            <AgentAvatar type={getAvatarType(agent)} size={20} />
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // === 详细版：分组列表，带情绪分布条 ===
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#E05454]/10 flex items-center justify-center">
          <SentimentChartIcon size={16} />
        </div>
        <h4 className="text-[16px] font-bold text-content-heading">情绪</h4>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const total = item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length;
          return (
            <div key={index} className="relative rounded-2xl border border-line-light overflow-hidden bg-surface-card">
              <div className={`absolute top-0 bottom-0 left-0 w-[3px] ${
                item.overallSentiment === 'bullish' ? 'bg-gradient-to-b from-[#E05454] to-[#FF7875]' :
                item.overallSentiment === 'bearish' ? 'bg-gradient-to-b from-[#2EA66E] to-[#52C41A]' :
                'bg-gradient-to-b from-[#999999] to-[#BBBBBB]'
              }`} />
              <div className="px-4 pl-5 py-3.5">
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex-shrink-0">
                    {item.overallSentiment === 'bullish' ? <BullishIcon size={16} /> :
                     item.overallSentiment === 'bearish' ? <BearishIcon size={16} /> : <NeutralIcon size={16} />}
                  </span>
                  <span className="text-[14px] text-content-primary font-bold">{item.stock}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getSentimentTagClass(item.overallSentiment)}`}>
                    {getSentimentLabel(item.overallSentiment)}
                  </span>
                </div>

                {/* Sentiment Distribution Bar */}
                {total > 0 && (
                  <div className="mb-3">
                    <div className="flex h-2 rounded-full overflow-hidden bg-surface-page">
                      {item.bullishAgents.length > 0 && (
                        <div className="bg-gradient-to-r from-[#E05454] to-[#FF7875] transition-all duration-500" style={{ width: `${(item.bullishAgents.length / total) * 100}%` }} />
                      )}
                      {item.neutralAgents.length > 0 && (
                        <div className="bg-gradient-to-r from-[#D5D5D5] to-[#E0E0E0] transition-all duration-500" style={{ width: `${(item.neutralAgents.length / total) * 100}%` }} />
                      )}
                      {item.bearishAgents.length > 0 && (
                        <div className="bg-gradient-to-r from-[#2EA66E] to-[#52C41A] transition-all duration-500" style={{ width: `${(item.bearishAgents.length / total) * 100}%` }} />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      {item.bullishAgents.length > 0 && <span className="text-[9px] text-[#E05454] font-bold">看涨 {item.bullishAgents.length}</span>}
                      {item.neutralAgents.length > 0 && <span className="text-[9px] text-content-muted font-bold">中性 {item.neutralAgents.length}</span>}
                      {item.bearishAgents.length > 0 && <span className="text-[9px] text-[#2EA66E] font-bold">看跌 {item.bearishAgents.length}</span>}
                    </div>
                  </div>
                )}

                {/* Agent Groups */}
                <div className="space-y-2">
                  {/* 看涨 */}
                  {item.bullishAgents.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-[#E05454] font-bold w-7 flex-shrink-0 pt-1">看涨</span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.bullishAgents.map((name, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-1 bg-[#E05454]/10 rounded-full border border-[#E05454]/20">
                            <SentimentAvatar name={name} borderColor="#EF4444" agents={agents} size={18} />
                            <span className="text-[10px] text-[#E05454] font-semibold">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 看跌 */}
                  {item.bearishAgents.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-[#2EA66E] font-bold w-7 flex-shrink-0 pt-1">看跌</span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.bearishAgents.map((name, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-1 bg-[#2EA66E]/10 rounded-full border border-[#2EA66E]/20">
                            <SentimentAvatar name={name} borderColor="#22C55E" agents={agents} size={18} />
                            <span className="text-[10px] text-[#2EA66E] font-semibold">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 中性 */}
                  {item.neutralAgents.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-content-muted font-bold w-7 flex-shrink-0 pt-1">中性</span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.neutralAgents.map((name, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-1 bg-surface-page/80 rounded-full border border-line-light">
                            <SentimentAvatar name={name} borderColor="#AAAAAA" agents={agents} size={18} />
                            <span className="text-[10px] text-content-muted font-semibold">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 根据工具名称返回对应图标 */
const getToolIcon = (toolName: string, size = 18) => {
  switch (toolName) {
    case 'getStockPrice': return <ToolStockPriceIcon size={size} />;
    case 'getLatestNews': return <ToolNewsIcon size={size} />;
    default: return <ToolGenericIcon size={size} />;
  }
};

/** 格式化时间戳为 HH:mm */
const formatTime = (ts?: number): string => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * 从流式 JSON 缓冲区中提取 overallSummary 的纯文本内容
 * LLM 返回完整 JSON，打字机阶段只展示 overallSummary 字段的文本
 */
const extractSummaryFromJsonStream = (raw: string): string => {
  // 尝试找到 "overallSummary" 字段
  const key = '"overallSummary"';
  const idx = raw.indexOf(key);
  if (idx === -1) return ''; // 还没流到 overallSummary，不展示

  // 跳过 key + 冒号 + 可选空白 + 开头引号
  let start = idx + key.length;
  // 跳过 : 和空白
  while (start < raw.length && (raw[start] === ':' || raw[start] === ' ' || raw[start] === '\n')) start++;
  // 跳过开头引号
  if (start < raw.length && raw[start] === '"') start++;

  // 从 start 开始提取到下一个未转义的 " 或字符串末尾
  let result = '';
  let i = start;
  while (i < raw.length) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      // 处理转义字符
      const next = raw[i + 1];
      if (next === 'n') { result += '\n'; i += 2; continue; }
      if (next === '"') { result += '"'; i += 2; continue; }
      if (next === '\\') { result += '\\'; i += 2; continue; }
      if (next === 't') { result += '\t'; i += 2; continue; }
      result += next; i += 2; continue;
    }
    if (raw[i] === '"') break; // 闭合引号，overallSummary 结束
    result += raw[i];
    i++;
  }

  return result;
};

// @提及高亮：获取 agent color 对应的文字颜色
const getMentionTextColor = (agentColor: string): string => {
  if (agentColor.includes('red')) return 'text-red-600';
  if (agentColor.includes('emerald')) return 'text-emerald-600';
  if (agentColor.includes('indigo')) return 'text-indigo-600';
  if (agentColor.includes('amber')) return 'text-amber-600';
  if (agentColor.includes('blue')) return 'text-blue-600';
  if (agentColor.includes('purple')) return 'text-purple-600';
  if (agentColor.includes('orange')) return 'text-orange-600';
  return 'text-indigo-600';
};

/**
 * 渲染内容中的 @agent名称 为加粗+变色
 * 匹配所有 @AgentName 模式，如果名称匹配已知 agent 则高亮
 */
const renderContentWithMentions = (content: string, agents: Agent[]): React.ReactNode => {
  if (!content || agents.length === 0) return content;

  // 构建 agent 名称列表（按长度降序，优先匹配长名称）+ "你" 用于用户提及
  const agentNames = agents
    .map(a => a.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  // 添加"你"作为可识别的提及名称（用于 @你 高亮显示）
  const allNames = [...agentNames, '你'];

  if (allNames.length === 0) return content;

  // 构建正则：匹配 @AgentName 和 @你
  const escapedNames = allNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionRegex = new RegExp(`(@(?:${escapedNames.join('|')}))`, 'g');

  const parts = content.split(mentionRegex);
  if (parts.length === 1) return content; // 没有匹配到任何 @mention

  return parts.map((part, idx) => {
    if (part.startsWith('@')) {
      const mentionedName = part.slice(1);
      if (mentionedName === '你') {
        // 用户提及：蓝色高亮
        return (
          <span key={idx} className="font-semibold text-blue-600">
            {part}
          </span>
        );
      }
      const matchedAgent = agents.find(a => a.name === mentionedName);
      if (matchedAgent) {
        const colorClass = getMentionTextColor(matchedAgent.color || '');
        return (
          <span key={idx} className={`font-semibold ${colorClass}`}>
            {part}
          </span>
        );
      }
    }
    return part;
  });
};

// localStorage key（按用户 ID 隔离）
const HISTORY_TOPICS_KEY_PREFIX = 'multiagent_history_topics';

/** 获取当前用户的历史记录 localStorage key */
function getHistoryKey(): string {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.id) return `${HISTORY_TOPICS_KEY_PREFIX}_${user.id}`;
    }
  } catch { /* ignore */ }
  return HISTORY_TOPICS_KEY_PREFIX;
}

// 保存讨论到localStorage（按用户隔离）
const saveDiscussionToHistory = (discussion: Discussion) => {
  try {
    const key = getHistoryKey();
    const stored = localStorage.getItem(key);
    const topics: any[] = stored ? JSON.parse(stored) : [];
    
    const now = Date.now();
    const existingIndex = topics.findIndex((t: any) => t.id === discussion.id);
    
    if (existingIndex >= 0) {
      // 更新现有话题
      topics[existingIndex] = {
        ...topics[existingIndex],
        title: discussion.title,
        updatedAt: now,
        discussion: discussion, // 更新完整的讨论数据
      };
    } else {
      // 添加新话题
      topics.push({
        id: discussion.id,
        title: discussion.title,
        createdAt: now,
        updatedAt: now,
        discussion: discussion,
      });
    }
    
    // 限制最多保存50个
    const limitedTopics = topics.slice(0, 50);
    localStorage.setItem(key, JSON.stringify(limitedTopics));
  } catch (error) {
    console.error('[DiscussionPage] Error saving discussion to history:', error);
  }
};

type DiscussionPageProps = {
  discussion: Discussion;
  onBack: () => void;
  onUpdateDiscussion: (discussion: Discussion) => void;
};

export function DiscussionPage({ discussion, onBack, onUpdateDiscussion }: DiscussionPageProps) {
  const { isDark } = useTheme();
  // 截图用 Logo 顶部留白：模拟手机状态栏/安全区域高度
  // 标准 Safari 浏览模式下 env(safe-area-inset-top) 返回 0（浏览器 UI 自己处理了安全区域），
  // 所以需要根据设备屏幕尺寸推断实际安全区域高度，用于截图图片的顶部留白
  const [safeAreaTop, setSafeAreaTop] = useState(16);
  useEffect(() => {
    // 第一步：尝试 env() — 在 PWA/standalone 模式下能拿到真实值
    const probe = document.createElement('div');
    probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    probe.style.position = 'fixed';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
    const envVal = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    document.body.removeChild(probe);

    if (envVal > 0) {
      setSafeAreaTop(envVal);
      return;
    }

    // 第二步：标准 Safari 浏览模式，env() 返回 0
    // 根据屏幕尺寸推断安全区域高度（用于截图图片构图）
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) {
      setSafeAreaTop(16); // 桌面端：16px 即可
      return;
    }
    const ua = navigator.userAgent;
    const isIPhone = /iPhone/.test(ua);
    const h = window.screen.height;
    if (isIPhone) {
      if (h >= 852) {
        // iPhone 14 Pro / 15 / 15 Pro / 16 系列 — Dynamic Island，安全区 ~59px
        setSafeAreaTop(59);
      } else if (h >= 812) {
        // iPhone X / XS / 11 / 12 / 13 / 14 系列 — 刘海屏，安全区 ~47px
        setSafeAreaTop(47);
      } else {
        // iPhone SE / 8 等无刘海机型 — 状态栏 ~20px
        setSafeAreaTop(20);
      }
    } else {
      // Android 等其他移动设备
      setSafeAreaTop(24);
    }
  }, []);
  // Logo 预加载为 base64 data URL（解决 html-to-image SVG foreignObject 在移动端 Safari 不渲染 URL 图片的问题）
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  useEffect(() => {
    const src = isDark ? '/logo-dark.png' : '/logo-light.png';
    let cancelled = false;
    const img = new Image();
    // 同源图片不设 crossOrigin，避免不必要的 CORS 检查导致静默失败
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Logo canvas 转换失败:', e);
      }
    };
    img.onerror = () => {
      if (!cancelled) console.warn('Logo 加载失败:', src);
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [isDark]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRoundIndex, setSummaryRoundIndex] = useState<number | null>(null); // 分析报告弹窗显示的轮次（null=最新轮）
  const [showRoundPicker, setShowRoundPicker] = useState(false); // 轮次选择器下拉
  const [isGeneratingImage, setIsGeneratingImage] = useState(false); // 截图生成中
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null); // 长图预览 URL（Object URL）
  const [shareImageBlob, setShareImageBlob] = useState<Blob | null>(null); // 长图 Blob（供分享按钮直接使用，避免 async 操作破坏手势上下文）
  const [copied, setCopied] = useState(false); // 复制图片到剪贴板成功提示
  const summaryScrollRef = useRef<HTMLDivElement>(null); // 分析报告滚动容器 ref
  const logoWrapRef = useRef<HTMLDivElement>(null); // Logo 容器 ref（截图时临时修改 paddingTop）
  const [collapsedSummary, setCollapsedSummary] = useState<Record<number, boolean>>({});
  const [collapsedModerator, setCollapsedModerator] = useState<Record<number, boolean>>({}); // 主持人卡片折叠状态
  const [isLoading, setIsLoading] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(1);
  const [currentRoundComments, setCurrentRoundComments] = useState<Map<string, AgentComment>>(new Map());
  const [currentRoundStatus, setCurrentRoundStatus] = useState<'idle' | 'speech' | 'review' | 'summary' | 'complete'>('idle');
  const [currentSummaryText, setCurrentSummaryText] = useState<string>(''); // 用于流式显示总结
  const [summaryStreamStatus, setSummaryStreamStatus] = useState<'thinking' | 'typing' | null>(null); // 主持人总结的流式状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // 历史话题抽屉状态
  const [showScrollToBottom, setShowScrollToBottom] = useState(false); // 是否显示"回到底部"按钮
  const [showPromptsModal, setShowPromptsModal] = useState(false); // 是否显示prompts弹窗
  const [currentRoundPrompts, setCurrentRoundPrompts] = useState<{
    agents: Array<{ agentId: string; agentName: string; systemPrompt: string; userPrompt: string }>;
    moderator?: { systemPrompt: string; userPrompt: string };
  } | null>(null);
  // 用户 Q&A 相关状态
  const [userInput, setUserInput] = useState(''); // 用户输入的文本
  const [isInputMultiLine, setIsInputMultiLine] = useState(false); // 输入框是否多行
  const [bottomBarMode, setBottomBarMode] = useState<'edit' | 'discussion'>('discussion'); // 底部栏模式
  const [showMentionPopup, setShowMentionPopup] = useState(false); // 是否显示 @-mention 弹窗
  const [activeToolTip, setActiveToolTip] = useState<string | null>(null); // 当前展开的工具提示 key (roundIdx-commentIdx-toolIdx)
  const [mentionFilter, setMentionFilter] = useState(''); // @-mention 过滤关键词
  const [mentionCursorPos, setMentionCursorPos] = useState(0); // @符号在输入框中的位置
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(64); // 默认单行底部栏高度
  const lastScrollTop = useRef(0);
  const hasStartedRef = useRef(false);
  const isScrollingToBottomRef = useRef(false); // 标记是否正在滚动到底部
  const isUserInteractingRef = useRef(false); // 用户是否正在触摸/滚轮操作
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // 用于中止第2轮+讨论

  // 获取所有轮次数据（向后兼容：如果没有 rounds，从 comments 和 moderatorAnalysis 构建）
  const getRounds = (): RoundData[] => {
    // 确保 discussion 对象存在
    if (!discussion) {
      return [];
    }
    
    const completedRounds = discussion.rounds || [];
    
    // 如果有正在进行的轮次，检查是否已经存在于已完成轮次中
    if (currentRoundStatus !== 'idle' && currentRoundStatus !== 'complete' && currentRoundComments.size > 0) {
      // 检查当前轮次是否已经存在于已完成轮次中
      const currentRoundExists = completedRounds.some(r => r.roundIndex === currentRoundIndex);
      
      if (!currentRoundExists) {
        // 如果不存在，添加当前进行中的轮次
        const currentRoundCommentsArray = Array.from(currentRoundComments.values())
          .filter(c => c.agentId !== 'user'); // 用户消息通过 userQuestion 字段渲染，不在 comments 中
        
        // 提取用户提问（如果有）
        const userComment = currentRoundComments.get('__user__');
        
        // 主持人总结：仅在 summary 阶段才显示（不在 speech/review 阶段显示）
        const showModerator = currentRoundStatus === 'summary';
        
        return [
          ...completedRounds,
          {
            roundIndex: currentRoundIndex,
            comments: currentRoundCommentsArray,
            moderatorAnalysis: {
              round: currentRoundIndex,
              consensusLevel: 0,
              summary: showModerator
                ? (currentSummaryText || '')
                : '',
              newPoints: [],
              consensus: [],
              disagreements: [],
            },
            // 如果有用户提问，记录在 round 上
            ...(userComment ? { userQuestion: userComment.content, userMentionedAgentIds: userComment.mentionedAgentIds, userQuestionTime: userComment.completedAt } : {}),
            // 标记是否正在进行中（用于UI判断是否渲染主持人区块）
            _isInProgress: true,
            _showModerator: showModerator,
            _summaryStreamStatus: summaryStreamStatus,
          } as any, // 临时扩展字段
        ];
      }
      // 如果已存在，直接返回已完成轮次（避免重复）
    }
    
    if (completedRounds.length > 0) {
      return completedRounds;
    }
    
    // 向后兼容：从旧的 comments 和 moderatorAnalysis 构建第一轮
    // 检查 moderatorAnalysis 是否存在
    if (discussion.moderatorAnalysis) {
      return [{
        roundIndex: discussion.moderatorAnalysis.round || 1,
        comments: (discussion.comments || []).map(comment => ({
          ...comment,
          expanded: comment.expanded ?? false, // 确保所有comments都有expanded属性
        })),
        moderatorAnalysis: discussion.moderatorAnalysis,
      }];
    }
    
    // 如果都没有，返回空数组
    return [];
  };

  const rounds = getRounds();

  // 监听滚动，检测用户是否向上滚动，以及是否显示"回到底部"按钮
  // 点击空白处关闭工具提示气泡
  useEffect(() => {
    if (!activeToolTip) return;
    const handleClickOutside = () => setActiveToolTip(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeToolTip]);

  // 检测用户主动触摸/滚轮交互，交互期间抑制自动滚动，防止抖动
  useEffect(() => {
    const contentElement = contentRef.current;
    const markInteracting = () => {
      isUserInteractingRef.current = true;
      // 清除之前的定时器
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
      // 交互停止 1.2s 后解除抑制
      interactionTimerRef.current = setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 1200);
    };
    const markEnd = () => {
      // touchend/mouseup 后缩短等待时间到 600ms
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 600);
    };

    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('touchstart', markInteracting, opts);
    window.addEventListener('touchmove', markInteracting, opts);
    window.addEventListener('touchend', markEnd, opts);
    window.addEventListener('wheel', markInteracting, opts);
    if (contentElement) {
      contentElement.addEventListener('touchstart', markInteracting, opts);
      contentElement.addEventListener('touchmove', markInteracting, opts);
      contentElement.addEventListener('touchend', markEnd, opts);
      contentElement.addEventListener('wheel', markInteracting, opts);
    }
    return () => {
      window.removeEventListener('touchstart', markInteracting);
      window.removeEventListener('touchmove', markInteracting);
      window.removeEventListener('touchend', markEnd);
      window.removeEventListener('wheel', markInteracting);
      if (contentElement) {
        contentElement.removeEventListener('touchstart', markInteracting);
        contentElement.removeEventListener('touchmove', markInteracting);
        contentElement.removeEventListener('touchend', markEnd);
        contentElement.removeEventListener('wheel', markInteracting);
      }
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // 如果正在滚动到底部，暂时不更新按钮状态，避免闪烁
      if (isScrollingToBottomRef.current) {
        return;
      }
      
      // 优先检查 contentRef（如果内容区域有滚动）
      let scrollTop: number;
      let scrollHeight: number;
      let clientHeight: number;
      
      if (contentRef.current && contentRef.current.scrollHeight > contentRef.current.clientHeight) {
        // 内容区域有滚动
        scrollTop = contentRef.current.scrollTop;
        scrollHeight = contentRef.current.scrollHeight;
        clientHeight = contentRef.current.clientHeight;
      } else {
        // 使用 window 滚动位置
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = window.innerHeight;
      }
      
      // 计算距离底部的距离
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      
      // 如果距离底部超过100px，显示"回到底部"按钮
      const shouldShow = distanceFromBottom > 100;
      
      setShowScrollToBottom(shouldShow);
      
      // 如果用户向上滚动且不在底部附近，标记为用户主动滚动
      if (scrollTop < lastScrollTop.current && scrollTop + clientHeight < scrollHeight - 100) {
        setUserScrolledUp(true);
      } else if (scrollTop + clientHeight >= scrollHeight - 50) {
        // 用户滚动到底部附近，重置标记
        setUserScrolledUp(false);
        setShowScrollToBottom(false);
      }
      
      lastScrollTop.current = scrollTop;
    };

    // 监听 window 滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });
    // 监听 contentRef 的滚动（如果存在）
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll, { passive: true });
    }
    // 初始检查
    setTimeout(handleScroll, 100); // 延迟一下确保DOM已渲染
    // 定期检查（用于内容动态变化时）
    const interval = setInterval(handleScroll, 500);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (contentElement) {
        contentElement.removeEventListener('scroll', handleScroll);
      }
      clearInterval(interval);
    };
  }, [rounds.length, currentRoundComments.size]);

  // 当有新内容且用户没有主动向上滚动时，自动滚动到底部
  // 使用 instant 滚动（直接设置 scrollTop）确保在流式输出时能实时跟随
  // 注意：依赖 currentRoundComments（而非 .size），因为流式输出更新已有条目内容时 size 不变，
  // 但每次 setCurrentRoundComments 都创建新 Map 引用，所以 reference 变化能触发 effect
  // 额外：用户正在触摸/滚轮操作时跳过，防止手指滑动时被强制拉回底部导致抖动
  useEffect(() => {
    if (userScrolledUp) return;
    if (isUserInteractingRef.current) return;
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [rounds.length, currentRoundComments, summaryStreamStatus, currentSummaryText]);

  // 监听底部栏高度变化（输入框多行时高度会变），用于定位浮动按钮
  useEffect(() => {
    const el = bottomBarRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBottomBarHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 自动开始第一轮讨论（如果还没有开始）
  useEffect(() => {
    if (!discussion.id || hasStartedRef.current || isLoading) return;
    
    // 如果已经有完成的轮次，不需要自动开始
    if (discussion.rounds && discussion.rounds.length > 0) {
      hasStartedRef.current = true;
      return;
    }

    // 如果是新创建的讨论（rounds 为空），自动开始第一轮
    if (discussion.rounds && discussion.rounds.length === 0 && discussion.sessionData) {
      hasStartedRef.current = true;
      startFirstRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussion.id]);

  // 辅助：处理流式总结并返回结果
  // 新架构：解析结构化文本（带【段落】标记），逐段打字机显示
  const handleSummaryStream = async (
    summaryResponse: Response,
  ): Promise<{ roundSummary: any; updatedSession: any }> => {
    if (!summaryResponse.ok) {
      throw new Error('Failed to generate summary');
    }

    let roundSummary: any = null;
    let updatedSession: any = null;
    let summaryBuffer = '';

    const reader = summaryResponse.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      throw new Error('Failed to get summary stream');
    }

    // 主持人开始思考
    setSummaryStreamStatus('thinking');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'section_change') {
                // 段落切换 → 更新当前流式段落
                setSummaryStreamStatus('typing');
              } else if (data.type === 'chunk') {
                // chunk 到达 → typing 状态
                summaryBuffer += data.content;
                // 直接使用累积的结构化文本作为流式显示内容
                setSummaryStreamStatus('typing');
                setCurrentSummaryText(summaryBuffer);
              } else if (data.type === 'done') {
                roundSummary = data.roundSummary;
                updatedSession = data.session;
                setCurrentSummaryText(summaryBuffer);
                setSummaryStreamStatus(null); // 完成
                if (data.moderatorPrompts?.systemPrompt && data.moderatorPrompts?.userPrompt) {
                  currentRoundPromptsRef.current.moderator = {
                    systemPrompt: data.moderatorPrompts.systemPrompt,
                    userPrompt: data.moderatorPrompts.userPrompt,
                  };
                }
              } else if (data.type === 'error') {
                setSummaryStreamStatus(null);
                roundSummary = null;
                updatedSession = null;
                console.error('Summary stream error:', data.error);
              }
            } catch (e) {
              // 让 AbortError 向上传播
              if (e instanceof DOMException && e.name === 'AbortError') throw e;
              console.error('Error parsing summary SSE data:', e);
            }
          }
        }
      }
    } catch (e) {
      // AbortError 向上传播给调用方（startNextRound 的 catch 块）
      if (e instanceof DOMException && e.name === 'AbortError') {
        setSummaryStreamStatus(null);
        throw e;
      }
      throw e;
    }

    setSummaryStreamStatus(null);

    if (!roundSummary || !updatedSession) {
      throw new Error('Failed to get complete summary');
    }

    return { roundSummary, updatedSession };
  };

  // 辅助：构建 moderatorAnalysis 对象
  // 兼容新格式（convertModeratorTextToAnalysis 输出）和旧 JSON 格式
  const buildModeratorAnalysis = (roundSummary: any, roundIndex: number, agentSentiments?: Array<{ agentName: string; sentiments?: StockSentiment[] }>) => ({
    round: roundSummary.roundIndex || roundSummary.round || roundIndex,
    consensusLevel: roundSummary.consensusLevel ?? 50,
    summary: roundSummary.summary || roundSummary.overallSummary || '本轮讨论已完成',
    newPoints: (() => {
      // 新格式：newPoints 直接来自核心观点/维度名称
      if (roundSummary.newPoints && roundSummary.newPoints.length > 0 && roundSummary.newPoints[0] !== '暂无新观点') {
        return roundSummary.newPoints;
      }
      // 旧格式：从 insights 提取
      if (roundSummary.insights && roundSummary.insights.length > 0) {
        return roundSummary.insights.slice(0, 3);
      }
      return ['暂无新观点'];
    })(),
    // v2 新增：话题维度对比
    topicComparisons: roundSummary.topicComparisons || undefined,
    // v2 新增：亮眼观点
    highlights: roundSummary.highlights || undefined,
    consensus: (() => {
      // 新格式：consensus 已经是 { content, agents, percentage, strength?, reasoning? }
      if (roundSummary.consensus && roundSummary.consensus.length > 0) {
        return roundSummary.consensus.map((c: any) => ({
          content: c.content || c.point || '',
          agents: c.agents || c.supportingAgents || [],
          percentage: c.percentage ?? Math.round(((c.supportCount || 0) / (c.totalAgents || discussion.agents.length)) * 100),
          strength: c.strength || undefined,
          reasoning: c.reasoning || undefined,
        }));
      }
      return [];
    })(),
    disagreements: (() => {
      // v2 新格式：disagreements 有 { topic, description, nature?, supportAgents, opposeAgents, sides?, rootCause? }
      if (roundSummary.disagreements && roundSummary.disagreements.length > 0) {
        return roundSummary.disagreements.map((d: any) => ({
          topic: d.topic || d.issue || '',
          description: d.description || '',
          nature: d.nature || undefined,
          supportAgents: d.supportAgents || [],
          opposeAgents: d.opposeAgents || [],
          sides: d.sides || (() => {
            // 兼容旧格式的 positions
            if (d.positions && d.positions.length > 0) {
              return d.positions.map((p: any) => ({
                position: p.position || '',
                agents: [{ name: p.agentName || 'Unknown', color: 'bg-gray-500' }],
              }));
            }
            return undefined;
          })(),
          rootCause: d.rootCause || undefined,
        }));
      }
      // 旧格式：从 conflicts 提取
      if (roundSummary.conflicts && roundSummary.conflicts.length > 0) {
        return roundSummary.conflicts.map((c: any) => ({
          topic: c.issue || '',
          description: (c.positions && c.positions.length > 0)
            ? c.positions.map((p: any) => `${p.agentName}: ${p.position}`).join('; ')
            : '暂无详细描述',
          supportAgents: [],
          opposeAgents: [],
          sides: c.positions?.map((p: any) => ({
            position: p.position || '',
            agents: [{ name: p.agentName || 'Unknown', color: 'bg-gray-500' }],
          })),
        }));
      }
      return [];
    })(),
    sentimentSummary: (() => {
      // 始终以 agent 的结构化 sentiments 数据为基准，确保不遗漏任何标的
      const agentBased = (agentSentiments && agentSentiments.length > 0)
        ? buildSentimentSummaryFromAgentData(agentSentiments)
        : [];
      // LLM 生成的 sentimentSummary 作为补充（可能包含更丰富的归因）
      const llmBased: SentimentSummaryItem[] = (roundSummary.sentimentSummary && Array.isArray(roundSummary.sentimentSummary) && roundSummary.sentimentSummary.length > 0)
        ? roundSummary.sentimentSummary.map((s: any) => ({
            stock: (s.stock || '') as string,
            bullishAgents: (s.bullishAgents || []) as string[],
            bearishAgents: (s.bearishAgents || []) as string[],
            neutralAgents: (s.neutralAgents || []) as string[],
            overallSentiment: (s.overallSentiment || 'neutral') as SentimentSummaryItem['overallSentiment'],
          }))
        : [];
      // 合并：以 agent 数据为主，LLM 数据补充缺失的标的（使用归一化匹配）
      const mergedItems: SentimentSummaryItem[] = [...agentBased];
      for (const llmItem of llmBased) {
        if (!llmItem.stock) continue;
        // 检查是否已有归一化后匹配的条目
        const alreadyExists = mergedItems.some(existing => isSameStock(existing.stock, llmItem.stock));
        if (!alreadyExists) {
          // LLM 独有的标的，直接保留（LLM 已按 "中文简称(代码)" 格式输出）
          mergedItems.push(llmItem);
        }
      }
      if (mergedItems.length === 0) return undefined;
      // 统一 overallSentiment 为 3 种（兼容旧数据中的 divided → 按多数决定，平局归 neutral）
      const normalizeSentiment = (item: SentimentSummaryItem): SentimentSummaryItem => {
        const raw = item.overallSentiment as string;
        if (raw === 'divided') {
          const os = item.bullishAgents.length > item.bearishAgents.length ? 'bullish'
            : item.bearishAgents.length > item.bullishAgents.length ? 'bearish'
            : 'neutral';
          return { ...item, overallSentiment: os };
        }
        return item;
      };
      return mergedItems.map(normalizeSentiment);
    })(),
  });

  // 辅助：依次执行一批 reply 请求（逐个agent，模拟群聊）
  const executeReplyBatch = async (
    replyRound: number,
    roundIndex: number,
    allSpeeches: Array<{ agentId: string; agentName: string; content: string }>,
    previousReplies: Array<{ agentId: string; agentName: string; content: string; replyRound: number }>,
    previousRoundComments?: Array<{ agentId: string; agentName: string; content: string }>,
  ): Promise<Array<{ agentId: string; agentName: string; content: string; replyRound: number; targetAgentId?: string; targetAgentName?: string; systemPrompt?: string; userPrompt?: string; sentiments?: StockSentiment[]; completedAt?: number; toolCalls?: ToolCallRecord[] }>> => {
    const results: Array<{ agentId: string; agentName: string; content: string; replyRound: number; targetAgentId?: string; targetAgentName?: string; systemPrompt?: string; userPrompt?: string; sentiments?: StockSentiment[]; completedAt?: number; toolCalls?: ToolCallRecord[] }> = [];

    // 依次处理每个 agent（非并行，像群聊一样逐个发言）
    for (const agent of discussion.agents) {
      const mySpeech = allSpeeches.find(s => s.agentId === agent.id)?.content || '';

      const response = await fetch(getApiUrl('/api/agents/reply/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: discussion.id,
          agentId: agent.id,
          roundIndex,
          replyRound,
          allSpeeches: allSpeeches.map(s => ({ agentId: s.agentId, agentName: s.agentName, content: s.content })),
          mySpeech,
          previousReplies: previousReplies.length > 0 ? previousReplies : undefined,
          previousRoundComments: previousRoundComments,
          sessionData: discussion.sessionData,
        }),
      });

      const replyKey = `reply_${agent.id}_r${replyRound}`;

      const result = await handleStreamResponse(
        response,
        agent.id,
        agent.name || 'Unknown Agent',
        agent.color || 'bg-gray-500',
        (content, targetId, targetName, _systemPrompt, _userPrompt, sentimentsData, streamStatus, toolCallsData, activeToolCallData) => {
          setCurrentRoundComments(prev => {
            const newMap = new Map(prev);
            newMap.set(replyKey, {
              agentId: agent.id,
              agentName: agent.name || 'Unknown Agent',
              agentColor: agent.color || 'bg-gray-500',
              content: content || '',
              expanded: false,
              type: 'reply',
              replyRound,
              targetAgentId: targetId,
              targetAgentName: targetName,
              sentiments: sentimentsData,
              streamStatus,
              toolCalls: toolCallsData,
              activeToolCall: activeToolCallData,
            });
            return newMap;
          });
        }
      );

      const replyCompletedAt = Date.now();

      // 更新完成状态（含时间戳、工具调用记录）
      setCurrentRoundComments(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(replyKey);
        if (existing) {
          newMap.set(replyKey, { ...existing, streamStatus: undefined, completedAt: replyCompletedAt, toolCalls: result.toolCalls || existing.toolCalls, activeToolCall: undefined });
        }
        return newMap;
      });

      // 保存 prompts
      if (result.systemPrompt && result.userPrompt) {
        currentRoundPromptsRef.current.agents.push({
          agentId: agent.id,
          agentName: agent.name || 'Unknown Agent',
          systemPrompt: result.systemPrompt,
          userPrompt: result.userPrompt,
        });
      }

      results.push({
        agentId: agent.id,
        agentName: agent.name || 'Unknown Agent',
        content: result.content,
        replyRound,
        targetAgentId: result.targetAgentId,
        targetAgentName: result.targetAgentName,
        systemPrompt: result.systemPrompt,
        userPrompt: result.userPrompt,
        sentiments: result.sentiments,
        completedAt: replyCompletedAt,
        toolCalls: result.toolCalls,
      });
    }

    return results;
  };

  // 开始第一轮讨论
  const startFirstRound = async () => {
    if (!discussion.id || !discussion.sessionData) return;

    setIsLoading(true);
    setCurrentRoundStatus('speech');
    setCurrentRoundIndex(1);
    // 重置prompts收集
    currentRoundPromptsRef.current = { agents: [] };

    // 初始化评论状态（空，会在每个agent发言时逐个填充）
    setCurrentRoundComments(new Map());

    // 声明在 try 外，以便 catch 中可以访问用于 fallback 保存
    const speeches: Array<{ agentId: string; agentName: string; content: string; sentiments?: StockSentiment[]; toolCalls?: ToolCallRecord[]; completedAt?: number }> = [];

    try {
      const sessionData = discussion.sessionData;
      
      // 步骤 1: 依次请求每个 Agent 的观点阐述（逐个发言，像群聊一样）
      // 新架构：每个Agent每轮只发言1次，不再有针对性回复阶段

      for (const agent of discussion.agents) {
        const response = await fetch(getApiUrl('/api/agents/speech/stream'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: discussion.id,
            agentId: agent.id,
            roundIndex: 1,
            sessionData: sessionData,
          }),
        });

        const speech = await handleStreamResponse(
          response,
          agent.id,
          agent.name || 'Unknown Agent',
          agent.color || 'bg-gray-500',
          (content, _targetAgentId, _targetAgentName, _systemPrompt, _userPrompt, sentimentsData, streamStatus, toolCallsData, activeToolCallData) => {
            setCurrentRoundComments(prev => {
              const newMap = new Map(prev);
              newMap.set(agent.id, {
                agentId: agent.id,
                agentName: agent.name || 'Unknown Agent',
                agentColor: agent.color || 'bg-gray-500',
                content: content || '',
                expanded: false,
                type: 'speech',
                sentiments: sentimentsData,
                streamStatus,
                toolCalls: toolCallsData,
                activeToolCall: activeToolCallData,
              });
              return newMap;
            });
          }
        );

        const speechCompletedAt = Date.now();

        // 更新完成状态（含时间戳）
        setCurrentRoundComments(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(agent.id);
          if (existing) {
            newMap.set(agent.id, { ...existing, streamStatus: undefined, completedAt: speechCompletedAt, toolCalls: speech.toolCalls || existing.toolCalls });
          }
          return newMap;
        });

        // 保存agent的prompts
        if (speech.systemPrompt && speech.userPrompt) {
          currentRoundPromptsRef.current.agents.push({
            agentId: agent.id,
            agentName: agent.name || 'Unknown Agent',
            systemPrompt: speech.systemPrompt,
            userPrompt: speech.userPrompt,
          });
        }

        speeches.push({ agentId: agent.id, agentName: agent.name || 'Unknown Agent', content: speech.content, sentiments: speech.sentiments, toolCalls: speech.toolCalls, completedAt: speechCompletedAt });
      }

      // 步骤 2: 流式请求主持人总结（不再有针对性回复阶段）
      setCurrentRoundStatus('summary');
      setCurrentSummaryText('');
      
      const agentsSpeeches = speeches.map(s => ({
        agentId: s.agentId,
        agentName: s.agentName,
        speech: s.content,
      }));

      const summaryResponse = await fetch(getApiUrl('/api/rounds/summary/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: discussion.id,
          roundIndex: 1,
          agentsSpeeches,
          agentsReviews: [],
          agentsReplies: [],
          sessionData: sessionData,
          // 原始发言数据（含 toolCalls / sentiments），由后端持久化，用于历史恢复
          rawSpeeches: speeches.map(s => ({
            agentId: s.agentId,
            agentName: s.agentName,
            content: s.content,
            sentiments: s.sentiments,
            toolCalls: dedupToolCalls(s.toolCalls),
            completedAt: s.completedAt,
          })),
        }),
      });

      const { roundSummary, updatedSession } = await handleSummaryStream(summaryResponse);

      // 收集所有 comments（仅 speech）
      setCurrentRoundComments(prev => {
        const allComments: AgentComment[] = [];
        
        for (const speech of speeches) {
          const existing = prev.get(speech.agentId);
          allComments.push({
            agentId: speech.agentId,
            agentName: speech.agentName,
            agentColor: existing?.agentColor || discussion.agents.find(a => a.id === speech.agentId)?.color || 'bg-gray-500',
            content: speech.content,
            expanded: false,
            type: 'speech',
            sentiments: speech.sentiments,
            completedAt: speech.completedAt,
            toolCalls: dedupToolCalls(speech.toolCalls),
          });
        }

        // 收集 agent 的 sentiments 数据，用于 sentimentSummary fallback
        const agentSentimentsForSummary = speeches.map(s => ({ agentName: s.agentName, sentiments: s.sentiments }));
        const moderatorAnalysis = buildModeratorAnalysis(roundSummary, 1, agentSentimentsForSummary);

        const firstRound: RoundData = {
          roundIndex: roundSummary.roundIndex || roundSummary.round || 1,
          comments: allComments,
          moderatorAnalysis,
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
            moderator: currentRoundPromptsRef.current.moderator,
          },
        };

        // 将所有状态更新放入同一个 setTimeout，确保 onUpdateDiscussion
        // 与 currentRoundComments/Status 清空在同一个 React 批次中执行，
        // 避免中间状态导致 getRounds() 返回空数组引发滚动跳顶
        setTimeout(() => {
          const updatedDiscussion = {
            ...discussion,
            rounds: [firstRound],
            comments: allComments,
            moderatorAnalysis,
            sessionData: updatedSession,
          };
          onUpdateDiscussion(updatedDiscussion);
          saveDiscussionToHistory(updatedDiscussion);
          setCurrentRoundStatus('complete');
          setCurrentSummaryText('');
          setCurrentRoundComments(new Map());
        }, 0);

        return prev;
      });
    } catch (error) {
      console.error('Error starting first round:', error);

      // 如果 speeches 已完成但 summary 失败，仍然保存轮次数据
      if (speeches.length > 0) {
        try {
          const fallbackComments: AgentComment[] = speeches.map(speech => ({
            agentId: speech.agentId,
            agentName: speech.agentName,
            agentColor: discussion.agents.find(a => a.id === speech.agentId)?.color || 'bg-gray-500',
            content: speech.content,
            expanded: false,
            type: 'speech',
            sentiments: speech.sentiments,
            completedAt: speech.completedAt,
            toolCalls: dedupToolCalls(speech.toolCalls),
          }));
          const fallbackRound: RoundData = {
            roundIndex: 1,
            comments: fallbackComments,
            moderatorAnalysis: { round: 1, consensusLevel: 0, summary: '主持人分析生成失败，请继续讨论。', newPoints: [], consensus: [], disagreements: [] },
          };
          const updatedDiscussion = {
            ...discussion,
            rounds: [fallbackRound],
            comments: fallbackComments,
          };
          onUpdateDiscussion(updatedDiscussion);
          saveDiscussionToHistory(updatedDiscussion);
        } catch (saveErr) {
          console.error('Failed to save fallback round:', saveErr);
        }
      }

      setCurrentRoundStatus('idle');
      setCurrentSummaryText('');
      setCurrentRoundComments(new Map());
      alert(`讨论出现问题：${error instanceof Error ? error.message : '未知错误'}，已保存已完成的部分。`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = (roundIndex: number, commentKey: string) => {
    // 判断是否是当前正在进行的轮次（流式阶段）
    const isCurrentRoundInProgress =
      roundIndex === currentRoundIndex &&
      currentRoundStatus !== 'idle' &&
      currentRoundStatus !== 'complete';

    if (isCurrentRoundInProgress) {
      // 流式进行中：直接更新 currentRoundComments Map，不写入 discussion.rounds
      // 避免将流式阶段的快照写入 discussion.rounds 导致 getRounds() 返回冻结数据
      setCurrentRoundComments(prev => {
        const newMap = new Map(prev);
        // 模拟渲染时的 commentIdx：遍历 Map 值，跳过 user，按顺序编号
        let idx = 0;
        for (const [mapKey, comment] of newMap) {
          if (comment.agentId === 'user') continue;
          const key = `${comment.agentId}-${comment.type || 'speech'}-${comment.replyRound || 0}-${idx}`;
          if (key === commentKey) {
            newMap.set(mapKey, { ...comment, expanded: !(comment.expanded ?? false) });
            break;
          }
          idx++;
        }
        return newMap;
      });
      return; // 不写入 discussion.rounds，避免污染已完成轮次数据
    }

    // 已完成的轮次：更新 discussion.rounds（原有逻辑）
    const updatedRounds = rounds.map(round => {
      if (round.roundIndex === roundIndex) {
        return {
          ...round,
          comments: round.comments.map((comment, idx) => {
            const key = `${comment.agentId}-${comment.type || 'speech'}-${comment.replyRound || 0}-${idx}`;
            return key === commentKey
              ? { ...comment, expanded: !(comment.expanded ?? false) }
              : { ...comment, expanded: comment.expanded ?? false };
          }),
        };
      }
      return round;
    });
    
    // 更新 discussion，保持向后兼容
    const latestRound = updatedRounds[updatedRounds.length - 1];
    const updatedDiscussion = {
      ...discussion,
      rounds: updatedRounds,
      comments: latestRound.comments,
      moderatorAnalysis: latestRound.moderatorAnalysis,
    };
    onUpdateDiscussion(updatedDiscussion);
    // 同步保存到localStorage
    saveDiscussionToHistory(updatedDiscussion);
  };

  const scrollToBottom = () => {
    // 立即隐藏按钮
    setShowScrollToBottom(false);
    setUserScrolledUp(false);
    
    // 标记正在滚动到底部，防止滚动过程中按钮闪烁
    isScrollingToBottomRef.current = true;
    
    // 优先滚动 contentRef（如果内容区域有滚动）
    if (contentRef.current && contentRef.current.scrollHeight > contentRef.current.clientHeight) {
      contentRef.current.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' });
    } else {
      // 滚动 window
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    
    // 滚动完成后重置标记
    setTimeout(() => {
      isScrollingToBottomRef.current = false;
    }, 800); // 800ms 足够完成平滑滚动
  };

  // 处理历史话题选择
  const handleSelectHistoryTopic = (discussion: Discussion) => {
    // 直接使用保存的完整讨论数据，恢复上次的讨论状态
    onUpdateDiscussion(discussion);
  };

  const toggleSummaryCollapsed = (roundIndex: number) => {
    setCollapsedSummary(prev => ({
      ...prev,
      [roundIndex]: !prev[roundIndex],
    }));
  };

  const getPreviewText = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.slice(0, 3).join('\n') + (lines.length > 3 ? '...' : '');
  };

  // 存储当前轮次的prompts
  const currentRoundPromptsRef = useRef<{
    agents: Array<{ agentId: string; agentName: string; systemPrompt: string; userPrompt: string }>;
    moderator?: { systemPrompt: string; userPrompt: string };
  }>({ agents: [] });

  // 处理流式响应的辅助函数
  const handleStreamResponse = async (
    response: Response,
    agentId: string,
    agentName: string,
    agentColor: string,
    updateContent: (content: string, targetAgentId?: string, targetAgentName?: string, systemPrompt?: string, userPrompt?: string, sentiments?: StockSentiment[], streamStatus?: 'thinking' | 'typing' | 'tool_calling', toolCalls?: ToolCallRecord[], activeToolCall?: string) => void
  ): Promise<{ content: string; targetAgentId?: string; targetAgentName?: string; systemPrompt?: string; userPrompt?: string; sentiments?: StockSentiment[]; toolCalls?: ToolCallRecord[] }> => {
    if (!response.ok) {
      const agentNameSafe = agentName || 'Unknown Agent';
      throw new Error(`Failed to get response for ${agentNameSafe}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let targetAgentId: string | undefined;
    let targetAgentName: string | undefined;
    let savedSystemPrompt: string | undefined;
    let savedUserPrompt: string | undefined;
    let sentiments: StockSentiment[] | undefined;
    let hasReceivedChunk = false;
    const collectedToolCalls: ToolCallRecord[] = [];

    if (!reader) {
      throw new Error('Failed to get response stream');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line || typeof line !== 'string') continue;
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              
              const data = JSON.parse(jsonStr);
              
              if (!data || typeof data !== 'object') continue;

              if (data.type === 'start') {
                // 收到 start 事件 → "thinking..." 状态
                updateContent('', undefined, undefined, undefined, undefined, undefined, 'thinking');
              } else if (data.type === 'tool_call') {
                // 工具调用开始 → "tool_calling" 状态
                updateContent(fullContent, targetAgentId, targetAgentName, undefined, undefined, undefined, 'tool_calling', collectedToolCalls, data.toolName);
              } else if (data.type === 'tool_result') {
                // 工具调用完成 → 记录结果，保持 tool_calling 状态直到文本内容开始流式输出
                collectedToolCalls.push({ toolName: data.toolName, args: data.args || {}, result: data.result });
                updateContent(fullContent, targetAgentId, targetAgentName, undefined, undefined, undefined, 'tool_calling', collectedToolCalls, data.toolName);
              } else if (data.type === 'chunk') {
                const chunkContent = data.content || '';
                fullContent += chunkContent;
                hasReceivedChunk = true;
                // 实时更新 UI（打字机效果）— 隐藏 [SENTIMENT] 和 DSML 标记
                const sentimentIdx = fullContent.indexOf('[SENTIMENT]');
                let displayContent = sentimentIdx !== -1 ? fullContent.substring(0, sentimentIdx).trim() : fullContent;
                // Strip DSML function call blocks (DeepSeek native format fallback)
                const dsmlIdx = displayContent.search(/<[^>]*(?:function_calls|DSML)[^>]*>/i);
                if (dsmlIdx !== -1) displayContent = displayContent.substring(0, dsmlIdx).trim();
                // If SENTIMENT detected, main visible content is complete — stop showing "typing"
                const effectiveStatus = sentimentIdx !== -1 ? undefined : 'typing';
                updateContent(displayContent, targetAgentId, targetAgentName, undefined, undefined, undefined, effectiveStatus, collectedToolCalls.length > 0 ? collectedToolCalls : undefined, undefined);
              } else if (data.type === 'done') {
                // 后端已经去掉了 [SENTIMENT] 标记，直接用干净的内容
                let doneContent = data.speech || data.review || data.reply || fullContent || '';
                // 兜底：剥离可能残留的 DSML 标记（与 chunk 处理器一致）
                const doneDsmlIdx = doneContent.search(/<[^>]*(?:function_calls|DSML|invoke)[^>]*>/i);
                if (doneDsmlIdx !== -1) doneContent = doneContent.substring(0, doneDsmlIdx).trim();
                const doneSentimentIdx = doneContent.indexOf('[SENTIMENT]');
                if (doneSentimentIdx !== -1) doneContent = doneContent.substring(0, doneSentimentIdx).trim();
                fullContent = doneContent;
                if (data.targetAgentId && data.targetAgentName) {
                  targetAgentId = String(data.targetAgentId);
                  targetAgentName = String(data.targetAgentName);
                }
                if (data.systemPrompt && data.userPrompt) {
                  savedSystemPrompt = String(data.systemPrompt);
                  savedUserPrompt = String(data.userPrompt);
                }
                if (data.sentiments && Array.isArray(data.sentiments) && data.sentiments.length > 0) {
                  sentiments = data.sentiments;
                }
                // 合并后端返回的 toolCalls（如果有）
                if (data.toolCalls && Array.isArray(data.toolCalls)) {
                  // 优先用后端返回的完整 toolCalls
                  collectedToolCalls.length = 0;
                  collectedToolCalls.push(...data.toolCalls);
                }
                // 最终更新 UI — 不传 streamStatus 表示完成
                updateContent(fullContent, targetAgentId, targetAgentName, savedSystemPrompt, savedUserPrompt, sentiments, undefined, collectedToolCalls.length > 0 ? collectedToolCalls : undefined, undefined);
              } else if (data.type === 'error') {
                const errorMessage = data.error ? String(data.error) : 'Unknown error occurred';
                throw new Error(errorMessage);
              }
            } catch (e) {
              // 让 AbortError 向上传播，不在此处吞掉
              if (e instanceof DOMException && e.name === 'AbortError') throw e;
              console.error('Error parsing SSE data:', e);
              console.error('Problematic line:', line);
            }
          }
        }
      }
    } catch (e) {
      // AbortError 向上传播给调用方（startNextRound 的 catch 块）
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // 其他 reader 错误也向上传播
      throw e;
    }

    return { content: fullContent, targetAgentId, targetAgentName, systemPrompt: savedSystemPrompt, userPrompt: savedUserPrompt, sentiments, toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined };
  };

  // 开始新一轮讨论（第二轮+：每个Agent单次发言 -> 总结）
  // 新架构：不再有针对性回复阶段，Agent在单次发言中组合回应用户+回应分歧
  const startNextRound = async (roundIndex: number, userQuestion?: string, userMentionedAgentIds?: string[]) => {
    if (!discussion.id || !discussion.sessionData || isLoading) return;

    // 创建 AbortController，用于支持用户中止（第2轮+）
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setCurrentRoundIndex(roundIndex);
    currentRoundPromptsRef.current = { agents: [] };
    setCurrentRoundComments(new Map());

    // 记录用户提问时间
    const userQuestionTimestamp = userQuestion ? Date.now() : 0;

    // 如果有用户提问，先添加用户消息到 currentRoundComments
    if (userQuestion) {
      setCurrentRoundComments(prev => {
        const newMap = new Map(prev);
        newMap.set('__user__', {
          agentId: 'user',
          agentName: '你',
          agentColor: 'bg-blue-500',
          content: userQuestion,
          expanded: true,
          type: 'user',
          mentionedAgentIds: userMentionedAgentIds,
          completedAt: userQuestionTimestamp,
        });
        return newMap;
      });
    }

    const speeches: Array<{ agentId: string; agentName: string; content: string; sentiments?: StockSentiment[]; toolCalls?: ToolCallRecord[]; completedAt?: number }> = [];

    try {
      const sessionData = discussion.sessionData;

      // 为每个 agent 查找本轮之前最近一次的发言（支持中止轮次后上下文不丢失）
      const previousRoundComments = discussion.agents
        .map(agent => {
          for (let i = rounds.length - 1; i >= 0; i--) {
            const comment = rounds[i].comments.find(
              c => c.agentId === agent.id && c.type !== 'user'
            );
            if (comment) {
              return {
                agentId: comment.agentId,
                agentName: comment.agentName,
                content: comment.content,
              };
            }
          }
          return null;
        })
        .filter((c): c is { agentId: string; agentName: string; content: string } => c !== null);

      // ===== 每个Agent依次发言（单次speech，包含回应用户+回应分歧） =====
      setCurrentRoundStatus('speech');

      // 按 @ 顺序重排：被 @ 的 agent 优先发言，未 @ 的保持原序排在后面
      let orderedAgents = discussion.agents;
      if (userMentionedAgentIds && userMentionedAgentIds.length > 0) {
        const mentioned = userMentionedAgentIds
          .map(id => discussion.agents.find(a => a.id === id))
          .filter((a): a is typeof discussion.agents[number] => !!a);
        const notMentioned = discussion.agents.filter(a => !userMentionedAgentIds.includes(a.id));
        orderedAgents = [...mentioned, ...notMentioned];
      }

      for (const agent of orderedAgents) {
        // 主动检查是否已中止（避免发起不必要的 fetch）
        if (abortController.signal.aborted) break;

        const response = await fetch(getApiUrl('/api/agents/speech/stream'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: discussion.id,
            agentId: agent.id,
            roundIndex,
            sessionData,
            previousRoundComments,
            // 新参数：传递用户提问和@的Agent
            userQuestion: userQuestion || undefined,
            userMentionedAgentIds: userMentionedAgentIds && userMentionedAgentIds.length > 0 ? userMentionedAgentIds : undefined,
          }),
          signal: abortController.signal,
        });

        const speech = await handleStreamResponse(
          response,
          agent.id,
          agent.name || 'Unknown Agent',
          agent.color || 'bg-gray-500',
          (content, targetId, targetName, _systemPrompt, _userPrompt, sentimentsData, streamStatus, toolCallsData, activeToolCallData) => {
            setCurrentRoundComments(prev => {
              const newMap = new Map(prev);
              newMap.set(agent.id, {
                agentId: agent.id,
                agentName: agent.name || 'Unknown Agent',
                agentColor: agent.color || 'bg-gray-500',
                content: content || '',
                expanded: false,
                type: 'speech',
                targetAgentId: targetId,
                targetAgentName: targetName,
                sentiments: sentimentsData,
                streamStatus,
                toolCalls: toolCallsData,
                activeToolCall: activeToolCallData,
              });
              return newMap;
            });
          }
        );

        const speechCompletedAt = Date.now();

        // 更新完成状态
        setCurrentRoundComments(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(agent.id);
          if (existing) {
            newMap.set(agent.id, { ...existing, streamStatus: undefined, completedAt: speechCompletedAt, toolCalls: speech.toolCalls || existing.toolCalls });
          }
          return newMap;
        });

        // 保存agent的prompts
        if (speech.systemPrompt && speech.userPrompt) {
          currentRoundPromptsRef.current.agents.push({
            agentId: agent.id,
            agentName: agent.name || 'Unknown Agent',
            systemPrompt: speech.systemPrompt,
            userPrompt: speech.userPrompt,
          });
        }

        speeches.push({
          agentId: agent.id,
          agentName: agent.name || 'Unknown Agent',
          content: speech.content,
          sentiments: speech.sentiments,
          toolCalls: speech.toolCalls,
          completedAt: speechCompletedAt,
        });

        // 每个 agent 完成后再次检查是否已中止
        if (abortController.signal.aborted) break;
      }

      // 如果 for 循环因 abort break 出来（所有 agent 都完成了但 signal 被设置），跳过 summary
      if (abortController.signal.aborted) {
        throw new DOMException('Discussion aborted by user', 'AbortError');
      }

      // ===== 流式请求主持人总结 =====
      setCurrentRoundStatus('summary');
      setCurrentSummaryText('');

      const summaryResponse = await fetch(getApiUrl('/api/rounds/summary/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: discussion.id,
          roundIndex,
          agentsSpeeches: speeches.map(s => ({ agentId: s.agentId, agentName: s.agentName, speech: s.content })),
          agentsReviews: [],
          agentsReplies: [],
          sessionData,
          ...(userQuestion ? { userQuestion } : {}),
          // 原始发言数据（含 toolCalls / sentiments），由后端持久化，用于历史恢复
          rawSpeeches: speeches.map(s => ({
            agentId: s.agentId,
            agentName: s.agentName,
            content: s.content,
            sentiments: s.sentiments,
            toolCalls: dedupToolCalls(s.toolCalls),
            completedAt: s.completedAt,
          })),
          // 用户提问附加数据
          ...(userQuestion ? {
            userMentionedAgentIds: userMentionedAgentIds && userMentionedAgentIds.length > 0 ? userMentionedAgentIds : undefined,
            userQuestionTime: userQuestionTimestamp || Date.now(),
          } : {}),
        }),
        signal: abortController.signal,
      });

      const { roundSummary, updatedSession } = await handleSummaryStream(summaryResponse);

      // 收集所有 comments
      setCurrentRoundComments(prev => {
        const allComments: AgentComment[] = speeches.map(s => ({
          agentId: s.agentId,
          agentName: s.agentName,
          agentColor: discussion.agents.find(a => a.id === s.agentId)?.color || 'bg-gray-500',
          content: s.content,
          expanded: false,
          type: 'speech' as const,
          sentiments: s.sentiments,
          toolCalls: dedupToolCalls(s.toolCalls),
          completedAt: s.completedAt,
        }));

        const agentSentimentsForSummary = speeches.map(s => ({ agentName: s.agentName, sentiments: s.sentiments }));
        const moderatorAnalysis = buildModeratorAnalysis(roundSummary, roundIndex, agentSentimentsForSummary);

        const newRound: RoundData = {
          roundIndex: roundSummary.roundIndex || roundSummary.round || roundIndex,
          comments: allComments,
          moderatorAnalysis,
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
            moderator: currentRoundPromptsRef.current.moderator,
          },
          ...(userQuestion ? {
            userQuestion,
            userMentionedAgentIds: userMentionedAgentIds && userMentionedAgentIds.length > 0 ? userMentionedAgentIds : undefined,
            userQuestionTime: userQuestionTimestamp || Date.now(),
          } : {}),
        };

        const updatedRounds = [...rounds, newRound];

        // 同第一轮逻辑：将状态清空与 onUpdateDiscussion 放入同一批次，
        // 防止 getRounds() 在中间状态返回缺失当前轮数据导致滚动跳顶
        setTimeout(() => {
          const updatedDiscussion = {
            ...discussion,
            rounds: updatedRounds,
            comments: allComments,
            sessionData: updatedSession,
            moderatorAnalysis,
          };
          onUpdateDiscussion(updatedDiscussion);
          saveDiscussionToHistory(updatedDiscussion);
          setCurrentRoundStatus('complete');
          setCurrentSummaryText('');
          setCurrentRoundComments(new Map());
        }, 0);

        return prev;
      });
    } catch (error) {
      // 区分用户主动中止和其他错误
      const isAbort = error instanceof DOMException && error.name === 'AbortError';

      if (isAbort && speeches.length > 0) {
        // 用户中止且有已完成的发言 → 保存为部分轮次
        console.log(`[startNextRound] Aborted at round ${roundIndex}, saving ${speeches.length} completed speeches`);
        const completedComments: AgentComment[] = speeches.map(s => ({
          agentId: s.agentId,
          agentName: s.agentName,
          agentColor: discussion.agents.find(a => a.id === s.agentId)?.color || 'bg-gray-500',
          content: s.content,
          expanded: false,
          type: 'speech' as const,
          sentiments: s.sentiments,
          toolCalls: dedupToolCalls(s.toolCalls),
          completedAt: s.completedAt,
        }));

        const partialRound: RoundData = {
          roundIndex,
          comments: completedComments,
          moderatorAnalysis: {
            round: roundIndex,
            consensusLevel: 0,
            summary: '本轮讨论被用户中止，以下为已完成的发言。',
            newPoints: [],
            consensus: [],
            disagreements: [],
          },
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
          },
          ...(userQuestion ? {
            userQuestion,
            userMentionedAgentIds: userMentionedAgentIds && userMentionedAgentIds.length > 0 ? userMentionedAgentIds : undefined,
            userQuestionTime: userQuestionTimestamp || Date.now(),
          } : {}),
          aborted: true,
        };

        const updatedRounds = [...rounds, partialRound];
        const updatedDiscussion = {
          ...discussion,
          rounds: updatedRounds,
          comments: completedComments,
        };
        onUpdateDiscussion(updatedDiscussion);
        saveDiscussionToHistory(updatedDiscussion);

        setCurrentRoundStatus('complete');
        setCurrentSummaryText('');
        setSummaryStreamStatus(null);
        setCurrentRoundComments(new Map());
      } else if (isAbort) {
        // 用户中止但无已完成发言 → 完全丢弃
        console.log(`[startNextRound] Aborted at round ${roundIndex}, no completed speeches, discarding`);
        setCurrentRoundStatus('idle');
        setCurrentSummaryText('');
        setSummaryStreamStatus(null);
        setCurrentRoundComments(new Map());
      } else {
        // 其他错误：保持原有逻辑
        console.error('Error starting next round:', error);
        setCurrentRoundStatus('idle');
        setCurrentSummaryText('');
        setCurrentRoundComments(new Map());
        alert(`继续讨论失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // ===================== 用户输入相关 =====================

  const parseMentions = (text: string): string[] => {
    // 按名字长度降序做贪心匹配，但记录首次出现位置用于排序
    const agentNames = discussion.agents.map(a => a.name).filter(Boolean).sort((a, b) => b.length - a.length);
    const found: { id: string; index: number }[] = [];
    const seenIds = new Set<string>();
    for (const name of agentNames) {
      const idx = text.indexOf(`@${name}`);
      if (idx !== -1) {
        const agent = discussion.agents.find(a => a.name === name);
        if (agent && !seenIds.has(agent.id)) {
          seenIds.add(agent.id);
          found.push({ id: agent.id, index: idx });
        }
      }
    }
    // 按文本中首次 @ 的位置升序排列，确保返回顺序与用户输入一致
    found.sort((a, b) => a.index - b.index);
    return found.map(f => f.id);
  };

  const buildHistoryContext = (): string => {
    const latestRound = rounds[rounds.length - 1];
    if (!latestRound) return '暂无之前的讨论内容';
    const parts: string[] = [];
    if (latestRound.moderatorAnalysis?.summary) {
      parts.push(`【第${latestRound.roundIndex}轮讨论总结】\n${latestRound.moderatorAnalysis.summary}`);
    }
    const agentSummary = latestRound.comments
      .filter(c => c.type === 'speech' || c.type === 'reply' || !c.type)
      .map(c => `- ${c.agentName}: ${c.content.substring(0, 100)}${c.content.length > 100 ? '...' : ''}`)
      .join('\n');
    if (agentSummary) {
      parts.push(`【各专家核心观点】\n${agentSummary}`);
    }
    return parts.join('\n\n') || '暂无之前的讨论内容';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setUserInput(value);
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ' || textBeforeCursor[atIndex - 1] === '\n')) {
      const filterText = textBeforeCursor.substring(atIndex + 1);
      if (!filterText.includes(' ') && !filterText.includes('\n')) {
        setShowMentionPopup(true);
        setMentionFilter(filterText);
        setMentionCursorPos(atIndex);
        return;
      }
    }
    setShowMentionPopup(false);
  };

  const handleSelectMention = (agent: Agent) => {
    const before = userInput.substring(0, mentionCursorPos);
    const after = userInput.substring(mentionCursorPos + 1 + mentionFilter.length);
    const newValue = `${before}@${agent.name} ${after}`;
    setUserInput(newValue);
    setShowMentionPopup(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = mentionCursorPos + agent.name.length + 2;
        textareaRef.current.focus();
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
      }
    }, 0);
  };

  /**
   * 处理用户发送提问 — 作为一轮"继续讨论"（有用户输入的情况）
   * 直接调用 startNextRound 并传入 userQuestion
   */
  const handleUserSend = async () => {
    const message = userInput.trim();
    if (!message || !discussion.id || isLoading) return;

    const mentionedAgentIds = parseMentions(message);
    setUserInput('');
    setIsInputMultiLine(false);
    setShowMentionPopup(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.style.overflow = 'hidden';
    }

    const nextRoundIndex = rounds.length > 0
      ? Math.max(...rounds.map(r => r.roundIndex)) + 1
      : 1;

    await startNextRound(nextRoundIndex, message, mentionedAgentIds);
  };

  const handleContinueDiscussion = async () => {
    if (!discussion.id || isLoading) return;
    
    // 计算下一轮的索引
    const nextRoundIndex = rounds.length > 0 
      ? Math.max(...rounds.map(r => r.roundIndex)) + 1
      : 1;
    
    await startNextRound(nextRoundIndex);
  };

  // 中止当前讨论（仅第2轮+支持）
  const handleStopDiscussion = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // 分享报告 — html-to-image 截图（使用 SVG foreignObject，天然支持所有 CSS）
  const handleShareReport = async () => {
    const scrollEl = summaryScrollRef.current;
    if (!scrollEl) { alert('内容区域未就绪'); return; }
    setIsGeneratingImage(true);

    // 截图前：临时禁用 text-size-adjust（移动端 113% 放大会导致截图中文字溢出换行）
    const htmlEl = document.documentElement;
    const savedTextSizeAdjust = htmlEl.style.getPropertyValue('-webkit-text-size-adjust');
    htmlEl.style.setProperty('-webkit-text-size-adjust', 'none');
    htmlEl.style.setProperty('text-size-adjust', 'none');

    try {
      // Logo 和免责声明已作为常驻 React 元素包含在 summaryScrollRef 内，无需动态注入

      // 临时解除滚动容器的 overflow 限制，让内容完全展开
      const saved = {
        overflow: scrollEl.style.overflow,
        maxHeight: scrollEl.style.maxHeight,
        height: scrollEl.style.height,
        flex: scrollEl.style.flex,
      };
      scrollEl.style.overflow = 'visible';
      scrollEl.style.maxHeight = 'none';
      scrollEl.style.height = 'auto';
      scrollEl.style.flex = 'none';

      // 截图时临时增大 Logo 顶部间距 → 模拟手机安全区域高度
      const logoEl = logoWrapRef.current;
      const savedLogoPt = logoEl ? logoEl.style.paddingTop : '';
      if (logoEl) logoEl.style.paddingTop = `${safeAreaTop}px`;

      // 等三帧让浏览器完成布局（移动端 Safari 需要更多帧确保渲染）
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));

      // 解析 CSS 变量为实际颜色值（移动端 Safari 不支持 toPng 直接使用 CSS 变量）
      const computedBg = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-bg-empty').trim() || '#FAFAFA';

      // Safari 双次渲染 workaround：第一次"预热"（Safari 首次渲染常缺失图片），第二次取结果
      await toPng(scrollEl, { pixelRatio: 1, backgroundColor: computedBg });

      // 使用 toBlob 直接生成 Blob（供分享按钮同步使用，避免 async fetch 破坏手势上下文）
      const blob = await toBlob(scrollEl, {
        pixelRatio: 2,
        backgroundColor: computedBg,
      });

      // 恢复滚动容器样式
      scrollEl.style.overflow = saved.overflow;
      scrollEl.style.maxHeight = saved.maxHeight;
      scrollEl.style.height = saved.height;
      scrollEl.style.flex = saved.flex;
      // 恢复 Logo 顶部间距
      if (logoEl) logoEl.style.paddingTop = savedLogoPt;

      if (blob) {
        setShareImageBlob(blob);
        setShareImageUrl(URL.createObjectURL(blob));
      } else {
        throw new Error('toBlob 返回 null');
      }
    } catch (err: unknown) {
      console.error('截图失败:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert('生成图片失败: ' + msg);
    } finally {
      // 恢复 text-size-adjust
      if (savedTextSizeAdjust) {
        htmlEl.style.setProperty('-webkit-text-size-adjust', savedTextSizeAdjust);
        htmlEl.style.setProperty('text-size-adjust', savedTextSizeAdjust);
      } else {
        htmlEl.style.removeProperty('-webkit-text-size-adjust');
        htmlEl.style.removeProperty('text-size-adjust');
      }
      setIsGeneratingImage(false);
    }
  };

  // 保存长图（移动端调起系统分享面板 → 用户可选"存储图像"保存到相册；桌面端直接下载）
  // 关键：使用预存的 shareImageBlob，同步创建 File，确保 navigator.share 在用户手势窗口内被调用
  const handleDownloadImage = async () => {
    if (!shareImageBlob || !shareImageUrl) return;
    // 仅移动端（<640px）使用 navigator.share，桌面端直接下载
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (isMobile && navigator.share) {
      try {
        const file = new File([shareImageBlob], `leapcat.ai-${discussion.title}.png`, { type: 'image/png' });
        await navigator.share({ files: [file], title: '分析报告' });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('navigator.share 失败，降级为下载:', err);
      }
    }
    // 桌面端：直接下载
    const link = document.createElement('a');
    link.download = `leapcat.ai-${discussion.title}.png`;
    link.href = shareImageUrl;
    link.click();
  };

  // 分享图片（移动端调起系统分享面板；桌面端复制到剪贴板）
  const handleNativeShare = async () => {
    if (!shareImageBlob || !shareImageUrl) return;
    // 仅移动端（<640px）使用 navigator.share，桌面端走剪贴板
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (isMobile && navigator.share) {
      try {
        const file = new File([shareImageBlob], `leapcat.ai-${discussion.title}.png`, { type: 'image/png' });
        await navigator.share({ files: [file], title: '分析报告' });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('navigator.share 失败，尝试剪贴板:', err);
      }
    }
    // 桌面端 fallback：复制图片到剪贴板
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const pngBlob = new Blob([shareImageBlob], { type: 'image/png' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch (clipErr) {
      console.warn('剪贴板复制失败:', clipErr);
    }
    // 最终 fallback：直接下载
    handleDownloadImage();
  };

  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--color-bg-empty)' }}>
      {/* 历史话题抽屉 */}
      <HistoryTopicsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectTopic={handleSelectHistoryTopic}
        isLoading={isLoading}
      />

      {/* Header — 顶栏磨砂背景只覆盖标题区域 */}
      <div className="absolute top-0 left-0 right-0 z-40">
        {/* 顶栏标题区 — 有独立磨砂背景 */}
        <div className="relative">
          <div className="absolute inset-0 backdrop-blur-2xl" style={{ background: `linear-gradient(to bottom, var(--color-glass-light), var(--color-glass-subtle), var(--color-glass-faint))` }} />
          <div className="relative flex items-center justify-between px-5 py-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Menu className="w-5 h-5 text-content-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-[17px] font-medium text-content-primary flex-1 text-center px-2 truncate whitespace-nowrap overflow-hidden">{discussion.title}</h1>
            <button
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform"
            >
              <PenSquare className="w-5 h-5 text-content-primary" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* AnalysisReportEntry — 独立层，不受顶栏磨砂遮挡 */}
        {(() => {
          const completedRounds = rounds.filter(r => !(r as any)._isInProgress && r.moderatorAnalysis?.consensusLevel > 0);
          if (completedRounds.length === 0) return null;
          const latestCompleted = completedRounds[completedRounds.length - 1];
          return (
            <div className="px-5 py-1.5">
              <button
                onClick={() => { setSummaryRoundIndex(latestCompleted.roundIndex); setShowSummary(true); }}
                className="w-full rounded-2xl px-4 py-0 h-10 border border-[#AAE874]/25 active:scale-[0.98] transition-all duration-200 flex items-center gap-3 group shadow-[0_2px_8px_rgba(170,232,116,0.12)]"
                style={{ background: 'linear-gradient(135deg, var(--color-report-btn-from), var(--color-report-btn-to))' }}
              >
                <FileText className="w-4 h-4 text-[#7BC74D] flex-shrink-0" strokeWidth={2} />
                <span className="text-[14px] font-bold text-[#5BB536]">分析报告</span>
                <span className="px-2 py-0.5 bg-gradient-to-r from-[#AAE874]/20 to-[#7BC74D]/15 text-[10px] text-[#7BC74D] font-bold rounded-full">
                  第 {latestCompleted.roundIndex} 轮
                </span>
                <span className="flex-1" />
                <ChevronRight className="w-4 h-4 text-[#7BC74D] group-hover:translate-x-0.5 transition-all duration-200" strokeWidth={2.5} />
              </button>
            </div>
          );
        })()}
      </div>

      {/* Content — 全屏滚动，paddingTop 留出顶栏+分析报告按钮高度，滚动后内容从 header 磨砂层后面穿过 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-28" style={{ paddingTop: rounds.length > 0 && rounds.some(r => r.moderatorAnalysis?.consensusLevel > 0) ? '108px' : '64px' }}>
        <div className="space-y-0 pb-4">
          {/* 讨论轮次（包含用户自由提问触发的轮次） */}
          {rounds.map((round, roundIdx) => (
            <div key={`round-${round.roundIndex}-${roundIdx}`}>
              {/* 轮次分隔 - 居中胶囊 */}
              <div className="flex justify-center py-4">
                <span className="px-4 py-1.5 bg-[#AAE874]/15 text-[#AAE874] text-[12px] font-bold rounded-full">
                  第 {round.roundIndex} 轮
                </span>
              </div>

              {/* 用户提问气泡（如果本轮由用户提问触发） */}
              {round.userQuestion && (() => {
                const userTime = (round as any).userQuestionTime;
                return (
                <div className="flex justify-end gap-3 px-5 py-3">
                  <div className="max-w-[80%]">
                    <div className="flex items-baseline justify-end gap-2 mb-1.5">
                      {userTime && <span className="text-[11px] text-content-placeholder font-normal">{formatTime(userTime)}</span>}
                      <span className="text-[14px] font-bold text-content-primary">你</span>
                    </div>
                    <div className="bg-[#AAE874]/20 border border-[#AAE874]/30 rounded-2xl rounded-tr-sm px-4 py-3">
                      <div className="text-[14px] text-content-primary leading-relaxed whitespace-pre-wrap break-words">
                        {renderContentWithMentions(round.userQuestion, discussion.agents)}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <span className="text-white text-[14px] font-bold">你</span>
                  </div>
                </div>
                );
              })()}

              {/* Agent Comments - Figma ChatBubble 风格 */}
              {round.comments.map((comment, commentIdx) => {

                return (
                <div key={`${round.roundIndex}-${comment.agentId}-${comment.type || 'speech'}-${comment.replyRound || 0}-${commentIdx}`} className="flex gap-3 px-5 py-4">
                  {/* 头像 + 工具图标列 */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                    <AgentAvatar type={getAvatarTypeById(comment.agentId, discussion.agents)} size={36} />
                    {/* 工具图标（竖向排列在头像下方，流式中和完成后均显示） */}
                    {comment.toolCalls && comment.toolCalls.length > 0 && (
                      comment.toolCalls.map((tc, tcIdx) => {
                        const tipKey = `${roundIdx}-${commentIdx}-${tcIdx}`;
                        return (
                          <div key={tcIdx} className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveToolTip(prev => prev === tipKey ? null : tipKey); }}>
                            {getToolIcon(tc.toolName, 20)}
                            {activeToolTip === tipKey && (
                              <div className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap bg-surface-card text-content-primary text-[12px] px-3 py-1.5 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.1)] border border-line-light pointer-events-auto" style={{ minWidth: 'max-content' }}>
                                <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-white" />
                                用到 {toolDisplayNames[tc.toolName] || tc.toolName} 工具
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {/* 名称 + 状态 + 气泡 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <h4 className="text-[14px] font-bold text-content-primary">{comment.agentName}</h4>
                      {/* 流式状态指示 / 完成时间 */}
                      {comment.streamStatus === 'tool_calling' ? (
                        <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                          使用{comment.activeToolCall ? (toolDisplayNames[comment.activeToolCall] || comment.activeToolCall) : '工具'}中
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      ) : comment.streamStatus === 'thinking' ? (
                        <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                          思考中
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      ) : comment.streamStatus === 'typing' ? (
                        <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                          输入中
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      ) : comment.completedAt ? (
                        <span className="text-[11px] text-content-placeholder font-normal">{formatTime(comment.completedAt)}</span>
                      ) : null}
                    </div>
                    {/* 气泡：thinking/tool_calling状态显示占位气泡，有内容时显示正常气泡 */}
                    {comment.streamStatus === 'thinking' && !comment.content ? (
                      <div className={`${BUBBLE_BG} rounded-2xl rounded-tl-sm px-4 py-3 border border-line-light`}>
                        <div className="flex gap-1.5 py-1">
                          <span className="w-2 h-2 bg-content-icon rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-content-icon rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-content-icon rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    ) : comment.streamStatus === 'tool_calling' && !comment.content ? (
                      <div className={`${BUBBLE_BG} rounded-2xl rounded-tl-sm px-4 py-3 border border-amber-200`}>
                        <div className="flex items-center gap-2 text-[13px] text-amber-600">
                          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          <span>正在{comment.activeToolCall ? (toolDisplayNames[comment.activeToolCall] || '调用工具') : '查询数据'}...</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`${BUBBLE_BG} rounded-2xl rounded-tl-sm px-4 py-3 border border-line-light`}>
                        <div className="text-[14px] text-content-primary leading-relaxed whitespace-pre-wrap break-words">
                          {renderContentWithMentions(comment.content, discussion.agents)}
                          {comment.streamStatus === 'typing' && <span className="inline-block w-0.5 h-4 bg-[#AAE874] ml-0.5 animate-pulse" />}
                        </div>
                      </div>
                    )}
                    {/* 情绪标签 — SVG 图标风格 */}
                    {comment.sentiments && comment.sentiments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {comment.sentiments.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              s.sentiment === 'bullish'
                                ? 'bg-[#E05454]/10 text-[#E05454] border border-[#E05454]/20'
                                : s.sentiment === 'bearish'
                                ? 'bg-[#2EA66E]/10 text-[#2EA66E] border border-[#2EA66E]/20'
                                : 'bg-surface-bubble text-content-muted border border-line-light'
                            }`}
                          >
                            {s.sentiment === 'bullish' ? <BullishIcon size={12} /> : s.sentiment === 'bearish' ? <BearishIcon size={12} /> : <NeutralIcon size={12} />}
                            <span>{s.stock}</span>
                            <span>{s.sentiment === 'bullish' ? '看涨' : s.sentiment === 'bearish' ? '看跌' : '中性'}</span>
                            {s.confidence && (
                              <span className="opacity-50 text-[10px]">
                                {s.confidence === 'high' ? '●●●' : s.confidence === 'medium' ? '●●○' : '●○○'}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}

              {/* 中止轮次标识 */}
              {(round as any).aborted && (
                <div className="mx-5 my-3 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#E05454]/10 border border-[#E05454]/20">
                  <Square className="w-3.5 h-3.5 text-[#E05454] fill-[#E05454]" strokeWidth={0} />
                  <span className="text-[13px] text-[#E05454] font-medium">本轮讨论已中止</span>
                </div>
              )}

              {/* Moderator Analysis - 参照 Figma 图片布局 */}
              {!(round as any).aborted && (!(round as any)._isInProgress || (round as any)._showModerator) && (() => {
                const isStreaming = !!(round as any)._summaryStreamStatus;
                if (!round.moderatorAnalysis && !isStreaming) return null;
                const isComplete = !isStreaming && (round.moderatorAnalysis?.consensusLevel ?? 0) > 0;
                const cl = round.moderatorAnalysis?.consensusLevel ?? 0;
                const isModeratorCollapsed = !!collapsedModerator[round.roundIndex];
                return (
              <div className="mx-5 my-4">
                <div className="relative">
                  {/* Outer Glow */}
                  <div className="absolute inset-0 bg-[#AAE874] opacity-[0.08] blur-3xl rounded-[32px]" />

                  {/* Card Container */}
                  <div className="relative bg-surface-card rounded-[28px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden border border-line-light">
                    {/* Card Header — 可点击折叠 */}
                    <div
                      className="px-5 py-4 flex items-center justify-between cursor-pointer active:bg-surface-empty transition-colors"
                      onClick={() => setCollapsedModerator(prev => ({ ...prev, [round.roundIndex]: !prev[round.roundIndex] }))}
                    >
                      <div className="flex items-center gap-2.5">
                        <img src="/brand-avatar.png" alt="主持人" className="w-8 h-8 rounded-full object-cover" />
                        <h2 className="text-[15px] font-bold text-content-primary leading-tight">主持人分析</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 流式状态（统一为一个指示器） */}
                        {isStreaming && (
                          <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                            分析中
                            <span className="inline-flex gap-0.5">
                              <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          </span>
                        )}
                        {/* 第X轮标签 */}
                        <span className="px-2.5 py-1 bg-[#AAE874]/15 text-[11px] text-[#7BC74D] font-semibold rounded-full">
                          第 {round.roundIndex} 轮
                        </span>
                        {/* 折叠/展开 chevron */}
                        <ChevronDown className={`w-5 h-5 text-content-placeholder transition-transform duration-200 ${isModeratorCollapsed ? '' : 'rotate-180'}`} />
                      </div>
                    </div>

                    {/* 可折叠内容区 */}
                    {!isModeratorCollapsed && (
                      <>
                        {/* Consensus Meter — 流式阶段也实时显示 */}
                        {(() => {
                          // 流式阶段从 currentSummaryText 实时提取共识度
                          let streamingCl = 0;
                          if (isStreaming && currentSummaryText) {
                            const clMatch = currentSummaryText.match(/【共识度】\s*(\d+)/);
                            if (clMatch) streamingCl = Math.min(100, Math.max(0, parseInt(clMatch[1]) || 0));
                          }
                          const displayCl = isComplete ? cl : streamingCl;
                          if (displayCl <= 0) return null;
                          return (
                          <div className="px-5 pt-2 pb-4">
                            <div className="flex items-baseline justify-between mb-2">
                              <span className="text-[13px] text-content-secondary font-medium">共识度</span>
                              <span className={`text-[18px] font-bold ${displayCl >= 70 ? 'text-[#AAE874]' : 'text-[#F59E0B]'}`}>{displayCl}%</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="relative h-2 bg-surface-hover rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${displayCl}%`,
                                  background: `linear-gradient(90deg, #F59E0B 0%, ${displayCl >= 70 ? '#AAE874' : '#FFD93D'} 100%)`
                                }}
                              />
                            </div>
                          </div>
                          );
                        })()}

                        {/* Summary & Sections */}
                        <div className="px-5 pb-5 space-y-4">
                          {/* thinking 状态：header 显示"分析中"，内容区用骨架屏占位 */}
                          {isStreaming && !currentSummaryText && (
                            <div className="animate-fade-slide-in">
                              <div className="space-y-2 pl-1">
                                <div className="h-3 rounded-full w-[85%] animate-shimmer" style={{ background: 'linear-gradient(90deg, var(--color-bg-hover) 25%, var(--color-bg-bubble) 50%, var(--color-bg-hover) 75%)', backgroundSize: '200% 100%' }} />
                                <div className="h-3 rounded-full w-[65%] animate-shimmer" style={{ background: 'linear-gradient(90deg, var(--color-bg-hover) 25%, var(--color-bg-bubble) 50%, var(--color-bg-hover) 75%)', backgroundSize: '200% 100%', animationDelay: '0.2s' }} />
                              </div>
                            </div>
                          )}

                          {/* ======= 流式阶段：逐结构块加载（结构化渲染） ======= */}
                          {isStreaming && currentSummaryText && (() => {
                            const sectionRegex = /【(总体概述|核心观点|话题维度对比|已达成共识|共识与共识程度|分歧焦点|分歧与对立观点|亮眼观点|共识度|情绪汇总)】/g;
                            const sectionMatches: Array<{ name: string; index: number }> = [];
                            let m;
                            while ((m = sectionRegex.exec(currentSummaryText)) !== null) {
                              sectionMatches.push({ name: m[1], index: m.index });
                            }

                            if (sectionMatches.length === 0) {
                              // header 已显示"分析中"，内容区用骨架屏占位
                              return (
                                <div className="animate-fade-slide-in">
                                  <div className="space-y-2 pl-1">
                                    <div className="h-3 rounded-full w-[85%] animate-shimmer" style={{ background: 'linear-gradient(90deg, var(--color-bg-hover) 25%, var(--color-bg-bubble) 50%, var(--color-bg-hover) 75%)', backgroundSize: '200% 100%' }} />
                                    <div className="h-3 rounded-full w-[65%] animate-shimmer" style={{ background: 'linear-gradient(90deg, var(--color-bg-hover) 25%, var(--color-bg-bubble) 50%, var(--color-bg-hover) 75%)', backgroundSize: '200% 100%', animationDelay: '0.2s' }} />
                                  </div>
                                </div>
                              );
                            }

                            // 提取各段落的原始文本
                            const rawSections = new Map<string, { content: string; isComplete: boolean }>();
                            for (let i = 0; i < sectionMatches.length; i++) {
                              const start = sectionMatches[i].index + sectionMatches[i].name.length + 2;
                              const end = i + 1 < sectionMatches.length ? sectionMatches[i + 1].index : currentSummaryText.length;
                              rawSections.set(sectionMatches[i].name, {
                                content: currentSummaryText.substring(start, end).trim(),
                                isComplete: i < sectionMatches.length - 1,
                              });
                            }

                            // 只展示这些段落（精简：不展示话题维度、亮眼观点、共识度）
                            const displayOrder = ['总体概述', '共识与共识程度', '已达成共识', '分歧与对立观点', '分歧焦点', '情绪汇总'];
                            // 从 displayOrder 找到当前存在的段落
                            const visibleSections = displayOrder.filter(name => rawSections.has(name));
                            // 找到正在生成的下一段（不在 rawSections 中但在 displayOrder 中排在最后一个可见段之后的）
                            const lastSectionName = sectionMatches[sectionMatches.length - 1]?.name;
                            const lastSectionInDisplay = displayOrder.includes(lastSectionName || '');
                            const isLastSectionLoading = lastSectionInDisplay && !rawSections.get(lastSectionName || '')?.isComplete;

                            const totalAgents = discussion.agents.length;

                            // === 骨架屏组件 ===
                            const SkeletonBlock = () => (
                              <div className="space-y-2 pl-1">
                                <div className="h-3 rounded-full w-[85%] animate-shimmer" style={{ background: 'linear-gradient(90deg, var(--color-bg-hover) 25%, var(--color-bg-bubble) 50%, var(--color-bg-hover) 75%)', backgroundSize: '200% 100%' }} />
                                <div className="h-3 rounded-full w-[65%] animate-shimmer" style={{ background: 'linear-gradient(90deg, var(--color-bg-hover) 25%, var(--color-bg-bubble) 50%, var(--color-bg-hover) 75%)', backgroundSize: '200% 100%', animationDelay: '0.2s' }} />
                              </div>
                            );

                            return (
                              <>
                                {visibleSections.map(sectionName => {
                                  const raw = rawSections.get(sectionName)!;

                                  // === 总体概述 ===
                                  if (sectionName === '总体概述') {
                                    if (!raw.isComplete) {
                                      return (
                                        <div key={sectionName} className="animate-fade-slide-in">
                                          <SkeletonBlock />
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={sectionName} className="flex items-start gap-2 animate-fade-slide-in">
                                        <span className="w-4 flex-shrink-0 text-center text-content-muted text-[14px] leading-[20px]">💬</span>
                                        <p className="flex-1 text-[13px] text-content-primary leading-relaxed">{raw.content}</p>
                                      </div>
                                    );
                                  }

                                  // === 共识 ===
                                  if (sectionName === '共识与共识程度' || sectionName === '已达成共识') {
                                    if (!raw.isComplete) {
                                      return (
                                        <div key={sectionName} className="animate-fade-slide-in">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <Check className="w-4 h-4 text-[#AAE874]" strokeWidth={2.5} />
                                            <h3 className="text-[14px] font-bold text-content-heading">共识</h3>
                                          </div>
                                          <SkeletonBlock />
                                        </div>
                                      );
                                    }
                                    const consensusItems = sectionName === '共识与共识程度'
                                      ? parseEnhancedConsensusSection(raw.content, totalAgents)
                                      : parseLegacyConsensusSection(raw.content, totalAgents);
                                    if (consensusItems.length === 0) return null;
                                    return (
                                      <div key={sectionName} className="space-y-1.5 animate-fade-slide-in">
                                        <div className="flex items-center gap-2">
                                          <Check className="w-4 h-4 text-[#AAE874]" strokeWidth={2.5} />
                                          <h3 className="text-[14px] font-bold text-content-heading">共识</h3>
                                          <span className="text-[11px] text-content-muted">{consensusItems.length}项</span>
                                        </div>
                                        <ul className="space-y-2">
                                          {consensusItems.slice(0, 2).map((item, cIdx) => (
                                            <li key={cIdx} className="space-y-1">
                                              <div className="flex items-start gap-2">
                                                <span className="w-4 flex-shrink-0 flex justify-center mt-[3px]">
                                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#AAE874" strokeWidth="1.5" /><path d="M5 8.5L7 10.5L11 6" stroke="#AAE874" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                </span>
                                                <span className="flex-1 text-[13px] text-content-primary leading-relaxed">{item.content}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 pl-6">
                                                {item.strength && (
                                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                                                    item.strength === 'strong' ? 'bg-[#AAE874]/15 text-[#7BC74D]' :
                                                    item.strength === 'weak' ? 'bg-surface-page text-content-muted' :
                                                    'bg-[#F59E0B]/10 text-[#F59E0B]'
                                                  }`}>
                                                    {item.strength === 'strong' ? '强' : item.strength === 'weak' ? '弱' : '中'}
                                                  </span>
                                                )}
                                                {item.agents && item.agents.length > 0 && (
                                                  <div className="flex items-center flex-shrink-0">
                                                    {item.agents.map((agentName, aIdx) => {
                                                      const agent = discussion.agents.find(a => a.name === agentName);
                                                      return agent ? (
                                                        <span key={aIdx} className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-card" style={{ marginLeft: aIdx > 0 ? -4 : 0, zIndex: aIdx }} title={agentName}>
                                                          <AgentAvatar type={getAvatarType(agent)} size={20} />
                                                        </span>
                                                      ) : null;
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    );
                                  }

                                  // === 分歧 ===
                                  if (sectionName === '分歧与对立观点' || sectionName === '分歧焦点') {
                                    if (!raw.isComplete) {
                                      return (
                                        <div key={sectionName} className="animate-fade-slide-in">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                                            <h3 className="text-[14px] font-bold text-content-heading">分歧</h3>
                                          </div>
                                          <SkeletonBlock />
                                        </div>
                                      );
                                    }
                                    const disagreementItems = sectionName === '分歧与对立观点'
                                      ? parseEnhancedDisagreementsSection(raw.content)
                                      : parseLegacyDisagreementsSection(raw.content);
                                    if (disagreementItems.length === 0) return null;
                                    return (
                                      <div key={sectionName} className="space-y-1.5 animate-fade-slide-in">
                                        <div className="flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                                          <h3 className="text-[14px] font-bold text-content-heading">分歧</h3>
                                          <span className="text-[11px] text-content-muted">{disagreementItems.length}项</span>
                                        </div>
                                        <ul className="space-y-2">
                                          {disagreementItems.slice(0, 2).map((item, dIdx) => (
                                            <li key={dIdx} className="space-y-1.5">
                                              <div className="flex items-start gap-2">
                                                <span className="w-4 flex-shrink-0 text-center text-[#F59E0B] text-[14px] leading-[20px]">⚡</span>
                                                <span className="text-[13px] text-content-primary leading-relaxed flex-1 min-w-0">{item.topic}</span>
                                                {item.nature && (
                                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 mt-[2px] ${
                                                    item.nature === 'fundamental' ? 'bg-[#E05454]/10 text-[#E05454]' :
                                                    item.nature === 'strategic' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                                                    'bg-surface-page text-content-muted'
                                                  }`}>
                                                    {item.nature === 'fundamental' ? '根本性' : item.nature === 'strategic' ? '策略性' : '程度性'}
                                                  </span>
                                                )}
                                              </div>
                                              {/* 各方立场 + agent 头像 */}
                                              {item.sides && item.sides.length > 0 && (
                                                <div className="space-y-1.5 pl-6">
                                                  {item.sides.map((side, sideIdx) => {
                                                    const sideLabel = String.fromCharCode(65 + sideIdx); // A, B, C...
                                                    const sideColors = [
                                                      { bg: 'bg-[#5B8DEF]/10', text: 'text-[#5B8DEF]', border: 'border-[#5B8DEF]/20' },
                                                      { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/20' },
                                                      { bg: 'bg-[#999999]/10', text: 'text-content-muted', border: 'border-[#999999]/20' },
                                                    ];
                                                    const sc = sideColors[sideIdx] || sideColors[2];
                                                    return (
                                                      <div key={sideIdx} className="flex items-center gap-1.5 min-w-0">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold min-w-0 flex-1 truncate ${sc.bg} ${sc.text} border ${sc.border}`} title={side.position || `立场${sideLabel}`}>
                                                          {side.position || `立场${sideLabel}`}
                                                        </span>
                                                        <div className="flex items-center flex-shrink-0">
                                                          {side.agents.map((a, aIdx) => {
                                                            const agent = discussion.agents.find(ag => ag.name === a.name);
                                                            return agent ? (
                                                              <span key={aIdx} className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-card" style={{ marginLeft: aIdx > 0 ? -4 : 0, zIndex: aIdx }} title={a.name}>
                                                                <AgentAvatar type={getAvatarType(agent)} size={20} />
                                                              </span>
                                                            ) : null;
                                                          })}
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    );
                                  }

                                  // === 情绪汇总 ===
                                  if (sectionName === '情绪汇总') {
                                    if (!raw.isComplete) {
                                      return (
                                        <div key={sectionName} className="animate-fade-slide-in">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <SentimentChartIcon size={16} />
                                            <h3 className="text-[14px] font-bold text-content-heading">情绪</h3>
                                          </div>
                                          <SkeletonBlock />
                                        </div>
                                      );
                                    }
                                    const sentimentItems = parseSentimentSummarySection(raw.content);
                                    if (sentimentItems.length === 0) return null;
                                    return (
                                      <div key={sectionName} className="animate-fade-slide-in">
                                        <SentimentSection items={sentimentItems} agents={discussion.agents} compact />
                                      </div>
                                    );
                                  }

                                  return null;
                                })}

                                {/* 下一段正在生成的骨架屏占位 */}
                                {!isLastSectionLoading && (() => {
                                  // 检查是否还有未出现的段落
                                  const allPossibleSections = ['总体概述', '共识与共识程度', '已达成共识', '分歧与对立观点', '分歧焦点', '情绪汇总'];
                                  const hasAllCompleted = allPossibleSections.some(name => {
                                    const sec = rawSections.get(name);
                                    return sec && !sec.isComplete;
                                  });
                                  if (hasAllCompleted) return null;
                                  // 还在流式中，最后一个可见段已完成，说明下一段正在生成
                                  return (
                                    <div className="animate-fade-slide-in">
                                      <SkeletonBlock />
                                    </div>
                                  );
                                })()}
                              </>
                            );
                          })()}

                          {/* ======= 完成后：结构化展示（简约版 — 信息流） ======= */}
                          {isComplete && (() => {
                            const ma = round.moderatorAnalysis;
                            if (!ma) return null;
                            return (
                              <>
                                {/* 总体概述 */}
                                {ma.summary && (
                                  <div className="flex items-start gap-2">
                                    <span className="w-4 flex-shrink-0 text-center text-content-muted text-[14px] leading-[20px]">💬</span>
                                    <p className="flex-1 text-[13px] text-content-primary leading-relaxed">{ma.summary}</p>
                                  </div>
                                )}

                                {/* 共识（前2条，带强度标签+agent头像） */}
                                {ma.consensus && ma.consensus.length > 0 && (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <Check className="w-4 h-4 text-[#AAE874]" strokeWidth={2.5} />
                                      <h3 className="text-[14px] font-bold text-content-heading">共识</h3>
                                      <span className="text-[11px] text-content-muted">{ma.consensus.length}项</span>
                                    </div>
                                    <ul className="space-y-2">
                                      {ma.consensus.slice(0, 2).map((item, cIdx) => (
                                        <li key={cIdx} className="space-y-1">
                                          <div className="flex items-start gap-2">
                                            <span className="w-4 flex-shrink-0 flex justify-center mt-[3px]">
                                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#AAE874" strokeWidth="1.5" /><path d="M5 8.5L7 10.5L11 6" stroke="#AAE874" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                            </span>
                                            <span className="flex-1 text-[13px] text-content-primary leading-relaxed">{item.content}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 pl-6">
                                            {item.strength && (
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                                                item.strength === 'strong' ? 'bg-[#AAE874]/15 text-[#7BC74D]' :
                                                item.strength === 'weak' ? 'bg-surface-page text-content-muted' :
                                                'bg-[#F59E0B]/10 text-[#F59E0B]'
                                              }`}>
                                                {item.strength === 'strong' ? '强' : item.strength === 'weak' ? '弱' : '中'}
                                              </span>
                                            )}
                                            {item.agents && item.agents.length > 0 && (
                                              <div className="flex items-center flex-shrink-0">
                                                {item.agents.map((agentName, aIdx) => {
                                                  const agent = discussion.agents.find(a => a.name === agentName);
                                                  return agent ? (
                                                    <span key={aIdx} className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-card" style={{ marginLeft: aIdx > 0 ? -4 : 0, zIndex: aIdx }} title={agentName}>
                                                      <AgentAvatar type={getAvatarType(agent)} size={20} />
                                                    </span>
                                                  ) : null;
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* 分歧（前2条，带性质标签+各方立场agent头像） */}
                                {ma.disagreements && ma.disagreements.length > 0 && (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                                      <h3 className="text-[14px] font-bold text-content-heading">分歧</h3>
                                      <span className="text-[11px] text-content-muted">{ma.disagreements.length}项</span>
                                    </div>
                                    <ul className="space-y-2">
                                      {ma.disagreements.slice(0, 2).map((item, dIdx) => (
                                        <li key={dIdx} className="space-y-1.5">
                                          <div className="flex items-start gap-2">
                                            <span className="w-4 flex-shrink-0 text-center text-[#F59E0B] text-[14px] leading-[20px]">⚡</span>
                                            <span className="text-[13px] text-content-primary leading-relaxed flex-1 min-w-0">{item.topic}</span>
                                            {item.nature && (
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 mt-[2px] ${
                                                item.nature === 'fundamental' ? 'bg-[#E05454]/10 text-[#E05454]' :
                                                item.nature === 'strategic' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                                                'bg-surface-page text-content-muted'
                                              }`}>
                                                {item.nature === 'fundamental' ? '根本性' : item.nature === 'strategic' ? '策略性' : '程度性'}
                                              </span>
                                            )}
                                          </div>
                                          {/* 各方立场 + agent 头像 */}
                                          {item.sides && item.sides.length > 0 && (
                                            <div className="space-y-1.5 pl-6">
                                              {item.sides.map((side, sideIdx) => {
                                                const sideLabel = String.fromCharCode(65 + sideIdx);
                                                const sideColors = [
                                                  { bg: 'bg-[#5B8DEF]/10', text: 'text-[#5B8DEF]', border: 'border-[#5B8DEF]/20' },
                                                  { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/20' },
                                                  { bg: 'bg-[#999999]/10', text: 'text-content-muted', border: 'border-[#999999]/20' },
                                                ];
                                                const sc = sideColors[sideIdx] || sideColors[2];
                                                return (
                                                  <div key={sideIdx} className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold min-w-0 flex-1 truncate ${sc.bg} ${sc.text} border ${sc.border}`} title={side.position || `立场${sideLabel}`}>
                                                      {side.position || `立场${sideLabel}`}
                                                    </span>
                                                    <div className="flex items-center flex-shrink-0">
                                                      {side.agents.map((a, aIdx) => {
                                                        const agent = discussion.agents.find(ag => ag.name === a.name);
                                                        return agent ? (
                                                          <span key={aIdx} className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-card" style={{ marginLeft: aIdx > 0 ? -4 : 0, zIndex: aIdx }} title={a.name}>
                                                            <AgentAvatar type={getAvatarType(agent)} size={20} />
                                                          </span>
                                                        ) : null;
                                                      })}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* 情绪汇总 — 简约版 */}
                                {ma.sentimentSummary && ma.sentimentSummary.length > 0 && (
                                  <SentimentSection items={ma.sentimentSummary} agents={discussion.agents} compact />
                                )}

                                {/* 查看完整分析报告 — 仅已完成轮次显示 */}
                                {!(round as any)._isInProgress && (round.moderatorAnalysis?.consensusLevel ?? 0) > 0 && (
                                <div className="pt-2" style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--color-report-summary-border)' }}>
                                  <button
                                    onClick={() => { setSummaryRoundIndex(round.roundIndex); setShowSummary(true); }}
                                    className="w-full flex items-center justify-center gap-1.5 text-[12px] text-[#7BC74D] font-bold py-2 rounded-xl hover:bg-[#AAE874]/8 active:bg-[#AAE874]/15 transition-all"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    查看完整分析报告
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Floating Right Buttons — Prompts + Back to Bottom */}
      <div className="absolute right-5 z-[9999] flex flex-col items-center gap-2" style={{ bottom: bottomBarHeight + 12 }}>
        {/* Prompts Button — hidden, keep function for future testing
        <button
          onClick={() => {
            const currentRound = rounds[rounds.length - 1];
            if (currentRound?.prompts) {
              setCurrentRoundPrompts(currentRound.prompts);
              setShowPromptsModal(true);
            } else {
              alert('当前轮次暂无prompts数据');
            }
          }}
          className="w-10 h-10 rounded-full border border-line shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center justify-center active:scale-95 transition-all"
          style={{ background: 'rgba(255,255,255,0.92)' }}
          title="查看 Prompts"
        >
          <FileText className="w-4 h-4 text-content-secondary" />
        </button>
        */}
        {/* Back to Bottom Button */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            className="w-10 h-10 rounded-full shadow-[0_4px_20px_rgba(170,232,116,0.4)] flex items-center justify-center active:scale-95 transition-all hover:shadow-[0_6px_24px_rgba(170,232,116,0.5)]"
            style={{ background: 'rgba(170,232,116,0.92)' }}
          >
            <ArrowDown className="w-5 h-5 text-white" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Bottom Action Bar — 与顶栏高度一致 */}
      <div ref={bottomBarRef} className="absolute bottom-0 left-0 right-0 z-50">
        {/* Glassmorphic Background */}
        <div className="absolute inset-0 backdrop-blur-xl" style={{ background: `linear-gradient(to top, rgba(170,232,116,0.10), var(--color-glass-strong), var(--color-glass-medium))` }} />

        {/* ===== 统一布局（形变动画） ===== */}
        <div className={`relative flex px-5 py-3 ${bottomBarMode === 'edit' && isInputMultiLine ? 'items-end' : 'items-center'}`}>

          {/* @-mention 弹窗 — 放在外层容器避免被 overflow:hidden 裁剪 */}
          {bottomBarMode === 'edit' && showMentionPopup && (
            <div className="absolute bottom-full left-[64px] right-[64px] mb-2 bg-surface-card rounded-2xl border border-line shadow-[0_4px_20px_rgba(0,0,0,0.12)] overflow-hidden z-[60]">
              <div className="px-3 py-2 text-[11px] text-content-muted font-medium border-b border-line-light">选择要 @的专家</div>
              {discussion.agents
                .filter(a => !mentionFilter || a.name.includes(mentionFilter))
                .map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => handleSelectMention(agent)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-bubble active:bg-surface-hover transition-colors"
                  >
                    <AgentAvatar type={getAvatarType(agent)} size={28} />
                    <span className="text-[14px] font-medium text-content-primary">{agent.name}</span>
                  </button>
                ))
              }
              {discussion.agents.filter(a => !mentionFilter || a.name.includes(mentionFilter)).length === 0 && (
                <div className="px-3 py-3 text-[13px] text-content-muted text-center">无匹配的专家</div>
              )}
            </div>
          )}

          {/* ── 左侧按钮：图标旋转切换 ── */}
          <button
            onClick={() => {
              if (bottomBarMode === 'discussion') {
                setBottomBarMode('edit');
                setUserInput('');
                setIsInputMultiLine(false);
                if (textareaRef.current) textareaRef.current.style.height = '40px';
                setTimeout(() => textareaRef.current?.focus(), 80);
              } else {
                setBottomBarMode('discussion');
                setUserInput('');
                setIsInputMultiLine(false);
                if (textareaRef.current) textareaRef.current.style.height = '40px';
                textareaRef.current?.blur();
              }
            }}
            className="flex-shrink-0 w-10 h-10 rounded-full border border-line bg-surface-card flex items-center justify-center active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            style={{ transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
            title={bottomBarMode === 'discussion' ? '输入提问' : '返回讨论模式'}
          >
            {/* 两个图标叠放，用 opacity + rotate 做交叉过渡 */}
            <div className="relative w-[18px] h-[18px]">
              <Keyboard
                className="absolute inset-0 w-[18px] h-[18px] text-content-secondary"
                strokeWidth={2}
                style={{
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  opacity: bottomBarMode === 'discussion' ? 1 : 0,
                  transform: bottomBarMode === 'discussion' ? 'rotate(0deg)' : 'rotate(-180deg)',
                }}
              />
              <ArrowLeft
                className="absolute inset-0 w-[18px] h-[18px] text-content-secondary"
                strokeWidth={2}
                style={{
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  opacity: bottomBarMode === 'edit' ? 1 : 0,
                  transform: bottomBarMode === 'edit' ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
              />
            </div>
          </button>

          {/* ── 中间输入框区域：展开/收起动画 ── */}
          <div
            className="relative"
            style={{
              flex: bottomBarMode === 'edit' ? '1 1 0%' : '0 0 0px',
              opacity: bottomBarMode === 'edit' ? 1 : 0,
              overflow: 'hidden',
              marginLeft: bottomBarMode === 'edit' ? 12 : 0,
              transition: 'flex 0.3s ease, opacity 0.25s ease, margin-left 0.3s ease',
              minWidth: 0,
            }}
          >
            {/* 可编辑输入框 */}
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (userInput.trim()) {
                    handleUserSend();
                  }
                }
                if (e.key === 'Escape') {
                  setShowMentionPopup(false);
                }
              }}
              disabled={isLoading}
              placeholder={isLoading ? '专家们正在讨论中...' : '向AI专家提问...'}
              rows={1}
              className="block w-full px-5 bg-surface-card border border-line text-[15px] text-content-primary placeholder:text-content-placeholder shadow-[0_2px_8px_rgba(0,0,0,0.04)] resize-none focus:outline-none focus:border-[#AAE874] focus:shadow-[0_0_0_3px_rgba(170,232,116,0.1)] disabled:bg-surface-bubble disabled:cursor-not-allowed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                height: '40px',
                maxHeight: '98px',
                lineHeight: '20px',
                paddingTop: '9px',
                paddingBottom: '9px',
                borderRadius: '20px',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                overflow: 'hidden',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = '0px';
                const scrollH = target.scrollHeight;
                const newH = Math.max(40, Math.min(scrollH, 98));
                target.style.height = newH + 'px';
                target.style.overflow = scrollH > 98 ? 'auto' : 'hidden';
                setIsInputMultiLine(newH > 40);
                target.scrollTop = target.scrollHeight;
              }}
            />
          </div>

          {/* ── 右侧按钮：圆形 <-> 长条变形 ── */}
          {(() => {
            // 确定按钮状态
            const isEdit = bottomBarMode === 'edit';
            const isStoppable = isLoading && currentRoundIndex > 1;
            const isFirstRoundLoading = isLoading && currentRoundIndex <= 1;
            const isIdle = !isLoading;

            // 确定背景色（编辑模式下圆形按钮的背景）
            const bgStyle: React.CSSProperties = isStoppable
              ? { background: '#E05454' }
              : isFirstRoundLoading
                ? { background: 'var(--color-border)' }
                : { background: 'linear-gradient(to right, #AAE874, #7BC74D)' };

            // 确定阴影
            const shadowStyle = isStoppable
              ? '0 4px 16px rgba(224,84,84,0.4)'
              : isFirstRoundLoading
                ? 'none'
                : '0 4px 16px rgba(170,232,116,0.4)';

            return (
              <button
                onClick={() => {
                  if (isFirstRoundLoading) return; // disabled
                  if (isStoppable) { handleStopDiscussion(); return; }
                  // 空闲态
                  if (isEdit && userInput.trim()) {
                    handleUserSend();
                  } else {
                    handleContinueDiscussion();
                  }
                }}
                disabled={isFirstRoundLoading}
                className="flex-shrink-0 h-10 rounded-full flex items-center justify-center active:scale-[0.97]"
                style={{
                  ...bgStyle,
                  boxShadow: shadowStyle,
                  width: isEdit ? '2.5rem' : undefined,
                  flex: isEdit ? '0 0 2.5rem' : '1 1 0%',
                  marginLeft: 12,
                  cursor: isFirstRoundLoading ? 'not-allowed' : 'pointer',
                  opacity: isFirstRoundLoading ? 0.6 : 1,
                  transition: 'flex 0.3s ease, width 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {/* 文字标签 — 讨论模式显示，编辑模式隐藏 */}
                <span
                  style={{
                    maxWidth: isEdit ? 0 : 120,
                    opacity: isEdit ? 0 : 1,
                    overflow: 'hidden',
                    transition: 'max-width 0.3s ease, opacity 0.2s ease, margin 0.3s ease',
                    display: 'inline-block',
                    marginRight: isEdit ? 0 : 8,
                  }}
                  className="text-[14px] font-bold text-white"
                >
                  {isStoppable ? '中止讨论' : isFirstRoundLoading ? '专家发言中' : '继续讨论'}
                </span>

                {/* 图标 */}
                {isFirstRoundLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : isStoppable ? (
                  <Square className="w-3.5 h-3.5 text-white fill-white flex-shrink-0" strokeWidth={0} />
                ) : isEdit && userInput.trim() ? (
                  <SendHorizontal className="w-5 h-5 text-white flex-shrink-0" strokeWidth={2.5} />
                ) : (
                  <ArrowRight className="w-5 h-5 text-white flex-shrink-0" strokeWidth={2.5} />
                )}
              </button>
            );
          })()}
        </div>
        {/* Safe area spacer — 兼容 Safari 底部工具栏 */}
        <div className="relative" style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
      </div>

      {/* Prompts Modal */}
      {showPromptsModal && currentRoundPrompts && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-[10001]" onClick={() => setShowPromptsModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] bg-surface-card rounded-[28px] overflow-hidden flex flex-col mx-4 shadow-[0_8px_40px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-line-light flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-content-primary">Prompts - 第 {rounds.length} 轮</h2>
              <button
                onClick={() => setShowPromptsModal(false)}
                className="w-9 h-9 rounded-full bg-surface-bubble flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="w-5 h-5 text-content-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Agent Prompts */}
              <div className="mb-6">
                <h3 className="text-[16px] font-bold text-content-primary mb-4">Agent Prompts</h3>
                {currentRoundPrompts.agents.map((agentPrompt, index) => (
                  <div key={index} className="mb-6 p-4 bg-surface-bubble rounded-2xl border border-line-light">
                    <div className="flex items-center gap-2 mb-3">
                      <AgentAvatar type={getAvatarTypeById(agentPrompt.agentId, discussion.agents)} size={24} />
                      <h4 className="text-[14px] font-bold text-content-primary">{agentPrompt.agentName}</h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[12px] font-medium text-content-secondary mb-1">System Prompt:</div>
                        <pre className="text-[12px] text-content-primary bg-surface-card p-3 rounded-xl border border-line-light overflow-x-auto whitespace-pre-wrap">{agentPrompt.systemPrompt}</pre>
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-content-secondary mb-1">User Prompt:</div>
                        <pre className="text-[12px] text-content-primary bg-surface-card p-3 rounded-xl border border-line-light overflow-x-auto whitespace-pre-wrap">{agentPrompt.userPrompt}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Moderator Prompts */}
              {currentRoundPrompts.moderator && (
                <div>
                  <h3 className="text-[16px] font-bold text-content-primary mb-4">Moderator Prompts</h3>
                  <div className="p-4 bg-[#AAE874]/10 rounded-2xl border border-[#AAE874]/20">
                    <div className="space-y-3">
                      <div>
                        <div className="text-[12px] font-medium text-content-secondary mb-1">System Prompt:</div>
                        <pre className="text-[12px] text-content-primary bg-surface-card p-3 rounded-xl border border-line-light overflow-x-auto whitespace-pre-wrap">{currentRoundPrompts.moderator.systemPrompt}</pre>
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-content-secondary mb-1">User Prompt:</div>
                        <pre className="text-[12px] text-content-primary bg-surface-card p-3 rounded-xl border border-line-light overflow-x-auto whitespace-pre-wrap">{currentRoundPrompts.moderator.userPrompt}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-line-light">
              <button
                onClick={() => setShowPromptsModal(false)}
                className="w-full py-3 bg-[#AAE874] text-white rounded-full text-[14px] font-medium active:scale-[0.98] transition-transform shadow-[0_4px_16px_rgba(170,232,116,0.4)]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal — 参考历史话题抽屉：始终挂载 + CSS transition */}
      <div
        className={`absolute inset-0 z-[10000] flex items-end transition-opacity duration-300 ${
          showSummary ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* 背景遮罩 */}
        <div
          className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-[2px]"
          onClick={() => { setShowSummary(false); setShowRoundPicker(false); }}
        />
        {/* 抽屉内容 */}
        <div
          className={`relative w-full bg-surface-empty rounded-t-[28px] overflow-hidden flex flex-col shadow-[0_-12px_60px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out ${
            showSummary ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ maxHeight: 'calc(100% - 64px)' }}
        >
            {/* 固定顶栏 — 分析报告 + 第N轮 + 关闭 */}
            <div className="px-5 pt-3 pb-3 flex flex-col items-center bg-surface-empty flex-shrink-0">
              <div className="w-10 h-1 bg-line-dashed rounded-full mb-3"></div>
              <div className="w-full flex items-center">
                <h2 className="text-[18px] font-extrabold text-content-heading tracking-tight">分析报告</h2>
                {/* 第N轮徽章 + 下拉选择器 */}
                <div className="relative ml-2.5">
                  <button
                    onClick={() => {
                      const available = rounds.filter(r => r.moderatorAnalysis?.consensusLevel > 0);
                      if (available.length > 1) setShowRoundPicker(!showRoundPicker);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-[#AAE874] to-[#7BC74D] rounded-full shadow-[0_2px_8px_rgba(170,232,116,0.3)] active:scale-95 transition-all"
                  >
                    <span className="text-white text-[11px] font-bold tracking-wide">第{summaryRoundIndex ?? (() => { const cr = rounds.filter(r => !(r as any)._isInProgress && (r.moderatorAnalysis?.consensusLevel ?? 0) > 0); return cr.length > 0 ? cr[cr.length - 1].roundIndex : (discussion.moderatorAnalysis?.round ?? 1); })()}轮</span>
                    {rounds.filter(r => !(r as any)._isInProgress && (r.moderatorAnalysis?.consensusLevel ?? 0) > 0).length > 1 && (
                      <ChevronDown className={`w-3 h-3 text-white/80 transition-transform duration-200 ${showRoundPicker ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                    )}
                  </button>
                  {/* 下拉面板 */}
                  {showRoundPicker && (
                    <>
                      <div className="fixed inset-0 z-[9]" onClick={() => setShowRoundPicker(false)} />
                      <div className="absolute top-full left-0 mt-2 z-[10] bg-surface-card rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-line-light py-1.5 min-w-[140px] max-h-[200px] overflow-y-auto">
                        {rounds.filter(r => !(r as any)._isInProgress && (r.moderatorAnalysis?.consensusLevel ?? 0) > 0).map(r => {
                          const crForPicker = rounds.filter(rr => !(rr as any)._isInProgress && (rr.moderatorAnalysis?.consensusLevel ?? 0) > 0);
                          const currentDisplayRound = summaryRoundIndex ?? (crForPicker.length > 0 ? crForPicker[crForPicker.length - 1].roundIndex : 1);
                          const isActive = r.roundIndex === currentDisplayRound;
                          return (
                            <button
                              key={r.roundIndex}
                              onClick={() => { setSummaryRoundIndex(r.roundIndex); setShowRoundPicker(false); }}
                              className={`w-full px-3.5 py-2 flex items-center justify-between gap-3 text-left transition-colors ${isActive ? 'bg-[#AAE874]/10' : 'hover:bg-surface-bubble'}`}
                            >
                              <span className={`text-[13px] font-medium ${isActive ? 'text-[#5BB536] font-bold' : 'text-content-primary'}`}>第{r.roundIndex}轮</span>
                              <span className={`text-[11px] ${isActive ? 'text-[#7BC74D]' : 'text-content-placeholder'}`}>共识 {r.moderatorAnalysis.consensusLevel}%</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex-1" />
                <button
                  onClick={() => { setShowSummary(false); setShowRoundPicker(false); }}
                  className="w-8 h-8 bg-surface-hover hover:bg-line rounded-full flex items-center justify-center active:scale-90 transition-all"
                >
                  <X className="w-4 h-4 text-content-muted" />
                </button>
              </div>
            </div>

            <div ref={summaryScrollRef} className="flex-1 overflow-y-auto bg-surface-empty">
              {/* Logo — 常驻在报告弹窗内，截图时临时增大 paddingTop 以留出安全区域高度 */}
              <div ref={logoWrapRef} className="px-5 pt-4 pb-1 flex items-center">
                <img src={logoDataUrl || (isDark ? '/logo-dark.png' : '/logo-light.png')} alt="LeapCat.ai" className="h-[26px] w-auto" />
              </div>
              <div className="px-5 pt-2 pb-0">
                {/* Report Header — 标题 */}
                <div className="mb-6">
                  <h3 className="text-[18px] font-bold text-content-primary leading-snug">{discussion.title}</h3>
                </div>

                {/* Summary Content */}
                {(() => {
                  // 根据 summaryRoundIndex 选择对应轮次，null 表示最新已完成轮次
                  const completedRoundsForModal = rounds.filter(r => !(r as any)._isInProgress && (r.moderatorAnalysis?.consensusLevel ?? 0) > 0);
                  const targetRound = summaryRoundIndex !== null
                    ? rounds.find(r => r.roundIndex === summaryRoundIndex) || (completedRoundsForModal.length > 0 ? completedRoundsForModal[completedRoundsForModal.length - 1] : null)
                    : (completedRoundsForModal.length > 0 ? completedRoundsForModal[completedRoundsForModal.length - 1] : null);
                  const analysis = targetRound?.moderatorAnalysis || discussion.moderatorAnalysis;
                  if (!analysis) return <p className="text-[13px] text-content-muted">暂无分析数据</p>;

                  return (
                    <>
                      {/* 总体概述 + 数据仪表板 */}
                      <div className="relative mb-6 rounded-2xl overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#AAE874] via-[#7BC74D] to-[#5BB536]" />
                        <div className="p-4 pt-5 rounded-2xl" style={{ background: `linear-gradient(to bottom, var(--color-report-summary-from), var(--color-report-summary-to))`, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-report-summary-border)' }}>
                          <p className="text-[14px] leading-[1.75]" style={{ color: 'var(--color-text-body)' }}>
                            {analysis.summary}
                          </p>
                          {/* Stats Dashboard — 横排指标（等高豆腐块） */}
                          <div className="grid grid-cols-4 gap-2 mt-4 pt-3.5" style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--color-report-summary-border)', opacity: 0.8 }}>
                            {/* 共识度 */}
                            <div className="flex flex-col items-center justify-center py-2.5 rounded-xl" style={{ background: 'rgba(170,232,116,0.08)' }}>
                              <div className="relative w-9 h-9 flex-shrink-0 mb-1.5">
                                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--color-border)" strokeWidth="2.5" />
                                  <circle cx="18" cy="18" r="14" fill="none"
                                    stroke={analysis.consensusLevel >= 70 ? '#AAE874' : analysis.consensusLevel >= 40 ? '#F59E0B' : '#E05454'}
                                    strokeWidth="2.5" strokeLinecap="round"
                                    strokeDasharray={`${(analysis.consensusLevel / 100) * 87.96} 87.96`} />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-content-primary">{analysis.consensusLevel}</span>
                              </div>
                              <span className="text-[10px] text-content-placeholder leading-none">共识度</span>
                            </div>
                            {/* 参与专家 — 单行堆叠，自适应不溢出 */}
                            <div className="flex flex-col items-center justify-center py-2.5 rounded-xl" style={{ background: 'rgba(91,141,239,0.08)' }}>
                              {(() => {
                                const allAgents = discussion.agents;
                                const total = allAgents.length;
                                // 头像大小与话题维度对比保持一致（20px）
                                const avatarSize = 20;
                                // 固定容器宽度，头像均匀分布
                                const containerWidth = 56;
                                const step = total <= 1 ? 0 : (containerWidth - avatarSize) / (total - 1);
                                return (
                                  <>
                                    <div className="flex items-center justify-center mb-1.5" style={{ height: 36 }}>
                                      <div className="relative" style={{ width: containerWidth, height: avatarSize }}>
                                        {allAgents.map((agent, i) => (
                                          <div
                                            key={i}
                                            className="absolute rounded-full bg-surface-card overflow-hidden"
                                            style={{ left: i * step, width: avatarSize, height: avatarSize, zIndex: i + 1 }}
                                          >
                                            <AgentAvatar type={getAvatarType(agent)} size={avatarSize} />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-content-placeholder leading-none">{total}位专家</span>
                                  </>
                                );
                              })()}
                            </div>
                            {/* 共识数 */}
                            <div className="flex flex-col items-center justify-center py-2.5 rounded-xl" style={{ background: 'rgba(170,232,116,0.08)' }}>
                              <div className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5" style={{ background: 'rgba(170,232,116,0.15)' }}>
                                <Check className="w-4 h-4 text-[#7BC74D]" strokeWidth={3} />
                              </div>
                              <span className="text-[10px] text-content-placeholder leading-none">共识 <span className="text-[#7BC74D] font-bold">{analysis.consensus.length}</span></span>
                            </div>
                            {/* 分歧数 */}
                            <div className="flex flex-col items-center justify-center py-2.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)' }}>
                              <div className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5" style={{ background: 'rgba(245,158,11,0.12)' }}>
                                <AlertCircle className="w-4 h-4 text-[#F59E0B]" strokeWidth={2.5} />
                              </div>
                              <span className="text-[10px] text-content-placeholder leading-none">分歧 <span className="text-[#F59E0B] font-bold">{analysis.disagreements.length}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 话题维度对比 */}
                      {analysis.topicComparisons && analysis.topicComparisons.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2.5 mb-3 whitespace-nowrap">
                          <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center flex-shrink-0">
                            <Lightbulb className="w-4 h-4 text-[#F59E0B]" strokeWidth={2.5} />
                          </div>
                          <h4 className="text-[16px] font-bold text-content-heading">话题维度对比</h4>
                          <span className="text-[11px] text-content-placeholder font-medium">{analysis.topicComparisons.length}个维度</span>
                        </div>
                        <div className="space-y-3">
                          {analysis.topicComparisons.map((tc, tcIdx) => (
                            <div key={tcIdx} className="relative rounded-2xl border border-line-light overflow-hidden bg-surface-card">
                              <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-[#F59E0B] to-[#FFD93D]" />
                              <div className="px-4 pl-5 py-3.5">
                                {/* 标题行：标题自然折行，标签右上角 */}
                                <div className="mb-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="text-[14px] font-bold text-content-heading leading-snug flex-1">{tc.topic}</h5>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5 ${
                                      tc.convergenceLevel === 'high' ? 'bg-[#AAE874]/15 text-[#7BC74D]' :
                                      tc.convergenceLevel === 'low' ? 'bg-[#E05454]/10 text-[#E05454]' :
                                      'bg-[#F59E0B]/10 text-[#F59E0B]'
                                    }`}>
                                      {tc.convergenceLevel === 'high' ? '高趋同' : tc.convergenceLevel === 'low' ? '低趋同' : '中趋同'}
                                    </span>
                                  </div>
                                </div>
                                {/* 各 agent 观点 */}
                                <div className="space-y-2.5">
                                  {tc.agentPositions.map((ap, apIdx) => {
                                    const agent = discussion.agents.find(a => a.name === ap.agentName);
                                    return (
                                      <div key={apIdx} className="flex items-start gap-2">
                                        {agent && <span className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 mt-0.5 bg-surface-card"><AgentAvatar type={getAvatarType(agent)} size={20} /></span>}
                                        <div className="flex-1 min-w-0">
                                          <span className="text-[11px] text-content-placeholder font-medium">{ap.agentName}</span>
                                          <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: 'var(--color-text-body)' }}>{ap.position}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )}

                      {/* 共识与共识程度 */}
                      {analysis.consensus && analysis.consensus.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2.5 mb-3 whitespace-nowrap">
                          <div className="w-7 h-7 rounded-lg bg-[#AAE874]/15 flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-[#7BC74D]" strokeWidth={3} />
                          </div>
                          <h4 className="text-[16px] font-bold text-content-heading">共识与共识程度</h4>
                          <span className="text-[11px] text-content-placeholder font-medium">{analysis.consensus.length}项</span>
                        </div>
                        <div className="space-y-3">
                          {analysis.consensus.map((item, index) => (
                            <div key={index} className="relative rounded-2xl border border-[#AAE874]/20 overflow-hidden" style={{ background: `linear-gradient(to bottom, var(--color-report-consensus-from), var(--color-report-consensus-to))` }}>
                              <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-[#AAE874] to-[#7BC74D]" />
                              <div className="px-4 pl-5 py-3.5">
                                <div className="flex items-start gap-3">
                                  <span className="w-6 h-6 rounded-full bg-[#AAE874]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-[12px] font-bold text-[#7BC74D]">{index + 1}</span>
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    {/* 内容 + 强度标签 */}
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <p className="text-[14px] text-content-primary font-semibold flex-1 leading-snug">{item.content}</p>
                                      {item.strength && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5 ${
                                          item.strength === 'strong' ? 'bg-[#AAE874]/20 text-[#5BB536]' :
                                          item.strength === 'weak' ? 'bg-surface-page text-content-placeholder' :
                                          'bg-[#F59E0B]/10 text-[#F59E0B]'
                                        }`}>
                                          {item.strength === 'strong' ? '强共识' : item.strength === 'weak' ? '弱共识' : '中等共识'}
                                        </span>
                                      )}
                                    </div>
                                    {/* Agent tags */}
                                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                                      {item.agents.map((agentName, aIdx) => {
                                        const agent = discussion.agents.find(a => a.name === agentName);
                                        return (
                                          <span key={aIdx} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-[#7BC74D]/10 text-[#7BC74D] border border-[#7BC74D]/30 font-medium">
                                            {agent && <span className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-surface-card"><AgentAvatar type={getAvatarType(agent)} size={16} /></span>}
                                            {agentName}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {/* Reasoning */}
                                    {item.reasoning && (
                                      <p className="text-[12px] text-content-muted leading-relaxed">{item.reasoning}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )}

                      {/* 分歧与对立观点 */}
                      {analysis.disagreements && analysis.disagreements.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2.5 mb-3 whitespace-nowrap">
                          <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-4 h-4 text-[#F59E0B]" strokeWidth={2.5} />
                          </div>
                          <h4 className="text-[16px] font-bold text-content-heading">分歧与对立观点</h4>
                          <span className="text-[11px] text-content-placeholder font-medium">{analysis.disagreements.length}项</span>
                        </div>
                        <div className="space-y-3">
                          {analysis.disagreements.map((item, index) => (
                            <div key={index} className="relative rounded-2xl border border-[#F59E0B]/20 overflow-hidden" style={{ background: `linear-gradient(to bottom, var(--color-report-disagree-from), var(--color-report-disagree-to))` }}>
                              <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-[#F59E0B] to-[#FFD93D]" />
                              <div className="px-4 pl-5 py-3.5">
                                {/* 标题 + 性质标签 */}
                                <div className="mb-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="text-[14px] font-bold text-content-heading leading-snug flex-1">{item.topic}</h5>
                                    {item.nature && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5 ${
                                        item.nature === 'fundamental' ? 'bg-[#E05454]/10 text-[#E05454]' :
                                        item.nature === 'strategic' ? 'bg-[#D97706]/10 text-[#D97706]' :
                                        'bg-surface-page text-content-muted'
                                      }`}>
                                        {item.nature === 'fundamental' ? '根本性分歧' : item.nature === 'strategic' ? '策略性分歧' : '程度性分歧'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* 各方立场 — 立场文字在上、agent 标签在下 */}
                                {item.sides && item.sides.length > 0 && (
                                  <div className="space-y-2.5 mb-2">
                                    {item.sides.map((side, sideIdx) => {
                                      const sideColors = [
                                        { bg: 'bg-[#5B8DEF]/10', text: 'text-[#5B8DEF]', border: 'border-[#5B8DEF]/20' },
                                        { bg: 'bg-[#D97706]/10', text: 'text-[#D97706]', border: 'border-[#D97706]/20' },
                                        { bg: 'bg-surface-bubble', text: 'text-content-secondary', border: 'border-line-dashed' },
                                      ];
                                      const sc = sideColors[sideIdx] || sideColors[2];
                                      return (
                                        <div key={sideIdx} className={`p-3 rounded-xl ${sc.bg} border ${sc.border}`}>
                                          {/* 立场观点 */}
                                          <p className={`text-[12px] font-semibold leading-relaxed mb-2 ${sc.text}`}>
                                            {side.position || `立场${String.fromCharCode(65 + sideIdx)}`}
                                          </p>
                                          {/* agent 标签 */}
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {side.agents.map((a, aIdx) => {
                                              const agent = discussion.agents.find(ag => ag.name === a.name);
                                              return (
                                                <span key={aIdx} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-[#888888]/8 text-content-secondary border border-[#888888]/25 font-medium">
                                                  {agent && <span className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-surface-card"><AgentAvatar type={getAvatarType(agent)} size={16} /></span>}
                                                  {a.name}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Fallback description */}
                                {(!item.sides || item.sides.length === 0) && item.description && (
                                  <p className="text-[12px] text-content-muted mb-2">{item.description}</p>
                                )}
                                {/* Root cause */}
                                {item.rootCause && (
                                  <div className="mt-2 pt-2.5 border-t border-line-light">
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-[10px] text-content-placeholder font-bold flex-shrink-0 mt-[1px]">根源</span>
                                      <span className="text-[12px] text-content-muted leading-relaxed">{item.rootCause}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )}

                      {/* 亮眼观点 */}
                      {analysis.highlights && analysis.highlights.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2.5 mb-3 whitespace-nowrap">
                          <div className="w-7 h-7 rounded-lg bg-[#FFD93D]/15 flex items-center justify-center flex-shrink-0">
                            <Lightbulb className="w-4 h-4 text-[#FFD93D]" strokeWidth={2.5} />
                          </div>
                          <h4 className="text-[16px] font-bold text-content-heading">亮眼观点</h4>
                          <span className="text-[11px] text-content-placeholder font-medium">{analysis.highlights.length}项</span>
                        </div>
                        <div className="space-y-3">
                          {analysis.highlights.map((hl, hlIdx) => {
                            const proposerAgent = discussion.agents.find(a => a.name === hl.agentName);
                            return (
                              <div key={hlIdx} className="relative rounded-2xl border border-[#FDE68A]/60 overflow-hidden" style={{ background: `linear-gradient(to bottom, var(--color-report-highlight-from), var(--color-report-highlight-to))` }}>
                                <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-[#FFD93D] to-[#FFA500]" />
                                <div className="px-4 pl-5 py-3.5">
                                  {/* Proposer */}
                                  <div className="flex items-center gap-2 mb-2">
                                    {proposerAgent && <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-surface-card"><AgentAvatar type={getAvatarType(proposerAgent)} size={24} /></span>}
                                    <span className="text-[12px] text-[#D97706] font-bold">{hl.agentName}</span>
                                  </div>
                                  {/* Content */}
                                  <p className="text-[14px] text-content-primary leading-[1.7] mb-2">{hl.content}</p>
                                  {/* Reason */}
                                  {hl.reason && (
                                    <p className="text-[12px] text-content-muted leading-relaxed">{hl.reason}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      )}

                      {/* 情绪汇总 — 详细版 */}
                      {analysis.sentimentSummary && analysis.sentimentSummary.length > 0 && (
                        <SentimentSection items={analysis.sentimentSummary} agents={discussion.agents} />
                      )}
                    </>
                  );
                })()}
              </div>
              {/* 免责声明 — 常驻在报告弹窗内，截图时自然包含 */}
              <div className="px-5 pt-2 pb-4 text-center">
                <p className="text-[11px] text-content-placeholder leading-relaxed">本报告由 AI 生成，仅供参考，不构成任何投资建议</p>
              </div>
            </div>

            <div className="p-5 bg-surface-empty">
              <button
                onClick={handleShareReport}
                disabled={isGeneratingImage}
                className="w-full py-3.5 bg-gradient-to-r from-[#AAE874] to-[#7BC74D] text-white rounded-2xl text-[14px] font-bold active:scale-[0.97] transition-all shadow-[0_4px_20px_rgba(170,232,116,0.35)] hover:shadow-[0_6px_24px_rgba(170,232,116,0.45)] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isGeneratingImage ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" strokeWidth={2.5} />
                    分享报告
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      {/* 长图预览浮层 — 整体底部对齐，按钮底部间距与讨论页输入框一致 */}
      {shareImageUrl && (
        <div className="absolute inset-0 z-[20000] flex items-end justify-center">
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (shareImageUrl) URL.revokeObjectURL(shareImageUrl); setShareImageUrl(null); setShareImageBlob(null); }} />
          {/* 预览内容 — 顶部留出一个顶部栏高度(64px)，底部与讨论页输入框对齐 */}
          <div className="relative z-[1] w-[90%] flex flex-col items-center gap-4 px-0" style={{ maxHeight: 'calc(100% - 64px)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 8px))' }}>
            {/* 图片预览 */}
            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.2)]">
              <img src={shareImageUrl} alt="分析报告长图" className="w-full block" />
            </div>
            {/* 操作按钮 */}
            <div className="flex gap-3 w-full flex-shrink-0">
              <button
                onClick={handleDownloadImage}
                className="flex-1 py-3 bg-surface-card text-content-primary rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-[0_2px_12px_rgba(0,0,0,0.1)]"
              >
                <Download className="w-4 h-4" strokeWidth={2.5} />
                保存图片
              </button>
              <button
                onClick={handleNativeShare}
                className={`flex-1 py-3 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all ${
                  copied
                    ? 'bg-[#333333] text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)]'
                    : 'bg-gradient-to-r from-[#AAE874] to-[#7BC74D] text-white shadow-[0_4px_20px_rgba(170,232,116,0.35)]'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCheck className="w-4 h-4" strokeWidth={2.5} />
                    已复制到剪贴板
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" strokeWidth={2.5} />
                    分享图片
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
