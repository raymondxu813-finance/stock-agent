'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, Edit3, ChevronDown, ArrowDown, X, FileText, Send } from 'lucide-react';
import type { Discussion, AgentComment, RoundData, StockSentiment, SentimentSummaryItem, Agent } from '@/types';
import { HistoryTopicsDrawer } from './HistoryTopicsDrawer';

// 气泡背景色映射：根据agent的color类名返回对应的淡色背景
const getBubbleBgColor = (agentColor: string): string => {
  if (agentColor.includes('emerald')) return 'bg-emerald-50';
  if (agentColor.includes('orange')) return 'bg-orange-50';
  if (agentColor.includes('gray-800') || agentColor.includes('gray-900')) return 'bg-slate-100';
  if (agentColor.includes('blue')) return 'bg-blue-50';
  if (agentColor.includes('purple')) return 'bg-purple-50';
  if (agentColor.includes('red')) return 'bg-red-50';
  if (agentColor.includes('indigo')) return 'bg-indigo-50';
  if (agentColor.includes('amber')) return 'bg-amber-50';
  return 'bg-gray-50';
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
              setSummaryStreamStatus('typing');
              summaryBuffer += data.content;
              setCurrentSummaryText(summaryBuffer);
            } else if (data.type === 'done') {
              roundSummary = data.roundSummary;
              updatedSession = data.session;
              setCurrentSummaryText(data.roundSummary?.overallSummary || summaryBuffer);
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

  const toggleExpanded = (roundIndex: number, agentId: string) => {
    const updatedRounds = rounds.map(round => {
      if (round.roundIndex === roundIndex) {
        return {
          ...round,
          comments: round.comments.map(comment =>
            comment.agentId === agentId
              ? { ...comment, expanded: !(comment.expanded ?? false) }
              : { ...comment, expanded: comment.expanded ?? false }
          ),
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
    <div className="h-full flex flex-col bg-[#ededed] relative">
      {/* 历史话题抽屉 - 复用共享组件 */}
      <HistoryTopicsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectTopic={handleSelectHistoryTopic}
        isLoading={isLoading}
      />

      {/* Header - 群聊风格 */}
      <div className="bg-white px-4 py-2.5 flex items-center border-b border-gray-200 relative z-10">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 text-center px-2">
          <h1 className="text-base font-medium text-gray-900 leading-tight truncate">{discussion.title}</h1>
        </div>
        <button
          onClick={onBack}
          className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Edit3 className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-24" style={{ maxHeight: 'calc(100vh - 110px)' }}>
        <div className="px-4 pt-2 pb-4 space-y-2">
          {/* Session Header - 群公告风格窄条 */}
          <div 
            className="sticky top-0 z-20 flex justify-center py-1.5"
            onClick={() => setShowSummary(true)}
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-white/90 transition-colors shadow-sm border border-gray-200/50">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-gray-600 max-w-[200px] truncate">{discussion.title}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-indigo-500">第{rounds.length > 0 ? rounds[rounds.length - 1].roundIndex : 1}轮</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </div>
          </div>

          {/* 多轮讨论瀑布流 - 群聊风格 */}
          {rounds.map((round, roundIdx) => (
            <div key={`round-${round.roundIndex}-${roundIdx}`} className="space-y-3">
              {/* 轮次分隔 - 居中胶囊 */}
              <div className="flex justify-center py-2">
                <span className="bg-gray-200/80 text-gray-500 text-xs px-3 py-1 rounded-full">
                  第 {round.roundIndex} 轮讨论
                </span>
              </div>

              {/* Agent Comments - 群聊气泡 */}
              {round.comments.map((comment, commentIdx) => (
                <div key={`${round.roundIndex}-${comment.agentId}-${comment.type || 'speech'}-${comment.replyRound || 0}-${commentIdx}`} className="flex items-start gap-2.5">
                  {/* 头像 */}
                  <div className={`w-9 h-9 ${comment.agentColor} rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm font-medium shadow-sm`}>
                    {comment.agentName[0]}
                  </div>
                  {/* 名称 + 状态 + 气泡 */}
                  <div className="max-w-[85%] min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-gray-500">{comment.agentName}</span>
                      {comment.type === 'reply' && comment.replyRound && !comment.streamStatus && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">回复{comment.replyRound}</span>
                      )}
                      {/* 流式状态指示 */}
                      {comment.streamStatus === 'thinking' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 animate-pulse">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                          </span>
                          thinking
                        </span>
                      )}
                      {comment.streamStatus === 'typing' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                          <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                          typing
                        </span>
                      )}
                    </div>
                    {/* 气泡：thinking状态显示占位气泡，有内容时显示正常气泡 */}
                    {comment.streamStatus === 'thinking' && !comment.content ? (
                      <div className={`${getBubbleBgColor(comment.agentColor)} rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm`}>
                        <div className="flex gap-1 py-1">
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    ) : (
                      <div className={`${getBubbleBgColor(comment.agentColor)} rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm`}>
                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                          {renderContentWithMentions(comment.content, discussion.agents)}
                        </div>
                      </div>
                    )}
                    {/* 情绪标签 */}
                    {comment.sentiments && comment.sentiments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {comment.sentiments.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              s.sentiment === 'bullish'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : s.sentiment === 'bearish'
                                ? 'bg-green-50 text-green-600 border border-green-200'
                                : 'bg-gray-50 text-gray-500 border border-gray-200'
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
              ))}

              {/* Moderator Analysis - 居中系统消息 */}
              {/* 仅在已完成的轮次 或 summary阶段 才显示主持人区块 */}
              {(!(round as any)._isInProgress || (round as any)._showModerator) && (() => {
                const isStreaming = !!(round as any)._summaryStreamStatus;
                const isComplete = !isStreaming && round.moderatorAnalysis.consensusLevel > 0;
                const cl = round.moderatorAnalysis.consensusLevel;
                return (
              <div className="flex justify-center py-1.5">
                <div 
                  className="w-[92%] bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3.5 shadow-sm border border-gray-200/60 cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setShowSummary(true)}
                >
                  {/* 标题行：主持人头像 + 名称 + 状态 */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-800">主持人总结</span>
                    {/* 流式状态 */}
                    {(round as any)._summaryStreamStatus === 'thinking' && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 animate-pulse">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                        </span>
                        thinking
                      </span>
                    )}
                    {(round as any)._summaryStreamStatus === 'typing' && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </span>
                        typing
                      </span>
                    )}
                  </div>

                  {/* 共识度进度条 — 完成后突出显示 */}
                  {isComplete && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-gray-500">共识度</span>
                        <span className={`text-xs font-bold ${
                          cl >= 80 ? 'text-green-600' :
                          cl >= 60 ? 'text-blue-600' :
                          cl >= 40 ? 'text-yellow-600' :
                          'text-red-500'
                        }`}>
                          {cl}%
                          <span className="font-normal text-[10px] ml-1">
                            {cl >= 80 ? '高度共识' : cl >= 60 ? '有进展' : cl >= 40 ? '有分歧' : '分歧较大'}
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cl >= 80 ? 'bg-green-500' :
                            cl >= 60 ? 'bg-blue-500' :
                            cl >= 40 ? 'bg-yellow-500' :
                            'bg-red-400'
                          }`}
                          style={{ width: `${cl}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* thinking 状态占位 */}
                  {(round as any)._summaryStreamStatus === 'thinking' && !round.moderatorAnalysis.summary && (
                    <div className="flex gap-1 py-2 px-1">
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  )}

                  {/* 总结正文 — 多显示一些 */}
                  {round.moderatorAnalysis.summary && (
                    <p className={`text-[13px] text-gray-700 leading-relaxed mb-2 ${isStreaming ? '' : 'line-clamp-5'}`}>
                      {round.moderatorAnalysis.summary}
                    </p>
                  )}

                  {/* 情绪汇总 — 完成后显示，放在共识前面更醒目 */}
                  {isComplete && round.moderatorAnalysis.sentimentSummary && round.moderatorAnalysis.sentimentSummary.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {round.moderatorAnalysis.sentimentSummary.map((item, sIdx) => (
                        <span key={sIdx} className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg font-semibold ${
                          item.overallSentiment === 'bullish' ? 'bg-red-50 text-red-700 border border-red-200' :
                          item.overallSentiment === 'bearish' ? 'bg-green-50 text-green-700 border border-green-200' :
                          item.overallSentiment === 'divided' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-gray-50 text-gray-600 border border-gray-200'
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

                  {/* 关键共识 — 完成后显示，展示更多条 */}
                  {isComplete && round.moderatorAnalysis.consensus && round.moderatorAnalysis.consensus.length > 0 && (
                    <div className="mb-2.5 space-y-1">
                      <div className="text-[11px] font-medium text-gray-500 mb-0.5">关键共识</div>
                      {round.moderatorAnalysis.consensus.slice(0, 3).map((item, cIdx) => (
                        <div key={cIdx} className="flex items-start gap-1.5">
                          <span className="text-green-500 text-[11px] mt-px flex-shrink-0">✓</span>
                          <span className="text-[12px] text-gray-700 leading-relaxed flex-1 line-clamp-2">{item.content}</span>
                          <span className={`text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                            item.percentage >= 75 ? 'bg-green-100 text-green-700' :
                            item.percentage >= 50 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>{item.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 关键分歧 — 完成后显示 */}
                  {isComplete && round.moderatorAnalysis.disagreements && round.moderatorAnalysis.disagreements.length > 0 && (
                    <div className="mb-2.5 space-y-1">
                      <div className="text-[11px] font-medium text-gray-500 mb-0.5">关键分歧</div>
                      {round.moderatorAnalysis.disagreements.slice(0, 2).map((item, dIdx) => (
                        <div key={dIdx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 text-[11px] mt-px flex-shrink-0">⚡</span>
                          <span className="text-[12px] text-gray-700 leading-relaxed line-clamp-2">{item.topic}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 查看完整分析按钮 */}
                  {isComplete && (
                    <div className="flex items-center justify-center gap-1 text-xs text-indigo-500 pt-1 border-t border-gray-100">
                      <span>查看完整分析</span>
                      <ChevronDown className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* "回到底部"按钮 - 悬浮在底部栏上方 */}
      {showScrollToBottom && (
        <div 
          className="fixed bottom-16 left-1/2 pointer-events-auto"
          style={{
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
        >
          <button
            onClick={scrollToBottom}
            className="px-3 py-1.5 bg-black/60 text-white rounded-full flex items-center justify-center gap-1.5 text-xs shadow-lg hover:bg-black/70 transition-all duration-300 backdrop-blur-sm"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>回到底部</span>
          </button>
        </div>
      )}
      
      {/* CSS for fade-in animation */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>

      {/* Bottom Actions - 轻盈发送风格 */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-3 py-2.5 flex items-center gap-2 z-30">
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
          className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          title="查看 Prompts"
        >
          <FileText className="w-5 h-5" />
        </button>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-400 select-none">
          {isLoading ? '专家们正在讨论中...' : '点击右侧按钮继续下一轮讨论'}
        </div>
        <button 
          onClick={handleContinueDiscussion}
          disabled={isLoading}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isLoading 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed animate-pulse' 
              : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md active:scale-95'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Prompts Modal */}
      {showPromptsModal && currentRoundPrompts && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[10001]" onClick={() => setShowPromptsModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Prompts - 第 {rounds.length} 轮</h2>
              <button
                onClick={() => setShowPromptsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Agent Prompts */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Prompts</h3>
                {currentRoundPrompts.agents.map((agentPrompt, index) => (
                  <div key={index} className="mb-6 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 ${discussion.agents.find(a => a.id === agentPrompt.agentId)?.color || 'bg-gray-500'} rounded-full`} />
                      <h4 className="text-base font-medium text-gray-900">{agentPrompt.agentName}</h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">System Prompt:</div>
                        <pre className="text-xs text-gray-800 bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto whitespace-pre-wrap">{agentPrompt.systemPrompt}</pre>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">User Prompt:</div>
                        <pre className="text-xs text-gray-800 bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto whitespace-pre-wrap">{agentPrompt.userPrompt}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Moderator Prompts */}
              {currentRoundPrompts.moderator && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Moderator Prompts</h3>
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">System Prompt:</div>
                        <pre className="text-xs text-gray-800 bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto whitespace-pre-wrap">{currentRoundPrompts.moderator.systemPrompt}</pre>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">User Prompt:</div>
                        <pre className="text-xs text-gray-800 bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto whitespace-pre-wrap">{currentRoundPrompts.moderator.userPrompt}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowPromptsModal(false)}
                className="w-full py-3 bg-indigo-500 text-white rounded-full text-sm font-medium hover:bg-indigo-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummary && (
        <div className="absolute inset-0 bg-black/50 flex items-end" style={{ zIndex: 10000 }}>
          <div className="w-full bg-white rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 pt-3 pb-2 flex items-center justify-center border-b border-gray-200">
              <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
              <button
                onClick={() => setShowSummary(false)}
                className="absolute right-4 top-3 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-xl text-gray-900 mb-1">Master Document</h2>
                
                {/* Tabs */}
                <div className="flex gap-6 mb-6 border-b border-gray-200">
                  <button className="pb-3 text-sm text-indigo-600 border-b-2 border-indigo-600">
                    总结
                  </button>
                  <button className="pb-3 text-sm text-gray-500">
                    模型
                  </button>
                  <button className="pb-3 text-sm text-gray-500">
                    历史
                  </button>
                </div>

                {/* Version Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 rounded-full mb-4">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white text-sm">讨论中</span>
                  <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded">v{rounds.length > 0 ? rounds[rounds.length - 1].roundIndex : discussion.moderatorAnalysis.round}</span>
                </div>

                {/* Title */}
                <h3 className="text-2xl text-gray-900 mb-4">{discussion.title}</h3>

                {/* Summary Paragraph - 显示最新一轮的数据 */}
                {(() => {
                  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
                  const analysis = latestRound?.moderatorAnalysis || discussion.moderatorAnalysis;
                  
                  return (
                    <>
                      <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">
                          {analysis.summary}
                        </p>
                        <div className="p-3 bg-white rounded-lg">
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-indigo-500 text-sm">💬</span>
                            <h4 className="text-sm text-gray-900 flex-1">综论</h4>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {analysis.summary}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex -space-x-2">
                            {discussion.agents.map((agent, i) => (
                              <div
                                key={i}
                                className={`w-6 h-6 ${agent.color} rounded-full border-2 border-white flex items-center justify-center text-xs text-white`}
                              >
                                {agent.icon}
                              </div>
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">参与者</span>
                          <div className="flex-1"></div>
                          <span className="text-green-600 text-sm">✓</span>
                          <span className="text-xs text-gray-500">{analysis.consensus.length}</span>
                          <span className="text-red-600 text-sm">⤺</span>
                          <span className="text-xs text-gray-500">{analysis.disagreements.length}</span>
                        </div>
                      </div>

                      {/* Consensus */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-green-600">✓</span>
                          <h4 className="text-base text-gray-900">关键共识</h4>
                        </div>
                        {analysis.consensus.map((item, index) => (
                          <div key={index} className="flex items-start gap-3 mb-3 p-3 bg-green-50 rounded-xl">
                            <span className="text-green-600 text-lg mt-0.5">{index + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 mb-2">{item.content}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                  {discussion.agents.slice(0, 3).map((agent, i) => (
                                    <div
                                      key={i}
                                      className={`w-5 h-5 ${agent.color} rounded-full border-2 border-white`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-600">{item.agents.join(' · ')}</span>
                                <div className="flex-1"></div>
                                <span className="text-sm text-green-600">{item.percentage}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Disagreements */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-red-600">⤺</span>
                            <h4 className="text-base text-gray-900">分歧焦点</h4>
                          </div>
                          <span className="text-xs text-gray-500">部分无法决议</span>
                        </div>
                        {analysis.disagreements.map((item, index) => (
                          <div key={index} className="mb-3 p-4 bg-gray-50 rounded-xl">
                            <h5 className="text-sm text-gray-900 mb-2">{item.topic}</h5>
                            <p className="text-xs text-gray-600 mb-3">{item.description}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {item.supportAgents.slice(0, 2).map((agent, i) => (
                                <div key={i} className="p-2 bg-white rounded-lg">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-4 h-4 ${agent.color} rounded-full`} />
                                    <span className="text-xs text-gray-600 truncate">{agent.name}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Sentiment Summary */}
                      {analysis.sentimentSummary && analysis.sentimentSummary.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span>📊</span>
                            <h4 className="text-base text-gray-900">标的情绪</h4>
                          </div>
                          {analysis.sentimentSummary.map((item, index) => (
                            <div key={index} className="mb-3 p-4 bg-gray-50 rounded-xl">
                              <div className="flex items-center gap-2 mb-3">
                                <span className={`text-lg ${
                                  item.overallSentiment === 'bullish' ? 'text-red-500' :
                                  item.overallSentiment === 'bearish' ? 'text-green-500' :
                                  item.overallSentiment === 'divided' ? 'text-amber-500' :
                                  'text-gray-400'
                                }`}>
                                  {item.overallSentiment === 'bullish' ? '📈' :
                                   item.overallSentiment === 'bearish' ? '📉' :
                                   item.overallSentiment === 'divided' ? '⚔️' : '➖'}
                                </span>
                                <h5 className="text-sm font-medium text-gray-900">{item.stock}</h5>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  item.overallSentiment === 'bullish' ? 'bg-red-100 text-red-700' :
                                  item.overallSentiment === 'bearish' ? 'bg-green-100 text-green-700' :
                                  item.overallSentiment === 'divided' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
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
                                        <span key={i} className="text-[11px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded">
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {item.bearishAgents.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-green-500 w-8">看跌</span>
                                    <div className="flex-1 flex flex-wrap gap-1">
                                      {item.bearishAgents.map((name, i) => (
                                        <span key={i} className="text-[11px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {item.neutralAgents.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 w-8">中性</span>
                                    <div className="flex-1 flex flex-wrap gap-1">
                                      {item.neutralAgents.map((name, i) => (
                                        <span key={i} className="text-[11px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded">
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* 情绪条 */}
                              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                                {item.bullishAgents.length > 0 && (
                                  <div
                                    className="bg-red-400 h-full"
                                    style={{ width: `${(item.bullishAgents.length / (item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length)) * 100}%` }}
                                  />
                                )}
                                {item.neutralAgents.length > 0 && (
                                  <div
                                    className="bg-gray-400 h-full"
                                    style={{ width: `${(item.neutralAgents.length / (item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length)) * 100}%` }}
                                  />
                                )}
                                {item.bearishAgents.length > 0 && (
                                  <div
                                    className="bg-green-400 h-full"
                                    style={{ width: `${(item.bearishAgents.length / (item.bullishAgents.length + item.bearishAgents.length + item.neutralAgents.length)) * 100}%` }}
                                  />
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

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowSummary(false)}
                className="w-full py-3 bg-indigo-500 text-white rounded-full text-sm"
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
