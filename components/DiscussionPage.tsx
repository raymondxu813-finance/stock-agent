'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, PenSquare, ChevronDown, ChevronRight, ArrowDown, X, FileText, SendHorizontal, Check, AlertCircle, Lightbulb } from 'lucide-react';
import type { Discussion, AgentComment, RoundData, StockSentiment, SentimentSummaryItem, Agent, AvatarType } from '@/types';
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

// Figma 统一气泡背景色
const BUBBLE_BG = 'bg-[#F8F8F8]';

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
        const currentRoundCommentsArray = Array.from(currentRoundComments.values());
        
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
              throw new Error(data.error);
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
  const buildModeratorAnalysis = (roundSummary: any, roundIndex: number) => ({
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
    sentimentSummary: (roundSummary.sentimentSummary && Array.isArray(roundSummary.sentimentSummary) && roundSummary.sentimentSummary.length > 0)
      ? roundSummary.sentimentSummary.map((s: any) => ({
          stock: s.stock || '',
          bullishAgents: s.bullishAgents || [],
          bearishAgents: s.bearishAgents || [],
          neutralAgents: s.neutralAgents || [],
          overallSentiment: s.overallSentiment || 'neutral',
        }))
      : undefined,
  });

  // 辅助：依次执行一批 reply 请求（逐个agent，模拟群聊）
  const executeReplyBatch = async (
    replyRound: number,
    roundIndex: number,
    allSpeeches: Array<{ agentId: string; agentName: string; content: string }>,
    previousReplies: Array<{ agentId: string; agentName: string; content: string; replyRound: number }>,
    previousRoundComments?: Array<{ agentId: string; agentName: string; content: string }>,
  ): Promise<Array<{ agentId: string; agentName: string; content: string; replyRound: number; targetAgentId?: string; targetAgentName?: string; systemPrompt?: string; userPrompt?: string; sentiments?: StockSentiment[] }>> => {
    const results: Array<{ agentId: string; agentName: string; content: string; replyRound: number; targetAgentId?: string; targetAgentName?: string; systemPrompt?: string; userPrompt?: string; sentiments?: StockSentiment[] }> = [];

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
        (content, targetId, targetName, _systemPrompt, _userPrompt, sentimentsData, streamStatus) => {
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
            });
            return newMap;
          });
        }
      );

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

    try {
      const sessionData = discussion.sessionData;
      
      // 步骤 1: 依次请求每个 Agent 的观点阐述（逐个发言，像群聊一样）
      const speeches: Array<{ agentId: string; agentName: string; content: string; sentiments?: StockSentiment[] }> = [];

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
          (content, _targetAgentId, _targetAgentName, _systemPrompt, _userPrompt, sentimentsData, streamStatus) => {
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
              });
              return newMap;
            });
          }
        );

        // 保存agent的prompts（speech phase）
        if (speech.systemPrompt && speech.userPrompt) {
          currentRoundPromptsRef.current.agents.push({
            agentId: agent.id,
            agentName: agent.name || 'Unknown Agent',
            systemPrompt: speech.systemPrompt,
            userPrompt: speech.userPrompt,
          });
        }

        speeches.push({ agentId: agent.id, agentName: agent.name || 'Unknown Agent', content: speech.content, sentiments: speech.sentiments });
      }

      // 步骤 2: 每个 Agent 进行 1 次针对性回复（并行）
      setCurrentRoundStatus('review');
      
      const replies = await executeReplyBatch(1, 1, speeches, []);

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

      // 收集所有 comments（speech + reply）
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
          });
        }

        const moderatorAnalysis = buildModeratorAnalysis(roundSummary, 1);

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
      setCurrentRoundStatus('idle');
      setCurrentSummaryText('');
      alert(`开始讨论失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = (roundIndex: number, commentKey: string) => {
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
    updateContent: (content: string, targetAgentId?: string, targetAgentName?: string, systemPrompt?: string, userPrompt?: string, sentiments?: StockSentiment[], streamStatus?: 'thinking' | 'typing') => void
  ): Promise<{ content: string; targetAgentId?: string; targetAgentName?: string; systemPrompt?: string; userPrompt?: string; sentiments?: StockSentiment[] }> => {
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
            } else if (data.type === 'chunk') {
              const chunkContent = data.content || '';
              fullContent += chunkContent;
              hasReceivedChunk = true;
              // 实时更新 UI（打字机效果）— 隐藏 [SENTIMENT] 标记及之后的内容
              const sentimentIdx = fullContent.indexOf('[SENTIMENT]');
              const displayContent = sentimentIdx !== -1 ? fullContent.substring(0, sentimentIdx).trim() : fullContent;
              updateContent(displayContent, targetAgentId, targetAgentName, undefined, undefined, undefined, 'typing');
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
              // 最终更新 UI — 不传 streamStatus 表示完成
              updateContent(fullContent, targetAgentId, targetAgentName, savedSystemPrompt, savedUserPrompt, sentiments, undefined);
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

    return { content: fullContent, targetAgentId, targetAgentName, systemPrompt: savedSystemPrompt, userPrompt: savedUserPrompt, sentiments };
  };

  // 开始新一轮讨论（第二轮+：2次针对性回复 -> 总结，不再有观点阐述）
  const startNextRound = async (roundIndex: number) => {
    if (!discussion.id || !discussion.sessionData || isLoading) return;

    setIsLoading(true);
    setCurrentRoundStatus('review'); // 直接进入回复阶段
    setCurrentRoundIndex(roundIndex);
    // 重置prompts收集
    currentRoundPromptsRef.current = { agents: [] };

    // 初始化评论状态（空的，会在回复时填充）
    setCurrentRoundComments(new Map());

    try {
      const sessionData = discussion.sessionData;
      
      // 获取上一轮的原始发言数据（所有comments，包含speech和reply）
      const previousRoundData = rounds.length > 0 ? rounds[rounds.length - 1] : null;
      const previousRoundComments = previousRoundData?.comments?.map(c => ({
        agentId: c.agentId,
        agentName: c.agentName,
        content: c.content,
      })) || [];

      // 收集所有2次回复
      const allReplies: Array<{ agentId: string; agentName: string; content: string; replyRound: number; targetAgentId?: string; targetAgentName?: string; sentiments?: StockSentiment[] }> = [];

      // 2次循环针对性回复
      for (let replyRound = 1; replyRound <= 2; replyRound++) {
        // 确定本次回复的上下文
        let contextSpeeches: Array<{ agentId: string; agentName: string; content: string }>;
        let previousRepliesForBatch: Array<{ agentId: string; agentName: string; content: string; replyRound: number }>;

        if (replyRound === 1) {
          // 第1次回复：基于上一轮最后一批回复/发言
          contextSpeeches = previousRoundComments;
          previousRepliesForBatch = [];
        } else {
          // 第2次回复：基于前几次回复内容
          contextSpeeches = previousRoundComments;
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
          agentsSpeeches: [], // 第二轮+没有观点阐述
          agentsReviews: [],
          agentsReplies,
          sessionData: sessionData,
        }),
      });

      const { roundSummary, updatedSession } = await handleSummaryStream(summaryResponse);

      // 收集所有 comments（全是 reply）
      setCurrentRoundComments(() => {
        const allComments: AgentComment[] = allReplies.map(reply => ({
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
        }));

        const moderatorAnalysis = buildModeratorAnalysis(roundSummary, roundIndex);

        const newRound: RoundData = {
          roundIndex: roundSummary.roundIndex || roundIndex,
          comments: allComments,
          moderatorAnalysis,
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
            moderator: currentRoundPromptsRef.current.moderator,
          },
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
      alert(`继续讨论失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
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
          {/* 多轮讨论瀑布流 */}
          {rounds.map((round, roundIdx) => (
            <div key={`round-${round.roundIndex}-${roundIdx}`}>
              {/* 轮次分隔 - 居中胶囊 */}
              <div className="flex justify-center py-4">
                <span className="px-4 py-1.5 bg-[#AAE874]/15 text-[#AAE874] text-[12px] font-bold rounded-full">
                  第 {round.roundIndex} 轮
                </span>
              </div>

              {/* Agent Comments - Figma ChatBubble 风格 */}
              {round.comments.map((comment, commentIdx) => {
                const isExpanded = comment.expanded ?? false;
                const shouldTruncate = !isExpanded && !comment.streamStatus && comment.content.length > 200;
                const displayContent = shouldTruncate ? comment.content.substring(0, 200) + '...' : comment.content;

                return (
                <div key={`${round.roundIndex}-${comment.agentId}-${comment.type || 'speech'}-${comment.replyRound || 0}-${commentIdx}`} className="flex gap-3 px-5 py-4">
                  {/* 3D Avatar */}
                  <div className="flex-shrink-0">
                    <AgentAvatar type={getAvatarTypeById(comment.agentId, discussion.agents)} size={36} />
                  </div>
                  {/* 名称 + 状态 + 气泡 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <h4 className="text-[14px] font-bold text-black">{comment.agentName}</h4>
                      {/* 回复目标指示 */}
                      {comment.type === 'reply' && comment.targetAgentName && !comment.streamStatus && (
                        <span className="text-[11px] text-[#999999] flex items-center gap-0.5">
                          → <span className="font-medium text-[#666666]">{comment.targetAgentName}</span>
                        </span>
                      )}
                      {comment.type === 'reply' && comment.replyRound && !comment.streamStatus && (
                        <span className="text-[11px] px-2 py-0.5 bg-[#AAE874]/15 text-[#AAE874] font-bold rounded-full">回复{comment.replyRound}</span>
                      )}
                      {/* 流式状态指示 - 绿色主题 */}
                      {comment.streamStatus === 'thinking' && (
                        <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                          thinking
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      )}
                      {comment.streamStatus === 'typing' && (
                        <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
                          typing
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </span>
                      )}
                    </div>
                    {/* 气泡：thinking状态显示占位气泡，有内容时显示正常气泡 */}
                    {comment.streamStatus === 'thinking' && !comment.content ? (
                      <div className={`${BUBBLE_BG} rounded-2xl rounded-tl-sm px-4 py-3 border border-[#EEEEEE]`}>
                        <div className="flex gap-1.5 py-1">
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    ) : (
                      <div className={`${BUBBLE_BG} rounded-2xl rounded-tl-sm px-4 py-3 border border-[#EEEEEE]`}>
                        <div className="text-[14px] text-[#333333] leading-relaxed whitespace-pre-wrap break-words">
                          {renderContentWithMentions(displayContent, discussion.agents)}
                          {comment.streamStatus === 'typing' && <span className="inline-block w-0.5 h-4 bg-[#AAE874] ml-0.5 animate-pulse" />}
                        </div>
                        {/* 展开/收起 — 仅对超过200字的完成态消息 */}
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
                    {/* 情绪标签 */}
                    {comment.sentiments && comment.sentiments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {comment.sentiments.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              s.sentiment === 'bullish'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : s.sentiment === 'bearish'
                                ? 'bg-green-50 text-green-600 border border-green-200'
                                : 'bg-[#F8F8F8] text-[#666666] border border-[#EEEEEE]'
                            }`}
                          >
                            <span>{s.sentiment === 'bullish' ? '📈' : s.sentiment === 'bearish' ? '📉' : '➖'}</span>
                            <span>{s.stock}</span>
                            <span>{s.sentiment === 'bullish' ? '看涨' : s.sentiment === 'bearish' ? '看跌' : '中性'}</span>
                            {s.confidence && (
                              <span className="opacity-60">
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

              {/* Moderator Analysis - Figma ConsensusCard 风格 */}
              {(!(round as any)._isInProgress || (round as any)._showModerator) && (() => {
                const isStreaming = !!(round as any)._summaryStreamStatus;
                const isComplete = !isStreaming && round.moderatorAnalysis.consensusLevel > 0;
                const cl = round.moderatorAnalysis.consensusLevel;
                return (
              <div className="mx-5 my-4">
                <div className="relative">
                  {/* Outer Glow */}
                  <div className="absolute inset-0 bg-[#AAE874] opacity-[0.08] blur-3xl rounded-[32px]" />

                  {/* Card Container */}
                  <div
                    className="relative bg-white rounded-[28px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden border border-[#F0F0F0] cursor-pointer"
                    onClick={() => setShowSummary(true)}
                  >
                    {/* Card Header */}
                    <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#AAE874]/15 flex items-center justify-center">
                          <span className="text-[14px]">🤖</span>
                        </div>
                        <h2 className="text-[15px] font-bold text-black">主持人分析</h2>
                        <span className="px-2 py-0.5 bg-[#AAE874]/15 text-[11px] text-[#AAE874] font-bold rounded-full">
                          第 {round.roundIndex} 轮
                        </span>
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
                      </div>
                      {isComplete && (
                        <button className="px-3 py-1.5 bg-[#AAE874] text-white text-[12px] font-medium rounded-full shadow-sm active:scale-95 transition-transform">
                          查看摘要
                        </button>
                      )}
                    </div>

                    {/* Consensus Meter */}
                    {isComplete && (
                      <div className="px-5 py-4 bg-gradient-to-br from-[#FEFEFE] to-[#FAFAFA]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px] text-[#666666] font-medium">共识度</span>
                          <span className={`text-[28px] font-bold ${cl >= 70 ? 'text-[#AAE874]' : 'text-[#F59E0B]'}`}>{cl}%</span>
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

                    {/* Summary Section */}
                    <div className="px-5 py-4 space-y-4">
                      {/* thinking 状态占位 */}
                      {(round as any)._summaryStreamStatus === 'thinking' && !round.moderatorAnalysis.summary && (
                        <div className="flex gap-1.5 py-2 px-1">
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-[#CCCCCC] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      )}

                      {/* Main Summary Text */}
                      {round.moderatorAnalysis.summary && (
                        <div className="bg-[#F8F8F8] rounded-2xl p-4 border border-[#EEEEEE]">
                          <p className={`text-[13px] text-[#333333] leading-relaxed ${isStreaming ? '' : 'line-clamp-5'}`}>
                            {round.moderatorAnalysis.summary}
                            {isStreaming && <span className="inline-block w-0.5 h-4 bg-[#AAE874] ml-0.5 animate-pulse" />}
                          </p>
                        </div>
                      )}

                      {/* 情绪汇总 */}
                      {isComplete && round.moderatorAnalysis.sentimentSummary && round.moderatorAnalysis.sentimentSummary.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {round.moderatorAnalysis.sentimentSummary.map((item, sIdx) => (
                            <span key={sIdx} className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg font-semibold ${
                              item.overallSentiment === 'bullish' ? 'bg-red-50 text-red-700 border border-red-200' :
                              item.overallSentiment === 'bearish' ? 'bg-green-50 text-green-700 border border-green-200' :
                              item.overallSentiment === 'divided' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-[#F8F8F8] text-[#666666] border border-[#EEEEEE]'
                            }`}>
                              {item.overallSentiment === 'bullish' ? '📈' :
                               item.overallSentiment === 'bearish' ? '📉' :
                               item.overallSentiment === 'divided' ? '⚔️' : '➖'}
                              <span>{item.stock}</span>
                              <span>{item.overallSentiment === 'bullish' ? '看涨' :
                               item.overallSentiment === 'bearish' ? '看跌' :
                               item.overallSentiment === 'divided' ? '多空分歧' : '中性'}</span>
                              <span className="text-[10px] opacity-60 font-normal">
                                {item.bullishAgents.length > 0 ? `涨${item.bullishAgents.length}` : ''}
                                {item.bearishAgents.length > 0 ? ` 跌${item.bearishAgents.length}` : ''}
                                {item.neutralAgents.length > 0 ? ` 平${item.neutralAgents.length}` : ''}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 新发现 New Viewpoints */}
                      {isComplete && round.moderatorAnalysis.newPoints && round.moderatorAnalysis.newPoints.length > 0 && round.moderatorAnalysis.newPoints[0] !== '暂无新观点' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-[#F59E0B]" strokeWidth={2.5} />
                            <h3 className="text-[14px] font-bold text-black">新发现</h3>
                          </div>
                          <ul className="space-y-1.5 pl-6">
                            {round.moderatorAnalysis.newPoints.slice(0, 3).map((point, pIdx) => (
                              <li key={pIdx} className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                                <span className="text-[#F59E0B] font-bold">✦</span>
                                <span className="line-clamp-2">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Consensus Achieved */}
                      {isComplete && round.moderatorAnalysis.consensus && round.moderatorAnalysis.consensus.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-[#AAE874]" strokeWidth={2.5} />
                            <h3 className="text-[14px] font-bold text-black">已达成共识</h3>
                          </div>
                          <ul className="space-y-2 pl-6">
                            {round.moderatorAnalysis.consensus.slice(0, 3).map((item, cIdx) => (
                              <li key={cIdx} className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                                <span className="text-[#AAE874] font-bold">•</span>
                                <span className="flex-1 line-clamp-2">{item.content}</span>
                                <span className={`text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                                  item.percentage >= 75 ? 'bg-[#AAE874]/15 text-[#7BC74D]' :
                                  item.percentage >= 50 ? 'bg-blue-100 text-blue-700' :
                                  'bg-[#F0F0F0] text-[#999999]'
                                }`}>{item.percentage}%</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Still Discussing */}
                      {isComplete && round.moderatorAnalysis.disagreements && round.moderatorAnalysis.disagreements.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                            <h3 className="text-[14px] font-bold text-black">仍在讨论</h3>
                          </div>
                          <ul className="space-y-2 pl-6">
                            {round.moderatorAnalysis.disagreements.slice(0, 2).map((item, dIdx) => (
                              <li key={dIdx} className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                                <span className="text-[#F59E0B] font-bold">•</span>
                                <span className="line-clamp-2">{item.topic}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* View Full Analysis */}
                    {isComplete && (
                      <div className="px-5 py-3 border-t border-[#F0F0F0] flex items-center justify-center">
                        <span className="text-[13px] text-[#AAE874] font-medium">查看完整分析</span>
                        <ChevronDown className="w-4 h-4 text-[#AAE874] ml-1" />
                      </div>
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

          {/* Status Text / Input */}
          <div className="flex-1 relative">
            <div className="w-full px-5 py-3 bg-white border border-[#E8E8E8] rounded-full text-[14px] text-[#AAAAAA] shadow-[0_2px_8px_rgba(0,0,0,0.04)] select-none">
              {isLoading ? '专家们正在讨论中...' : '点击发送继续下一轮讨论'}
            </div>
          </div>

          {/* Send / Continue Button */}
          <button
            onClick={handleContinueDiscussion}
            disabled={isLoading}
            className={`
              flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all
              ${isLoading
                ? 'bg-[#E8E8E8] cursor-not-allowed opacity-50'
                : 'bg-[#AAE874] active:scale-95 shadow-[0_4px_16px_rgba(170,232,116,0.4)] hover:shadow-[0_6px_20px_rgba(170,232,116,0.5)]'
              }
            `}
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

                      {/* Sentiment Summary */}
                      {analysis.sentimentSummary && analysis.sentimentSummary.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span>📊</span>
                            <h4 className="text-[16px] font-bold text-black">标的情绪</h4>
                          </div>
                          {analysis.sentimentSummary.map((item, index) => (
                            <div key={index} className="mb-3 p-4 bg-[#FAFAFA] rounded-2xl border border-[#EEEEEE]">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-[16px]">
                                  {item.overallSentiment === 'bullish' ? '📈' :
                                   item.overallSentiment === 'bearish' ? '📉' :
                                   item.overallSentiment === 'divided' ? '⚔️' : '➖'}
                                </span>
                                <h5 className="text-[14px] font-bold text-black">{item.stock}</h5>
                                <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${
                                  item.overallSentiment === 'bullish' ? 'bg-red-100 text-red-700' :
                                  item.overallSentiment === 'bearish' ? 'bg-green-100 text-green-700' :
                                  item.overallSentiment === 'divided' ? 'bg-amber-100 text-amber-700' :
                                  'bg-[#F0F0F0] text-[#666666]'
                                }`}>
                                  {item.overallSentiment === 'bullish' ? '整体看涨' :
                                   item.overallSentiment === 'bearish' ? '整体看跌' :
                                   item.overallSentiment === 'divided' ? '多空分歧' : '整体中性'}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {item.bullishAgents.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-red-500 w-8">看涨</span>
                                    <div className="flex-1 flex flex-wrap gap-1">
                                      {item.bullishAgents.map((name, i) => (
                                        <span key={i} className="text-[11px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {item.bearishAgents.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-green-500 w-8">看跌</span>
                                    <div className="flex-1 flex flex-wrap gap-1">
                                      {item.bearishAgents.map((name, i) => (
                                        <span key={i} className="text-[11px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {item.neutralAgents.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[#999999] w-8">中性</span>
                                    <div className="flex-1 flex flex-wrap gap-1">
                                      {item.neutralAgents.map((name, i) => (
                                        <span key={i} className="text-[11px] px-1.5 py-0.5 bg-[#F0F0F0] text-[#666666] rounded-full">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* Sentiment Bar */}
                              <div className="mt-2 h-2 bg-[#F0F0F0] rounded-full overflow-hidden flex">
                                {item.bullishAgents.length > 0 && (
                                  <div className="bg-red-400 h-full" style={{ width: `${(item.bullishAgents.length / (item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length)) * 100}%` }} />
                                )}
                                {item.neutralAgents.length > 0 && (
                                  <div className="bg-[#CCCCCC] h-full" style={{ width: `${(item.neutralAgents.length / (item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length)) * 100}%` }} />
                                )}
                                {item.bearishAgents.length > 0 && (
                                  <div className="bg-green-400 h-full" style={{ width: `${(item.bearishAgents.length / (item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length)) * 100}%` }} />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
