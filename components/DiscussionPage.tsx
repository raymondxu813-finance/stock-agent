'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, PenSquare, ChevronDown, ChevronRight, ArrowDown, X, FileText, SendHorizontal, Check, AlertCircle, Lightbulb } from 'lucide-react';
import type { Discussion, AgentComment, RoundData, StockSentiment, SentimentSummaryItem, Agent, AvatarType, ToolCallRecord } from '@/types';
import { toolDisplayNames } from '@/lib/toolDisplayNames';
import { HistoryTopicsDrawer } from './HistoryTopicsDrawer';
import { AgentAvatar } from './AgentAvatar';

// 根据 agent 信息获取头像类型
const getAvatarType = (agent: Agent): AvatarType => {
  if (agent.avatarType) return agent.avatarType;
  // Fallback: 根据 agent id 映射
  if (agent.id.includes('macro_economist')) return 'rocket';
  if (agent.id.includes('finance_expert')) return 'safe';
  if (agent.id.includes('senior_stock')) return 'lightning';
  if (agent.id.includes('veteran_stock')) return 'rings';
  if (agent.id.includes('crystal') || agent.id.includes('analyst')) return 'crystal';
  return 'sphere';
};

// 根据 agentId 从 agents 数组查找并获取头像类型
const getAvatarTypeById = (agentId: string, agents: Agent[]): AvatarType => {
  const agent = agents.find(a => a.id === agentId);
  if (agent) return getAvatarType(agent);
  return 'sphere';
};

// 从 agent 发言中的 sentiments 汇总构建标的情绪（当 LLM 未生成 sentimentSummary 时用作 fallback）
const buildSentimentSummaryFromAgentData = (
  agentSentiments: Array<{ agentName: string; sentiments?: StockSentiment[] }>
): SentimentSummaryItem[] => {
  // 按标的分组
  const stockMap = new Map<string, { bullish: string[]; bearish: string[]; neutral: string[] }>();
  for (const { agentName, sentiments } of agentSentiments) {
    if (!sentiments || sentiments.length === 0) continue;
    for (const s of sentiments) {
      const stock = s.stock;
      if (!stock) continue;
      if (!stockMap.has(stock)) {
        stockMap.set(stock, { bullish: [], bearish: [], neutral: [] });
      }
      const entry = stockMap.get(stock)!;
      // 每个 agent 对同一标的只计一次（取第一次出现的情绪）
      if (!entry.bullish.includes(agentName) && !entry.bearish.includes(agentName) && !entry.neutral.includes(agentName)) {
        if (s.sentiment === 'bullish') entry.bullish.push(agentName);
        else if (s.sentiment === 'bearish') entry.bearish.push(agentName);
        else entry.neutral.push(agentName);
      }
    }
  }
  if (stockMap.size === 0) return [];
  const result: SentimentSummaryItem[] = [];
  for (const [stock, { bullish, bearish, neutral }] of stockMap) {
    const total = bullish.length + bearish.length + neutral.length;
    let overallSentiment: 'bullish' | 'bearish' | 'neutral' | 'divided' = 'neutral';
    if (bullish.length > bearish.length && bullish.length > neutral.length) overallSentiment = 'bullish';
    else if (bearish.length > bullish.length && bearish.length > neutral.length) overallSentiment = 'bearish';
    else if (neutral.length > bullish.length && neutral.length > bearish.length) overallSentiment = 'neutral';
    else if (total > 1 && bullish.length !== bearish.length) overallSentiment = bullish.length > bearish.length ? 'bullish' : 'bearish';
    else if (total > 1) overallSentiment = 'divided';
    result.push({ stock, bullishAgents: bullish, bearishAgents: bearish, neutralAgents: neutral, overallSentiment });
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
const BUBBLE_BG = 'bg-[#F8F8F8]';

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

/** 工具图标 — 分析K线数据 (蜡烛图) */
const ToolKlineIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect x="1" y="1" width="18" height="18" rx="5" fill="#F5F3FF" stroke="#C4B5FD" strokeWidth="0.5" />
    {/* K线蜡烛 */}
    <line x1="6" y1="4" x2="6" y2="16" stroke="#8B5CF6" strokeWidth="1" opacity="0.4" />
    <rect x="4.5" y="6" width="3" height="5" rx="0.5" fill="#EF4444" />
    <line x1="10" y1="5" x2="10" y2="15" stroke="#8B5CF6" strokeWidth="1" opacity="0.4" />
    <rect x="8.5" y="7" width="3" height="5" rx="0.5" fill="#22C55E" />
    <line x1="14" y1="4" x2="14" y2="14" stroke="#8B5CF6" strokeWidth="1" opacity="0.4" />
    <rect x="12.5" y="5" width="3" height="6" rx="0.5" fill="#EF4444" />
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

/** 标的情绪图标 — 用于标题 */
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
      <div className="rounded-full overflow-hidden bg-white">
        <AgentAvatar type={getAvatarTypeByName(name, agents)} size={size} />
      </div>
    </div>
  </div>
);

/** 情绪汇总区块 — 共享组件，用于主持人分析卡片和分析报告弹窗 */
const SentimentSection = ({ items, agents, compact = false }: { items: SentimentSummaryItem[]; agents: Agent[]; compact?: boolean }) => {
  if (!items || items.length === 0) return null;
  const avatarSize = compact ? 22 : 24;
  return (
    <div className="space-y-3">
      {/* Section Title */}
      <div className="flex items-center gap-2">
        <SentimentChartIcon size={compact ? 18 : 20} />
        <h4 className={`${compact ? 'text-[14px]' : 'text-[15px]'} font-bold text-black`}>标的情绪</h4>
      </div>

      {/* Stock Cards */}
      {items.map((item, index) => {
        const total = item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length;
        const bullishPct = total > 0 ? (item.bullishAgents.length / total) * 100 : 0;
        const neutralPct = total > 0 ? (item.neutralAgents.length / total) * 100 : 0;
        const bearishPct = total > 0 ? (item.bearishAgents.length / total) * 100 : 0;

        return (
          <div key={index} className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            {/* Stock Header Row */}
            <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-2.5">
              <span className="flex-shrink-0">
                {item.overallSentiment === 'bullish' ? <BullishIcon size={16} /> :
                 item.overallSentiment === 'bearish' ? <BearishIcon size={16} /> :
                 item.overallSentiment === 'divided' ? <DividedIcon size={16} /> : <NeutralIcon size={16} />}
              </span>
              <span className="text-[14px] font-bold text-black">{item.stock}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                item.overallSentiment === 'bullish' ? 'bg-red-50 text-[#E05454] border border-red-100' :
                item.overallSentiment === 'bearish' ? 'bg-green-50 text-[#2EA66E] border border-green-100' :
                item.overallSentiment === 'divided' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                'bg-[#F5F5F5] text-[#999999] border border-[#EEEEEE]'
              }`}>
                {item.overallSentiment === 'bullish' ? '看涨' :
                 item.overallSentiment === 'bearish' ? '看跌' :
                 item.overallSentiment === 'divided' ? '多空分歧' : '中性'}
              </span>
            </div>

            {/* Sentiment Bar + Avatars aligned below */}
            <div className="px-4 pb-4">
              {/* Progress Bar */}
              <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden flex">
                {bullishPct > 0 && (
                  <div className="h-full" style={{ width: `${bullishPct}%`, background: 'linear-gradient(90deg, #EF4444, #F87171)', borderRadius: bearishPct === 0 && neutralPct === 0 ? '9999px' : '9999px 0 0 9999px' }} />
                )}
                {neutralPct > 0 && (
                  <div className="h-full" style={{ width: `${neutralPct}%`, background: '#D4D4D4', borderRadius: bullishPct === 0 && bearishPct === 0 ? '9999px' : bullishPct === 0 ? '9999px 0 0 9999px' : bearishPct === 0 ? '0 9999px 9999px 0' : '0' }} />
                )}
                {bearishPct > 0 && (
                  <div className="h-full" style={{ width: `${bearishPct}%`, background: 'linear-gradient(90deg, #4ADE80, #22C55E)', borderRadius: bullishPct === 0 && neutralPct === 0 ? '9999px' : '0 9999px 9999px 0' }} />
                )}
              </div>

              {/* Avatars Row — aligned under corresponding bar segments */}
              <div className="flex mt-2.5" style={{ minHeight: avatarSize + 4 }}>
                {/* Bullish segment avatars */}
                {bullishPct > 0 && (
                  <div className="flex justify-center" style={{ width: `${bullishPct}%` }}>
                    <div className="flex -space-x-1.5">
                      {item.bullishAgents.map((name, i) => (
                        <SentimentAvatar key={i} name={name} borderColor="#EF4444" agents={agents} size={avatarSize} />
                      ))}
                    </div>
                  </div>
                )}
                {/* Neutral segment avatars */}
                {neutralPct > 0 && (
                  <div className="flex justify-center" style={{ width: `${neutralPct}%` }}>
                    <div className="flex -space-x-1.5">
                      {item.neutralAgents.map((name, i) => (
                        <SentimentAvatar key={i} name={name} borderColor="#AAAAAA" agents={agents} size={avatarSize} />
                      ))}
                    </div>
                  </div>
                )}
                {/* Bearish segment avatars */}
                {bearishPct > 0 && (
                  <div className="flex justify-center" style={{ width: `${bearishPct}%` }}>
                    <div className="flex -space-x-1.5">
                      {item.bearishAgents.map((name, i) => (
                        <SentimentAvatar key={i} name={name} borderColor="#22C55E" agents={agents} size={avatarSize} />
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
  );
};

/** 根据工具名称返回对应图标 */
const getToolIcon = (toolName: string, size = 18) => {
  switch (toolName) {
    case 'getStockPrice': return <ToolStockPriceIcon size={size} />;
    case 'getLatestNews': return <ToolNewsIcon size={size} />;
    case 'getKlineData': return <ToolKlineIcon size={size} />;
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

  // 构建 agent 名称列表（按长度降序，优先匹配长名称）
  const agentNames = agents
    .map(a => a.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (agentNames.length === 0) return content;

  // 构建正则：匹配 @AgentName（贪婪匹配已知名称）
  const escapedNames = agentNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionRegex = new RegExp(`(@(?:${escapedNames.join('|')}))`, 'g');

  const parts = content.split(mentionRegex);
  if (parts.length === 1) return content; // 没有匹配到任何 @mention

  return parts.map((part, idx) => {
    if (part.startsWith('@')) {
      const mentionedName = part.slice(1);
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

// localStorage key
const HISTORY_TOPICS_KEY = 'multiagent_history_topics';

// 保存讨论到localStorage
const saveDiscussionToHistory = (discussion: Discussion) => {
  try {
    const stored = localStorage.getItem(HISTORY_TOPICS_KEY);
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
    localStorage.setItem(HISTORY_TOPICS_KEY, JSON.stringify(limitedTopics));
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
  const [showSummary, setShowSummary] = useState(false);
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
  const [showMentionPopup, setShowMentionPopup] = useState(false); // 是否显示 @-mention 弹窗
  const [activeToolTip, setActiveToolTip] = useState<string | null>(null); // 当前展开的工具提示 key (roundIdx-commentIdx-toolIdx)
  const [mentionFilter, setMentionFilter] = useState(''); // @-mention 过滤关键词
  const [mentionCursorPos, setMentionCursorPos] = useState(0); // @符号在输入框中的位置
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const hasStartedRef = useRef(false);
  const isScrollingToBottomRef = useRef(false); // 标记是否正在滚动到底部

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
  useEffect(() => {
    if (!userScrolledUp && contentRef.current) {
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [rounds.length, currentRoundComments.size, userScrolledUp, summaryStreamStatus, currentSummaryText]);

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
            
            if (data.type === 'chunk') {
              // chunk 到达 → typing 状态
              summaryBuffer += data.content;
              // 从 JSON 流中提取 overallSummary 纯文本展示
              const extracted = extractSummaryFromJsonStream(summaryBuffer);
              if (extracted) {
                setSummaryStreamStatus('typing');
                setCurrentSummaryText(extracted);
              } else {
                // 还没到 overallSummary 字段，保持 thinking 状态
                setSummaryStreamStatus('thinking');
              }
            } else if (data.type === 'done') {
              roundSummary = data.roundSummary;
              updatedSession = data.session;
              setCurrentSummaryText(data.roundSummary?.overallSummary || '');
              setSummaryStreamStatus(null); // 完成
              if (data.moderatorPrompts?.systemPrompt && data.moderatorPrompts?.userPrompt) {
                currentRoundPromptsRef.current.moderator = {
                  systemPrompt: data.moderatorPrompts.systemPrompt,
                  userPrompt: data.moderatorPrompts.userPrompt,
                };
              }
            } else if (data.type === 'error') {
              setSummaryStreamStatus(null);
              // 标记错误，循环结束后统一抛出
              roundSummary = null;
              updatedSession = null;
              console.error('Summary stream error:', data.error);
            }
          } catch (e) {
            console.error('Error parsing summary SSE data:', e);
          }
        }
      }
    }

    setSummaryStreamStatus(null);

    if (!roundSummary || !updatedSession) {
      throw new Error('Failed to get complete summary');
    }

    return { roundSummary, updatedSession };
  };

  // 辅助：构建 moderatorAnalysis 对象
  // agentSentiments: 可选参数，用于在 LLM 未生成 sentimentSummary 时从 agent 数据构建 fallback
  const buildModeratorAnalysis = (roundSummary: any, roundIndex: number, agentSentiments?: Array<{ agentName: string; sentiments?: StockSentiment[] }>) => ({
    round: roundSummary.roundIndex || roundIndex,
    consensusLevel: roundSummary.consensusLevel ?? 50,
    summary: currentSummaryText || roundSummary.overallSummary || '本轮讨论已完成',
    newPoints: (roundSummary.insights && roundSummary.insights.length > 0) 
      ? roundSummary.insights.slice(0, 2) 
      : ['暂无新观点'],
    consensus: (roundSummary.consensus && roundSummary.consensus.length > 0)
      ? roundSummary.consensus.map((c: any) => ({
          content: c.point || '',
          agents: c.supportingAgents || [],
          percentage: Math.round(((c.supportCount || 0) / (c.totalAgents || discussion.agents.length)) * 100),
        }))
      : [],
    disagreements: (roundSummary.conflicts && roundSummary.conflicts.length > 0)
      ? roundSummary.conflicts.map((c: any) => ({
          topic: c.issue || '',
          description: (c.positions && c.positions.length > 0)
            ? c.positions.map((p: any) => `${p.agentName}: ${p.position}`).join('; ')
            : '暂无详细描述',
          supportAgents: (c.positions && c.positions.length > 0)
            ? c.positions.slice(0, 2).map((p: any) => ({
                name: p.agentName || 'Unknown',
                color: discussion.agents.find(a => a.name === p.agentName)?.color || 'bg-gray-500',
              }))
            : [],
          opposeAgents: [],
        }))
      : [],
    sentimentSummary: (() => {
      // 优先使用 LLM 生成的 sentimentSummary
      if (roundSummary.sentimentSummary && Array.isArray(roundSummary.sentimentSummary) && roundSummary.sentimentSummary.length > 0) {
        return roundSummary.sentimentSummary.map((s: any) => ({
          stock: s.stock || '',
          bullishAgents: s.bullishAgents || [],
          bearishAgents: s.bearishAgents || [],
          neutralAgents: s.neutralAgents || [],
          overallSentiment: s.overallSentiment || 'neutral',
        }));
      }
      // Fallback: 从 agent 的 sentiments 数据汇总构建
      if (agentSentiments && agentSentiments.length > 0) {
        const fallback = buildSentimentSummaryFromAgentData(agentSentiments);
        if (fallback.length > 0) return fallback;
      }
      return undefined;
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

      const response = await fetch('/api/agents/reply/stream', {
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
    let replies: Array<{ agentId: string; agentName: string; content: string; replyRound: number; targetAgentId?: string; targetAgentName?: string; sentiments?: StockSentiment[]; toolCalls?: ToolCallRecord[]; completedAt?: number }> = [];

    try {
      const sessionData = discussion.sessionData;
      
      // 步骤 1: 依次请求每个 Agent 的观点阐述（逐个发言，像群聊一样）

      for (const agent of discussion.agents) {
        const response = await fetch('/api/agents/speech/stream', {
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

        // 保存agent的prompts（speech phase）
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

      // 步骤 2: 每个 Agent 进行 1 次针对性回复（并行）
      setCurrentRoundStatus('review');
      
      replies = await executeReplyBatch(1, 1, speeches, []);

      // 步骤 3: 流式请求总结
      setCurrentRoundStatus('summary');
      setCurrentSummaryText('');
      
      // 准备 summary 数据
      const agentsSpeeches = speeches.map(s => ({
        agentId: s.agentId,
        agentName: s.agentName,
        speech: s.content,
      }));

      const agentsReplies = replies.map(r => ({
        agentId: r.agentId,
        agentName: r.agentName,
        reply: r.content,
        replyRound: r.replyRound,
      }));

      const summaryResponse = await fetch('/api/rounds/summary/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: discussion.id,
          roundIndex: 1,
          agentsSpeeches,
          agentsReviews: [],
          agentsReplies,
          sessionData: sessionData,
        }),
      });

      const { roundSummary, updatedSession } = await handleSummaryStream(summaryResponse);

      // 收集所有 comments（speech + reply）— 包含 completedAt 和 toolCalls 用于持久化
      setCurrentRoundComments(prev => {
        const allComments: AgentComment[] = [];
        
        // 添加观点阐述
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

        // 添加针对性回复
        for (const reply of replies) {
          allComments.push({
            agentId: reply.agentId,
            agentName: reply.agentName,
            agentColor: discussion.agents.find(a => a.id === reply.agentId)?.color || 'bg-gray-500',
            content: reply.content,
            expanded: false,
            type: 'reply',
            replyRound: 1,
            targetAgentId: reply.targetAgentId,
            targetAgentName: reply.targetAgentName,
            sentiments: reply.sentiments,
            completedAt: reply.completedAt,
            toolCalls: dedupToolCalls(reply.toolCalls),
          });
        }

        // 收集 agent 的 sentiments 数据，用于 sentimentSummary fallback
        const agentSentimentsForSummary = [
          ...speeches.map(s => ({ agentName: s.agentName, sentiments: s.sentiments })),
          ...replies.map(r => ({ agentName: r.agentName, sentiments: r.sentiments })),
        ];
        const moderatorAnalysis = buildModeratorAnalysis(roundSummary, 1, agentSentimentsForSummary);

        const firstRound: RoundData = {
          roundIndex: roundSummary.roundIndex || 1,
          comments: allComments,
          moderatorAnalysis,
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
            moderator: currentRoundPromptsRef.current.moderator,
          },
        };

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
        }, 0);

        setCurrentRoundStatus('complete');
        setCurrentSummaryText('');
        return new Map();
      });
    } catch (error) {
      console.error('Error starting first round:', error);

      // 如果 speeches 和 replies 已完成但 summary 失败，仍然保存轮次数据（使用默认空分析）
      if (speeches.length > 0) {
        try {
          const fallbackComments: AgentComment[] = [];
          for (const speech of speeches) {
            fallbackComments.push({
              agentId: speech.agentId,
              agentName: speech.agentName,
              agentColor: discussion.agents.find(a => a.id === speech.agentId)?.color || 'bg-gray-500',
              content: speech.content,
              expanded: false,
              type: 'speech',
              sentiments: speech.sentiments,
              completedAt: speech.completedAt,
              toolCalls: dedupToolCalls(speech.toolCalls),
            });
          }
          for (const reply of replies) {
            fallbackComments.push({
              agentId: reply.agentId,
              agentName: reply.agentName,
              agentColor: discussion.agents.find(a => a.id === reply.agentId)?.color || 'bg-gray-500',
              content: reply.content,
              expanded: false,
              type: 'reply',
              replyRound: 1,
              targetAgentId: reply.targetAgentId,
              targetAgentName: reply.targetAgentName,
              sentiments: reply.sentiments,
              completedAt: reply.completedAt,
              toolCalls: dedupToolCalls(reply.toolCalls),
            });
          }
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
      setCurrentRoundComments(new Map()); // 清除流式状态，避免残留
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
              // 工具调用完成 → 记录结果，状态切换为 thinking（等待后续内容）
              collectedToolCalls.push({ toolName: data.toolName, args: data.args || {}, result: data.result });
              updateContent(fullContent, targetAgentId, targetAgentName, undefined, undefined, undefined, 'thinking', collectedToolCalls, undefined);
            } else if (data.type === 'content_replace') {
              // 后端修正内容（DSML 清理后的干净文本）
              fullContent = data.content || '';
              hasReceivedChunk = true;
              updateContent(fullContent, targetAgentId, targetAgentName, undefined, undefined, undefined, 'thinking', collectedToolCalls.length > 0 ? collectedToolCalls : undefined, undefined);
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
              fullContent = data.speech || data.review || data.reply || fullContent || '';
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
            console.error('Error parsing SSE data:', e);
            console.error('Problematic line:', line);
          }
        }
      }
    }

    return { content: fullContent, targetAgentId, targetAgentName, systemPrompt: savedSystemPrompt, userPrompt: savedUserPrompt, sentiments, toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined };
  };

  // 开始新一轮讨论（第二轮+：2次针对性回复 -> 总结，不再有观点阐述）
  const startNextRound = async (roundIndex: number, userQuestion?: string, userMentionedAgentIds?: string[]) => {
    if (!discussion.id || !discussion.sessionData || isLoading) return;

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

    try {
      const sessionData = discussion.sessionData;

      // 获取上一轮的原始发言数据（包含speech和reply）
      const previousRoundData = rounds.length > 0 ? rounds[rounds.length - 1] : null;
      const previousRoundComments = previousRoundData?.comments?.map(c => ({
        agentId: c.agentId,
        agentName: c.agentName,
        content: c.content,
      })) || [];

      // ===== Phase 1: 如果有用户提问，先进行 speech 阶段（带工具调用） =====
      const speeches: Array<{ agentId: string; agentName: string; content: string; sentiments?: StockSentiment[]; toolCalls?: ToolCallRecord[] }> = [];

      if (userQuestion) {
        setCurrentRoundStatus('speech');

        // 调用 /api/user/message/stream 让 agents 回答用户问题
        const response = await fetch('/api/user/message/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: discussion.id,
            userMessage: userQuestion,
            mentionedAgentIds: userMentionedAgentIds && userMentionedAgentIds.length > 0 ? userMentionedAgentIds : undefined,
            historyContext: buildHistoryContext(),
            sessionData,
          }),
        });

        if (!response.ok) throw new Error('Failed to send user question');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const activeAgents = new Map<string, AgentComment>();
        if (!reader) throw new Error('Failed to get response stream');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line?.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6).trim());
              if (!data || typeof data !== 'object') continue;

              switch (data.type) {
                case 'agent_start': {
                  const agentInfo = discussion.agents.find(a => a.id === data.agentId);
                  const comment: AgentComment = {
                    agentId: data.agentId,
                    agentName: data.agentName || agentInfo?.name || 'Agent',
                    agentColor: agentInfo?.color || 'bg-gray-500',
                    content: '',
                    expanded: false,
                    type: 'reply',
                    replyRound: 1,
                    targetAgentId: 'user',
                    targetAgentName: '你',
                    streamStatus: 'thinking',
                    toolCalls: [],
                  };
                  activeAgents.set(data.agentId, comment);
                  setCurrentRoundComments(prev => {
                    const newMap = new Map(prev);
                    newMap.set(data.agentId, comment);
                    return newMap;
                  });
                  break;
                }
                case 'tool_call': {
                  const existing = activeAgents.get(data.agentId);
                  if (existing) {
                    existing.streamStatus = 'tool_calling';
                    existing.activeToolCall = data.toolName;
                    existing.toolCalls = [...(existing.toolCalls || []), { toolName: data.toolName, args: data.args }];
                    setCurrentRoundComments(prev => { const m = new Map(prev); m.set(data.agentId, { ...existing }); return m; });
                  }
                  break;
                }
                case 'tool_result': {
                  const existing = activeAgents.get(data.agentId);
                  if (existing && existing.toolCalls) {
                    const tc = existing.toolCalls.find(t => t.toolName === data.toolName && !t.result);
                    if (tc) tc.result = data.result;
                    existing.activeToolCall = undefined;
                    existing.streamStatus = 'thinking';
                    setCurrentRoundComments(prev => { const m = new Map(prev); m.set(data.agentId, { ...existing }); return m; });
                  }
                  break;
                }
                case 'content_replace': {
                  // 后端修正内容（DSML 清理后的干净文本）
                  const existing = activeAgents.get(data.agentId);
                  if (existing) {
                    existing.content = data.content || '';
                    existing.streamStatus = 'thinking';
                    existing.activeToolCall = undefined;
                    setCurrentRoundComments(prev => { const m = new Map(prev); m.set(data.agentId, { ...existing }); return m; });
                  }
                  break;
                }
                case 'chunk': {
                  const existing = activeAgents.get(data.agentId);
                  if (existing) {
                    existing.content += data.content || '';
                    existing.activeToolCall = undefined;
                    const sentimentIdx = existing.content.indexOf('[SENTIMENT]');
                    let displayContent = sentimentIdx !== -1 ? existing.content.substring(0, sentimentIdx).trim() : existing.content;
                    // Strip DSML function call blocks (DeepSeek native format fallback)
                    const dsmlIdx = displayContent.search(/<[^>]*(?:function_calls|DSML)[^>]*>/i);
                    if (dsmlIdx !== -1) displayContent = displayContent.substring(0, dsmlIdx).trim();
                    // If SENTIMENT detected, main content is complete — stop showing "typing"
                    existing.streamStatus = sentimentIdx !== -1 ? undefined : 'typing';
                    setCurrentRoundComments(prev => { const m = new Map(prev); m.set(data.agentId, { ...existing, content: displayContent }); return m; });
                  }
                  break;
                }
                case 'agent_done': {
                  const existing = activeAgents.get(data.agentId);
                  if (existing) {
                    existing.content = data.content || existing.content;
                    existing.streamStatus = undefined;
                    existing.activeToolCall = undefined;
                    existing.sentiments = data.sentiments;
                    existing.completedAt = Date.now();
                    if (data.toolCalls) existing.toolCalls = data.toolCalls;
                    setCurrentRoundComments(prev => { const m = new Map(prev); m.set(data.agentId, { ...existing }); return m; });
                    speeches.push({
                      agentId: existing.agentId,
                      agentName: existing.agentName,
                      content: existing.content,
                      sentiments: existing.sentiments,
                      toolCalls: existing.toolCalls,
                    });
                    activeAgents.delete(data.agentId);
                  }
                  break;
                }
                case 'error': {
                  console.error('[UserQuestion] Stream error:', data.error);
                  break;
                }
              }
            } catch (e) {
              console.error('[UserQuestion] SSE parse error:', e);
            }
          }
        }
      }

      // ===== Phase 2: 针对性回复 =====
      setCurrentRoundStatus('review');

      // 确定上下文：如果有 speech（用户提问的回答），用它们作为上下文；否则用上一轮
      const contextForReplies = speeches.length > 0
        ? speeches.map(s => ({ agentId: s.agentId, agentName: s.agentName, content: s.content }))
        : previousRoundComments;

      const allReplies: Array<{ agentId: string; agentName: string; content: string; replyRound: number; targetAgentId?: string; targetAgentName?: string; sentiments?: StockSentiment[]; completedAt?: number; toolCalls?: ToolCallRecord[] }> = [];

      // 有用户提问时：reply1 已在 speech 阶段完成（agent 回答用户），这里只做 1 次针对性回复（replyRound=2）
      // 无用户提问时：2 次针对性回复（replyRound 1 和 2）
      const replyStart = userQuestion ? 2 : 1;
      const replyEnd = 2;

      for (let replyRound = replyStart; replyRound <= replyEnd; replyRound++) {
        let contextSpeeches: Array<{ agentId: string; agentName: string; content: string }>;
        let previousRepliesForBatch: Array<{ agentId: string; agentName: string; content: string; replyRound: number }>;

        if (replyRound === replyStart) {
          contextSpeeches = contextForReplies;
          previousRepliesForBatch = [];
        } else {
          contextSpeeches = contextForReplies;
          previousRepliesForBatch = allReplies.filter(r => r.replyRound < replyRound);
        }

        const batchReplies = await executeReplyBatch(
          replyRound,
          roundIndex,
          contextSpeeches,
          previousRepliesForBatch,
          previousRoundComments,
        );

        allReplies.push(...batchReplies);
      }

      // 步骤 2: 流式请求总结
      setCurrentRoundStatus('summary');
      setCurrentSummaryText('');

      const agentsReplies = allReplies.map(r => ({
        agentId: r.agentId,
        agentName: r.agentName,
        reply: r.content,
        replyRound: r.replyRound,
      }));

      const summaryResponse = await fetch('/api/rounds/summary/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: discussion.id,
          roundIndex: roundIndex,
          agentsSpeeches: speeches.map(s => ({ agentId: s.agentId, agentName: s.agentName, content: s.content })),
          agentsReviews: [],
          agentsReplies,
          sessionData: sessionData,
          ...(userQuestion ? { userQuestion } : {}),
        }),
      });

      const { roundSummary, updatedSession } = await handleSummaryStream(summaryResponse);

      // 收集所有 comments（reply to user + reply to agents）
      setCurrentRoundComments(() => {
        // 用户提问的回答（算作 replyRound 1，目标为用户）
        const userReplyComments: AgentComment[] = speeches.map(s => ({
          agentId: s.agentId,
          agentName: s.agentName,
          agentColor: discussion.agents.find(a => a.id === s.agentId)?.color || 'bg-gray-500',
          content: s.content,
          expanded: false,
          type: 'reply' as const,
          replyRound: 1,
          targetAgentId: 'user',
          targetAgentName: '你',
          sentiments: s.sentiments,
          toolCalls: dedupToolCalls(s.toolCalls),
          completedAt: Date.now(),
        }));

        // reply comments
        const replyComments: AgentComment[] = allReplies.map(reply => ({
          agentId: reply.agentId,
          agentName: reply.agentName,
          agentColor: discussion.agents.find(a => a.id === reply.agentId)?.color || 'bg-gray-500',
          content: reply.content,
          expanded: false,
          type: 'reply' as const,
          replyRound: reply.replyRound,
          targetAgentId: reply.targetAgentId,
          targetAgentName: reply.targetAgentName,
          sentiments: reply.sentiments,
          completedAt: reply.completedAt,
          toolCalls: dedupToolCalls(reply.toolCalls),
        }));

        const allComments = [...userReplyComments, ...replyComments];
        // 收集 agent 的 sentiments 数据，用于 sentimentSummary fallback
        const agentSentimentsForSummary = [
          ...speeches.map(s => ({ agentName: s.agentName, sentiments: s.sentiments })),
          ...allReplies.map(r => ({ agentName: r.agentName, sentiments: r.sentiments })),
        ];
        const moderatorAnalysis = buildModeratorAnalysis(roundSummary, roundIndex, agentSentimentsForSummary);

        const newRound: RoundData = {
          roundIndex: roundSummary.roundIndex || roundIndex,
          comments: allComments,
          moderatorAnalysis,
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
            moderator: currentRoundPromptsRef.current.moderator,
          },
          // 如果是用户提问触发的轮次，记录用户问题
          ...(userQuestion ? {
            userQuestion,
            userMentionedAgentIds: userMentionedAgentIds && userMentionedAgentIds.length > 0 ? userMentionedAgentIds : undefined,
            userQuestionTime: userQuestionTimestamp || Date.now(),
          } : {}),
        };

        const updatedRounds = [...rounds, newRound];

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
        }, 0);

        setCurrentRoundStatus('complete');
        setCurrentSummaryText('');
        return new Map();
      });
    } catch (error) {
      console.error('Error starting next round:', error);
      setCurrentRoundStatus('idle');
      setCurrentSummaryText('');
      setCurrentRoundComments(new Map()); // 清除流式状态，避免残留
      alert(`继续讨论失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ===================== 用户输入相关 =====================

  const parseMentions = (text: string): string[] => {
    const mentionedIds: string[] = [];
    const agentNames = discussion.agents.map(a => a.name).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const name of agentNames) {
      if (text.includes(`@${name}`)) {
        const agent = discussion.agents.find(a => a.name === name);
        if (agent && !mentionedIds.includes(agent.id)) {
          mentionedIds.push(agent.id);
        }
      }
    }
    return mentionedIds;
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
    setShowMentionPopup(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* 历史话题抽屉 */}
      <HistoryTopicsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectTopic={handleSelectHistoryTopic}
        isLoading={isLoading}
      />

      {/* Header - Figma DiscussionHeader 风格 */}
      <div className="sticky top-0 z-40 bg-white border-b border-[#F0F0F0]">
        <div className="flex items-center justify-between px-5 py-4">
          {/* Hamburger Menu - Left */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-10 h-10 rounded-full border border-[#E0E0E0] flex items-center justify-center active:scale-95 transition-transform"
          >
            <Menu className="w-5 h-5 text-[#333333]" strokeWidth={1.5} />
          </button>

          {/* Title - Center */}
          <h1 className="text-[16px] font-medium text-black flex-1 text-center px-2 truncate">{discussion.title}</h1>

          {/* New Chat Icon - Right */}
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-lg border border-[#E0E0E0] flex items-center justify-center active:scale-95 transition-transform"
          >
            <PenSquare className="w-5 h-5 text-[#333333]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* AnalysisReportEntry - Figma 风格 sticky card */}
      {rounds.length > 0 && rounds.some(r => r.moderatorAnalysis?.consensusLevel > 0) && (
        <div className="sticky top-[60px] z-30 px-5 py-3 bg-white">
          <button
            onClick={() => setShowSummary(true)}
            className="w-full bg-white rounded-[18px] p-5 border border-[#AAE874]/30 shadow-[0_4px_20px_rgba(170,232,116,0.15),0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(170,232,116,0.25),0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.98] transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#AAE874] to-[#8FD055] flex items-center justify-center shadow-[0_4px_12px_rgba(170,232,116,0.3)]">
                <FileText className="w-6 h-6 text-white" strokeWidth={2.5} />
                <div className="absolute inset-0 rounded-2xl bg-white/10" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[16px] font-bold text-black tracking-tight">分析报告</span>
                <span className="text-[12px] text-[#666666] font-medium mt-0.5">AI Council Summary Report</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#BBBBBB] group-hover:text-[#AAE874] group-hover:translate-x-0.5 transition-all duration-200" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-28">
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
                      {userTime && <span className="text-[11px] text-[#AAAAAA] font-normal">{formatTime(userTime)}</span>}
                      <span className="text-[14px] font-bold text-black">你</span>
                    </div>
                    <div className="bg-[#AAE874]/20 border border-[#AAE874]/30 rounded-2xl rounded-tr-sm px-4 py-3">
                      <div className="text-[14px] text-[#333333] leading-relaxed whitespace-pre-wrap break-words">
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
                const isExpanded = comment.expanded ?? false;
                const shouldTruncate = !isExpanded && !comment.streamStatus && comment.content.length > 200;
                const displayContent = shouldTruncate ? comment.content.substring(0, 200) + '...' : comment.content;

                return (
                <div key={`${round.roundIndex}-${comment.agentId}-${comment.type || 'speech'}-${comment.replyRound || 0}-${commentIdx}`} className="flex gap-3 px-5 py-4">
                  {/* 头像 + 工具图标列 */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                    <AgentAvatar type={getAvatarTypeById(comment.agentId, discussion.agents)} size={36} />
                    {/* 工具图标（已完成的，竖向排列在头像下方，点击显示提示气泡） */}
                    {comment.toolCalls && comment.toolCalls.length > 0 && !comment.streamStatus && (
                      comment.toolCalls.map((tc, tcIdx) => {
                        const tipKey = `${roundIdx}-${commentIdx}-${tcIdx}`;
                        return (
                          <div key={tcIdx} className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveToolTip(prev => prev === tipKey ? null : tipKey); }}>
                            {getToolIcon(tc.toolName, 20)}
                            {activeToolTip === tipKey && (
                              <div className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap bg-[#1a1a2e] text-white text-[12px] px-3 py-1.5 rounded-lg shadow-lg pointer-events-auto" style={{ minWidth: 'max-content' }}>
                                <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-[#1a1a2e]" />
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
                      <h4 className="text-[14px] font-bold text-black">{comment.agentName}</h4>
                      {/* 流式状态指示 / 完成时间 */}
                      {comment.streamStatus === 'thinking' ? (
                        <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                          thinking
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      ) : comment.streamStatus === 'tool_calling' ? (
                        <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                          {comment.activeToolCall ? (toolDisplayNames[comment.activeToolCall] || comment.activeToolCall) : '调用工具'}
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      ) : comment.streamStatus === 'typing' ? (
                        <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                          typing
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      ) : comment.completedAt ? (
                        <span className="text-[11px] text-[#AAAAAA] font-normal">{formatTime(comment.completedAt)}</span>
                      ) : null}
                    </div>
                    {/* 气泡：thinking/tool_calling状态显示占位气泡，有内容时显示正常气泡 */}
                    {comment.streamStatus === 'thinking' && !comment.content ? (
                      <div className={`${BUBBLE_BG} rounded-2xl rounded-tl-sm px-4 py-3 border border-[#EEEEEE]`}>
                        <div className="flex gap-1.5 py-1">
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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
                      <div className={`${BUBBLE_BG} rounded-2xl rounded-tl-sm px-4 py-3 border border-[#EEEEEE]`}>
                        <div className="text-[14px] text-[#333333] leading-relaxed whitespace-pre-wrap break-words">
                          {renderContentWithMentions(displayContent, discussion.agents)}
                          {comment.streamStatus === 'typing' && <span className="inline-block w-0.5 h-4 bg-[#AAE874] ml-0.5 animate-pulse" />}
                        </div>
                        {!comment.streamStatus && comment.content.length > 200 && (
                          <button
                            onClick={() => toggleExpanded(round.roundIndex, `${comment.agentId}-${comment.type || 'speech'}-${comment.replyRound || 0}-${commentIdx}`)}
                            className="mt-2 text-[13px] text-[#AAE874] font-medium hover:underline"
                          >
                            {isExpanded ? '收起' : '查看全部'}
                          </button>
                        )}
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
                                ? 'bg-red-50 text-[#E05454] border border-red-200'
                                : s.sentiment === 'bearish'
                                ? 'bg-green-50 text-[#2EA66E] border border-green-200'
                                : 'bg-[#F8F8F8] text-[#999999] border border-[#EEEEEE]'
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

              {/* Moderator Analysis - 参照 Figma 图片布局 */}
              {(!(round as any)._isInProgress || (round as any)._showModerator) && (() => {
                const isStreaming = !!(round as any)._summaryStreamStatus;
                const isComplete = !isStreaming && round.moderatorAnalysis.consensusLevel > 0;
                const cl = round.moderatorAnalysis.consensusLevel;
                const isModeratorCollapsed = !!collapsedModerator[round.roundIndex];
                return (
              <div className="mx-5 my-4">
                <div className="relative">
                  {/* Outer Glow */}
                  <div className="absolute inset-0 bg-[#AAE874] opacity-[0.08] blur-3xl rounded-[32px]" />

                  {/* Card Container */}
                  <div className="relative bg-white rounded-[28px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden border border-[#F0F0F0]">
                    {/* Card Header — 可点击折叠 */}
                    <div
                      className="px-5 py-4 flex items-center justify-between cursor-pointer active:bg-[#FAFAFA] transition-colors"
                      onClick={() => setCollapsedModerator(prev => ({ ...prev, [round.roundIndex]: !prev[round.roundIndex] }))}
                    >
                      <div className="flex items-center gap-2.5">
                        <AgentAvatar type="sphere" size={32} />
                        <h2 className="text-[15px] font-bold text-black leading-tight">主持人分析</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 流式状态 */}
                        {(round as any)._summaryStreamStatus === 'thinking' && (
                          <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                            thinking
                            <span className="inline-flex gap-0.5">
                              <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          </span>
                        )}
                        {(round as any)._summaryStreamStatus === 'typing' && (
                          <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                            typing
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
                        <ChevronDown className={`w-5 h-5 text-[#AAAAAA] transition-transform duration-200 ${isModeratorCollapsed ? '' : 'rotate-180'}`} />
                      </div>
                    </div>

                    {/* 可折叠内容区 */}
                    {!isModeratorCollapsed && (
                      <>
                        {/* Consensus Meter */}
                        {isComplete && (
                          <div className="px-5 pt-2 pb-4">
                            <div className="flex items-baseline justify-between mb-2">
                              <span className="text-[13px] text-[#666666] font-medium">共识度</span>
                              <span className={`text-[18px] font-bold ${cl >= 70 ? 'text-[#AAE874]' : 'text-[#F59E0B]'}`}>{cl}%</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="relative h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${cl}%`,
                                  background: `linear-gradient(90deg, #F59E0B 0%, ${cl >= 70 ? '#AAE874' : '#FFD93D'} 100%)`
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Summary & Sections */}
                        <div className="px-5 pb-5 space-y-4">
                          {/* thinking 状态占位 */}
                          {(round as any)._summaryStreamStatus === 'thinking' && !round.moderatorAnalysis.summary && (
                            <div className="flex gap-1.5 py-2 px-1">
                              <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                          )}

                          {/* Main Summary Text — 简洁展示 */}
                          {round.moderatorAnalysis.summary && (
                            <p className={`text-[13px] text-[#555555] leading-relaxed ${isStreaming ? '' : ''}`}>
                              <span className="text-[#999999] mr-1">💬</span>
                              {round.moderatorAnalysis.summary}
                              {isStreaming && <span className="inline-block w-0.5 h-4 bg-[#AAE874] ml-0.5 animate-pulse" />}
                            </p>
                          )}

                          {/* 本轮新观点 */}
                          {isComplete && round.moderatorAnalysis.newPoints && round.moderatorAnalysis.newPoints.length > 0 && round.moderatorAnalysis.newPoints[0] !== '暂无新观点' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-[#F59E0B]" strokeWidth={2.5} />
                                <h3 className="text-[14px] font-bold text-black">本轮新观点</h3>
                              </div>
                              <ul className="space-y-1.5 pl-6">
                                {round.moderatorAnalysis.newPoints.slice(0, 3).map((point, pIdx) => (
                                  <li key={pIdx} className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                                    <span className="text-[#F59E0B] font-bold flex-shrink-0">✦</span>
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 已达成共识 */}
                          {isComplete && round.moderatorAnalysis.consensus && round.moderatorAnalysis.consensus.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-[#AAE874]" strokeWidth={2.5} />
                                <h3 className="text-[14px] font-bold text-black">已达成共识</h3>
                              </div>
                              <ul className="space-y-2 pl-6">
                                {round.moderatorAnalysis.consensus.slice(0, 3).map((item, cIdx) => (
                                  <li key={cIdx} className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                                    <span className="text-[#AAE874] font-bold flex-shrink-0">•</span>
                                    <span className="flex-1">{item.content}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 仍在讨论 */}
                          {isComplete && round.moderatorAnalysis.disagreements && round.moderatorAnalysis.disagreements.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                                <h3 className="text-[14px] font-bold text-black">仍在讨论</h3>
                              </div>
                              <ul className="space-y-2 pl-6">
                                {round.moderatorAnalysis.disagreements.slice(0, 3).map((item, dIdx) => (
                                  <li key={dIdx} className="space-y-1">
                                    <p className="text-[13px] text-[#333333] leading-relaxed font-medium">{item.topic}</p>
                                    {/* 各方观点（如果有） */}
                                    {item.sides && item.sides.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                        {item.sides.map((side, sideIdx) => (
                                          <span key={sideIdx} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#666666]">
                                            <span className={`w-1.5 h-1.5 rounded-full ${sideIdx % 2 === 0 ? 'bg-[#5B8DEF]' : 'bg-[#F59E0B]'}`} />
                                            {side.position.length > 20 ? side.position.substring(0, 20) + '...' : side.position}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 情绪汇总 — 移至底部 */}
                          {isComplete && round.moderatorAnalysis.sentimentSummary && round.moderatorAnalysis.sentimentSummary.length > 0 && (
                            <SentimentSection items={round.moderatorAnalysis.sentimentSummary} agents={discussion.agents} compact />
                          )}
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

      {/* Back to Bottom Button */}
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute right-5 bottom-28 z-[9999] w-12 h-12 rounded-full bg-[#AAE874] shadow-[0_4px_20px_rgba(170,232,116,0.4)] flex items-center justify-center active:scale-95 transition-all hover:shadow-[0_6px_24px_rgba(170,232,116,0.5)]"
        >
          <ArrowDown className="w-5 h-5 text-white" strokeWidth={2.5} />
        </button>
      )}

      {/* Bottom Action Bar - Figma 风格 */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-4 z-50">
        {/* Glassmorphic Background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#AAE874]/10 via-white/95 to-white/90 backdrop-blur-xl" />

        <div className="relative flex items-center gap-3">
          {/* Prompts Button */}
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
            className="flex-shrink-0 w-10 h-10 rounded-full border border-[#E8E8E8] bg-white flex items-center justify-center active:scale-95 transition-transform"
            title="查看 Prompts"
          >
            <FileText className="w-4 h-4 text-[#666666]" />
          </button>

          {/* Input Area + @-mention Popup */}
          <div className="flex-1 relative">
            {/* @-mention 弹窗 */}
            {showMentionPopup && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl border border-[#E8E8E8] shadow-[0_4px_20px_rgba(0,0,0,0.12)] overflow-hidden z-[60]">
                <div className="px-3 py-2 text-[11px] text-[#999999] font-medium border-b border-[#F0F0F0]">选择要 @的专家</div>
                {discussion.agents
                  .filter(a => !mentionFilter || a.name.includes(mentionFilter))
                  .map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => handleSelectMention(agent)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F8F8F8] active:bg-[#F0F0F0] transition-colors"
                    >
                      <AgentAvatar type={getAvatarType(agent)} size={28} />
                      <span className="text-[14px] font-medium text-[#333333]">{agent.name}</span>
                    </button>
                  ))
                }
                {discussion.agents.filter(a => !mentionFilter || a.name.includes(mentionFilter)).length === 0 && (
                  <div className="px-3 py-3 text-[13px] text-[#999999] text-center">无匹配的专家</div>
                )}
              </div>
            )}

            {/* 可编辑输入框 — 对齐首页样式 */}
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
              placeholder={isLoading ? '专家们正在讨论中...' : '向专家提问'}
              rows={1}
              className="w-full px-5 py-3.5 bg-white border border-[#E8E8E8] rounded-full text-[15px] text-black placeholder:text-[#AAAAAA] shadow-[0_2px_8px_rgba(0,0,0,0.04)] resize-none overflow-hidden focus:outline-none focus:border-[#AAE874] focus:shadow-[0_0_0_3px_rgba(170,232,116,0.1)] transition-all disabled:bg-[#F8F8F8] disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>

          {/* Send Button (发送用户提问) */}
          <button
            onClick={() => {
              if (userInput.trim()) {
                handleUserSend();
              } else {
                handleContinueDiscussion();
              }
            }}
            disabled={isLoading}
            className={`
              flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all
              ${isLoading
                ? 'bg-[#E8E8E8] cursor-not-allowed opacity-50'
                : userInput.trim()
                  ? 'bg-[#AAE874] active:scale-95 shadow-[0_4px_16px_rgba(170,232,116,0.4)] hover:shadow-[0_6px_20px_rgba(170,232,116,0.5)]'
                  : 'bg-[#AAE874]/70 active:scale-95 shadow-[0_4px_16px_rgba(170,232,116,0.2)]'
              }
            `}
            title={userInput.trim() ? '发送提问' : '继续下一轮讨论'}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <SendHorizontal className="w-5 h-5 text-white" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {/* Prompts Modal */}
      {showPromptsModal && currentRoundPrompts && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-[10001]" onClick={() => setShowPromptsModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-[28px] overflow-hidden flex flex-col mx-4 shadow-[0_8px_40px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-black">Prompts - 第 {rounds.length} 轮</h2>
              <button
                onClick={() => setShowPromptsModal(false)}
                className="w-9 h-9 rounded-full bg-[#F8F8F8] flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="w-5 h-5 text-[#666666]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Agent Prompts */}
              <div className="mb-6">
                <h3 className="text-[16px] font-bold text-black mb-4">Agent Prompts</h3>
                {currentRoundPrompts.agents.map((agentPrompt, index) => (
                  <div key={index} className="mb-6 p-4 bg-[#F8F8F8] rounded-2xl border border-[#EEEEEE]">
                    <div className="flex items-center gap-2 mb-3">
                      <AgentAvatar type={getAvatarTypeById(agentPrompt.agentId, discussion.agents)} size={24} />
                      <h4 className="text-[14px] font-bold text-black">{agentPrompt.agentName}</h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[12px] font-medium text-[#666666] mb-1">System Prompt:</div>
                        <pre className="text-[12px] text-[#333333] bg-white p-3 rounded-xl border border-[#EEEEEE] overflow-x-auto whitespace-pre-wrap">{agentPrompt.systemPrompt}</pre>
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-[#666666] mb-1">User Prompt:</div>
                        <pre className="text-[12px] text-[#333333] bg-white p-3 rounded-xl border border-[#EEEEEE] overflow-x-auto whitespace-pre-wrap">{agentPrompt.userPrompt}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Moderator Prompts */}
              {currentRoundPrompts.moderator && (
                <div>
                  <h3 className="text-[16px] font-bold text-black mb-4">Moderator Prompts</h3>
                  <div className="p-4 bg-[#AAE874]/10 rounded-2xl border border-[#AAE874]/20">
                    <div className="space-y-3">
                      <div>
                        <div className="text-[12px] font-medium text-[#666666] mb-1">System Prompt:</div>
                        <pre className="text-[12px] text-[#333333] bg-white p-3 rounded-xl border border-[#EEEEEE] overflow-x-auto whitespace-pre-wrap">{currentRoundPrompts.moderator.systemPrompt}</pre>
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-[#666666] mb-1">User Prompt:</div>
                        <pre className="text-[12px] text-[#333333] bg-white p-3 rounded-xl border border-[#EEEEEE] overflow-x-auto whitespace-pre-wrap">{currentRoundPrompts.moderator.userPrompt}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#F0F0F0]">
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

      {/* Summary Modal - Figma 风格 */}
      {showSummary && (
        <div className="absolute inset-0 bg-black/30 flex items-end z-[10000]">
          <div className="w-full bg-white rounded-t-[32px] max-h-[90vh] overflow-hidden flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">
            <div className="px-5 pt-4 pb-3 flex items-center justify-center relative border-b border-[#F0F0F0]">
              <div className="w-12 h-1.5 bg-[#E0E0E0] rounded-full"></div>
              <button
                onClick={() => setShowSummary(false)}
                className="absolute right-5 top-3 w-9 h-9 bg-[#F8F8F8] rounded-full flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="w-5 h-5 text-[#666666]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-5">
                <h2 className="text-[22px] font-bold text-black mb-2">分析报告</h2>

                {/* Version Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#AAE874] rounded-full mb-4">
                  <span className="text-white text-[13px] font-medium">讨论中</span>
                  <span className="px-2 py-0.5 bg-white/20 text-white text-[11px] rounded">第{rounds.length > 0 ? rounds[rounds.length - 1].roundIndex : discussion.moderatorAnalysis.round}轮</span>
                </div>

                {/* Title */}
                <h3 className="text-[20px] font-bold text-black mb-4">{discussion.title}</h3>

                {/* Summary Content */}
                {(() => {
                  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
                  const analysis = latestRound?.moderatorAnalysis || discussion.moderatorAnalysis;

                  return (
                    <>
                      <div className="bg-[#F8F8F8] rounded-2xl p-4 mb-4 border border-[#EEEEEE]">
                        <p className="text-[14px] text-[#333333] leading-relaxed mb-3">
                          {analysis.summary}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex -space-x-2">
                            {discussion.agents.map((agent, i) => (
                              <div key={i} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden">
                                <AgentAvatar type={getAvatarType(agent)} size={24} />
                              </div>
                            ))}
                          </div>
                          <span className="text-[12px] text-[#999999]">参与者</span>
                          <div className="flex-1"></div>
                          <Check className="w-4 h-4 text-[#AAE874]" />
                          <span className="text-[12px] text-[#666666]">{analysis.consensus.length}</span>
                          <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                          <span className="text-[12px] text-[#666666]">{analysis.disagreements.length}</span>
                        </div>
                      </div>

                      {/* Consensus */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Check className="w-5 h-5 text-[#AAE874]" strokeWidth={2.5} />
                          <h4 className="text-[16px] font-bold text-black">关键共识</h4>
                        </div>
                        {analysis.consensus.map((item, index) => (
                          <div key={index} className="flex items-start gap-3 mb-3 p-4 bg-[#AAE874]/5 rounded-2xl border border-[#AAE874]/20">
                            <span className="text-[#AAE874] text-[16px] font-bold mt-0.5">{index + 1}</span>
                            <div className="flex-1">
                              <p className="text-[14px] text-[#333333] mb-2">{item.content}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] text-[#666666]">{item.agents.join(' · ')}</span>
                                <div className="flex-1"></div>
                                <span className="text-[14px] text-[#AAE874] font-bold">{item.percentage}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Disagreements */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
                          <h4 className="text-[16px] font-bold text-black">分歧焦点</h4>
                        </div>
                        {analysis.disagreements.map((item, index) => (
                          <div key={index} className="mb-3 p-4 bg-[#FAFAFA] rounded-2xl border border-[#EEEEEE]">
                            <h5 className="text-[14px] font-bold text-black mb-2">{item.topic}</h5>
                            <p className="text-[12px] text-[#666666] mb-3">{item.description}</p>
                          </div>
                        ))}
                      </div>

                      {/* Sentiment Summary — 共享组件 */}
                      {analysis.sentimentSummary && analysis.sentimentSummary.length > 0 && (
                        <SentimentSection items={analysis.sentimentSummary} agents={discussion.agents} />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="p-5 border-t border-[#F0F0F0]">
              <button
                onClick={() => setShowSummary(false)}
                className="w-full py-3.5 bg-[#AAE874] text-white rounded-full text-[14px] font-medium active:scale-[0.98] transition-transform shadow-[0_4px_16px_rgba(170,232,116,0.4)]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
