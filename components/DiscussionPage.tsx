'use client';

import { useState, useEffect, useRef } from 'react';
import { Menu, Edit3, ChevronDown, ArrowDown, X, FileText, Send } from 'lucide-react';
import type { Discussion, AgentComment, RoundData } from '@/types';
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
  return 'bg-gray-50';
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
        return [
          ...completedRounds,
          {
            roundIndex: currentRoundIndex,
            comments: currentRoundCommentsArray,
            moderatorAnalysis: {
              round: currentRoundIndex,
              consensusLevel: 0,
              summary: currentRoundStatus === 'summary' 
                ? (currentSummaryText || '正在生成总结...')
                : '讨论进行中...',
              newPoints: [],
              consensus: [],
              disagreements: [],
            },
          },
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
  }, [rounds.length, currentRoundComments.size, userScrolledUp]);

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

  // 开始第一轮讨论
  const startFirstRound = async () => {
    if (!discussion.id || !discussion.sessionData) return;

    setIsLoading(true);
    setCurrentRoundStatus('speech');
    setCurrentRoundIndex(1);
    // 重置prompts收集
    currentRoundPromptsRef.current = { agents: [] };

    // 初始化评论状态
    const initialComments = new Map<string, AgentComment>();
    discussion.agents.forEach(agent => {
      initialComments.set(agent.id, {
        agentId: agent.id,
        agentName: agent.name,
        agentColor: agent.color || 'bg-gray-500', // 默认颜色，防止undefined
        content: '正在发言...',
        expanded: false,
      });
    });
    setCurrentRoundComments(initialComments);

    try {
      const sessionData = discussion.sessionData;
      
      // 步骤 1: 并行请求所有 Agent 的发言（流式）
      const speechPromises = discussion.agents.map(async (agent) => {
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
          agent.name || 'Unknown Agent', // 防止undefined
          agent.color || 'bg-gray-500', // 默认颜色，防止undefined
          (content) => {
            setCurrentRoundComments(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(agent.id);
              newMap.set(agent.id, {
                agentId: agent.id,
                agentName: agent.name || 'Unknown Agent', // 防止undefined
                agentColor: agent.color || 'bg-gray-500', // 默认颜色，防止undefined
                content: content || '', // 防止undefined
                expanded: existing?.expanded ?? false,
              });
              return newMap;
            });
          }
        );

        // 保存agent的prompts
        if (speech.systemPrompt && speech.userPrompt) {
          currentRoundPromptsRef.current.agents.push({
            agentId: agent.id,
            agentName: agent.name || 'Unknown Agent',
            systemPrompt: speech.systemPrompt,
            userPrompt: speech.userPrompt,
          });
        }

        return { agentId: agent.id, agentName: agent.name, speech };
      });

      const speeches = await Promise.all(speechPromises);

      // 第一轮不需要互评，直接生成总结
      // 步骤 2: 流式请求总结（第一轮不包含互评）
      setCurrentRoundStatus('summary');
      setCurrentSummaryText(''); // 重置总结文本
      
      const summaryResponse = await fetch('/api/rounds/summary/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: discussion.id,
          roundIndex: 1,
          agentsSpeeches: speeches,
          agentsReviews: [], // 第一轮没有互评
          sessionData: sessionData,
        }),
      });

      if (!summaryResponse.ok) {
        throw new Error('Failed to generate summary');
      }

      // 处理流式响应
      let roundSummary: any = null;
      let updatedSession: any = null;
      let summaryBuffer = '';

      const reader = summaryResponse.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('Failed to get summary stream');
      }

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
                summaryBuffer += data.content;
                // 实时更新总结文本（打字机效果）
                setCurrentSummaryText(summaryBuffer);
              } else if (data.type === 'done') {
                roundSummary = data.roundSummary;
                updatedSession = data.session;
                // 确保最终文本已设置
                setCurrentSummaryText(data.roundSummary?.overallSummary || summaryBuffer);
                // 保存主持人的prompts
                if (data.moderatorPrompts?.systemPrompt && data.moderatorPrompts?.userPrompt) {
                  currentRoundPromptsRef.current.moderator = {
                    systemPrompt: data.moderatorPrompts.systemPrompt,
                    userPrompt: data.moderatorPrompts.userPrompt,
                  };
                }
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Error parsing summary SSE data:', e);
            }
          }
        }
      }

      if (!roundSummary || !updatedSession) {
        throw new Error('Failed to get complete summary');
      }

      // 获取最新的 comments（在总结生成时，所有发言应该已经完成）
      setCurrentRoundComments(prev => {
        const finalComments = Array.from(prev.values());
        
        const moderatorAnalysis = {
          round: roundSummary.roundIndex || 1,
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
        };

        const firstRound: RoundData = {
          roundIndex: roundSummary.roundIndex || 1,
          comments: finalComments,
          moderatorAnalysis,
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
            moderator: currentRoundPromptsRef.current.moderator,
          },
        };

        // 使用 setTimeout 将父组件更新推迟到下一个事件循环，避免在渲染过程中更新
        setTimeout(() => {
          const updatedDiscussion = {
            ...discussion,
            rounds: [firstRound],
            comments: finalComments,
            moderatorAnalysis,
            sessionData: updatedSession,
          };
          onUpdateDiscussion(updatedDiscussion);
          // 同步保存到localStorage
          saveDiscussionToHistory(updatedDiscussion);
        }, 0);

        setCurrentRoundStatus('complete');
        setCurrentSummaryText(''); // 重置总结文本
        return new Map(); // 清空当前轮次的评论
      });
    } catch (error) {
      console.error('Error starting first round:', error);
      setCurrentRoundStatus('idle');
      setCurrentSummaryText(''); // 重置总结文本
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
    updateContent: (content: string, targetAgentId?: string, targetAgentName?: string, systemPrompt?: string, userPrompt?: string) => void
  ): Promise<{ content: string; targetAgentId?: string; targetAgentName?: string; systemPrompt?: string; userPrompt?: string }> => {
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
        if (!line || typeof line !== 'string') continue; // 跳过无效的行
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue; // 跳过空的数据行
            
            const data = JSON.parse(jsonStr);
            
            if (!data || typeof data !== 'object') continue; // 跳过无效的数据对象
            
            if (data.type === 'chunk') {
              const chunkContent = data.content || '';
              fullContent += chunkContent;
              // 实时更新 UI（打字机效果）
              updateContent(fullContent, targetAgentId, targetAgentName);
            } else if (data.type === 'done') {
              fullContent = data.speech || data.review || fullContent || '';
              // 保存目标agent信息（如果有）
              if (data.targetAgentId && data.targetAgentName) {
                targetAgentId = String(data.targetAgentId);
                targetAgentName = String(data.targetAgentName);
              }
              // 保存prompts（如果有）
              if (data.systemPrompt && data.userPrompt) {
                savedSystemPrompt = String(data.systemPrompt);
                savedUserPrompt = String(data.userPrompt);
              }
            } else if (data.type === 'error') {
              const errorMessage = data.error ? String(data.error) : 'Unknown error occurred';
              throw new Error(errorMessage);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
            console.error('Problematic line:', line);
            // 不抛出错误，继续处理下一行
          }
        }
      }
    }

    return { content: fullContent, targetAgentId, targetAgentName, systemPrompt: savedSystemPrompt, userPrompt: savedUserPrompt };
  };

  // 开始新一轮讨论（瀑布流方式）
  const startNextRound = async (roundIndex: number) => {
    if (!discussion.id || !discussion.sessionData || isLoading) return;

    setIsLoading(true);
    setCurrentRoundStatus('speech');
    setCurrentRoundIndex(roundIndex);

    // 初始化评论状态
    const initialComments = new Map<string, AgentComment>();
    discussion.agents.forEach(agent => {
      initialComments.set(agent.id, {
        agentId: agent.id,
        agentName: agent.name,
        agentColor: agent.color || 'bg-gray-500', // 默认颜色，防止undefined
        content: '正在发言...',
        expanded: false,
      });
    });
    setCurrentRoundComments(initialComments);

    try {
      const sessionData = discussion.sessionData;
      
      // 获取上一轮的原始发言数据（用于后续轮次的辩论prompt）
      const previousRoundData = rounds.length > 0 ? rounds[rounds.length - 1] : null;
      const previousRoundComments = previousRoundData?.comments?.map(c => ({
        agentId: c.agentId,
        agentName: c.agentName,
        content: c.content,
      })) || [];

      // 步骤 1: 并行请求所有 Agent 的发言（流式）
      const speechPromises = discussion.agents.map(async (agent) => {
        const response = await fetch('/api/agents/speech/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: discussion.id,
            agentId: agent.id,
            roundIndex: roundIndex,
            sessionData: sessionData,
            previousRoundComments: previousRoundComments,
          }),
        });

        const speechResult = await handleStreamResponse(
          response,
          agent.id,
          agent.name || 'Unknown Agent', // 防止undefined
          agent.color || 'bg-gray-500', // 默认颜色，防止undefined
          (content, targetAgentId, targetAgentName) => {
            setCurrentRoundComments(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(agent.id);
              newMap.set(agent.id, {
                agentId: agent.id,
                agentName: agent.name || 'Unknown Agent', // 防止undefined
                agentColor: agent.color || 'bg-gray-500', // 默认颜色，防止undefined
                content: content || '', // 防止undefined
                expanded: existing?.expanded ?? false,
                targetAgentId: targetAgentId || existing?.targetAgentId,
                targetAgentName: targetAgentName || existing?.targetAgentName,
              });
              return newMap;
            });
          }
        );

        // 保存agent的prompts
        if (speechResult.systemPrompt && speechResult.userPrompt) {
          currentRoundPromptsRef.current.agents.push({
            agentId: agent.id,
            agentName: agent.name || 'Unknown Agent',
            systemPrompt: speechResult.systemPrompt,
            userPrompt: speechResult.userPrompt,
          });
        }

        return { 
          agentId: agent.id, 
          agentName: agent.name, 
          speech: speechResult.content,
          targetAgentId: speechResult.targetAgentId,
          targetAgentName: speechResult.targetAgentName,
        };
      });

      const speeches = await Promise.all(speechPromises);

      // 步骤 2: 为每个 Agent 分配一个要点评的 Agent（循环分配）
      // 例如：agent0 点评 agent1，agent1 点评 agent2，agent2 点评 agent3，agent3 点评 agent0
      setCurrentRoundStatus('review');
      
      const reviewPromises = discussion.agents.map(async (agent, index) => {
        // 计算要点评的 agent 索引（循环分配）
        const targetAgentIndex = (index + 1) % discussion.agents.length;
        const targetAgent = discussion.agents[targetAgentIndex];
        const targetSpeech = speeches.find(s => s.agentId === targetAgent.id);
        
        if (!targetSpeech) {
          throw new Error(`Target agent speech not found for ${targetAgent.name}`);
        }

        // 只传入被点评 agent 的发言
        const targetAgentSpeechText = `【${targetSpeech.agentName}（${targetSpeech.agentId}）】\n${targetSpeech.speech}`;

        const response = await fetch('/api/agents/review/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: discussion.id,
            agentId: agent.id,
            roundIndex: roundIndex,
            otherAgentsSpeeches: targetAgentSpeechText, // 只传入一个 agent 的发言
            sessionData: sessionData,
          }),
        });

        const reviewResult = await handleStreamResponse(
          response,
          agent.id,
          agent.name || 'Unknown Agent', // 防止undefined
          agent.color || 'bg-gray-500', // 默认颜色，防止undefined
          (content) => {
            // 互评暂时不更新 UI，只在完成后更新
            // 如果需要实时显示互评，可以在这里添加更新逻辑
          }
        );

        return { 
          agentId: agent.id, 
          agentName: agent.name, 
          review: reviewResult.content,
          targetAgentId: targetAgent.id,
          targetAgentName: targetAgent.name,
        };
      });

      const reviews = await Promise.all(reviewPromises);

      // 步骤 4: 流式请求总结
      setCurrentRoundStatus('summary');
      setCurrentSummaryText(''); // 重置总结文本
      
      const summaryResponse = await fetch('/api/rounds/summary/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: discussion.id,
          roundIndex: roundIndex,
          agentsSpeeches: speeches,
          agentsReviews: reviews,
          sessionData: sessionData,
        }),
      });

      if (!summaryResponse.ok) {
        throw new Error('Failed to generate summary');
      }

      // 处理流式响应
      let roundSummary: any = null;
      let updatedSession: any = null;
      let summaryBuffer = '';

      const reader = summaryResponse.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('Failed to get summary stream');
      }

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
                summaryBuffer += data.content;
                // 实时更新总结文本（打字机效果）
                setCurrentSummaryText(summaryBuffer);
              } else if (data.type === 'done') {
                roundSummary = data.roundSummary;
                updatedSession = data.session;
                // 确保最终文本已设置
                setCurrentSummaryText(data.roundSummary?.overallSummary || summaryBuffer);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Error parsing summary SSE data:', e);
            }
          }
        }
      }

      if (!roundSummary || !updatedSession) {
        throw new Error('Failed to get complete summary');
      }

      // 获取最新的 comments
      setCurrentRoundComments(prev => {
        const finalComments = Array.from(prev.values()).map(comment => ({
          ...comment,
          expanded: comment.expanded ?? false, // 确保所有comments都有expanded属性
        }));
        
        const moderatorAnalysis = {
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
        };

        const newRound: RoundData = {
          roundIndex: roundSummary.roundIndex || roundIndex,
          comments: finalComments,
          moderatorAnalysis,
          prompts: {
            agents: [...currentRoundPromptsRef.current.agents],
            moderator: currentRoundPromptsRef.current.moderator,
          },
        };

        // 追加新轮次到现有轮次列表
        const updatedRounds = [...rounds, newRound];

        // 使用 setTimeout 将父组件更新推迟到下一个事件循环，避免在渲染过程中更新
        setTimeout(() => {
          const updatedDiscussion = {
            ...discussion,
            rounds: updatedRounds,
            comments: finalComments,
            sessionData: updatedSession,
            moderatorAnalysis,
          };
          onUpdateDiscussion(updatedDiscussion);
          // 同步保存到localStorage
          saveDiscussionToHistory(updatedDiscussion);
        }, 0);

        setCurrentRoundStatus('complete');
        setCurrentSummaryText(''); // 重置总结文本
        return new Map(); // 清空当前轮次的评论
      });
    } catch (error) {
      console.error('Error starting next round:', error);
      setCurrentRoundStatus('idle');
      setCurrentSummaryText(''); // 重置总结文本
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
        <div className="flex-1 text-center">
          <h1 className="text-base font-medium text-gray-900 leading-tight">{discussion.title}</h1>
          <p className="text-xs text-gray-400">{discussion.agents.length}位专家讨论中</p>
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
              {round.comments.map((comment) => (
                <div key={`${round.roundIndex}-${comment.agentId}`} className="flex items-start gap-2.5">
                  {/* 头像 */}
                  <div className={`w-9 h-9 ${comment.agentColor} rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm font-medium shadow-sm`}>
                    {comment.agentName[0]}
                  </div>
                  {/* 名称 + 气泡 */}
                  <div className="max-w-[85%] min-w-0">
                    <span className="text-xs text-gray-500 mb-1 block">{comment.agentName}</span>
                    <div className={`${getBubbleBgColor(comment.agentColor)} rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm`}>
                      <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                        {comment.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Moderator Analysis - 居中系统消息 */}
              <div className="flex justify-center py-1">
                <div 
                  className="max-w-[85%] bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm border border-gray-100 cursor-pointer hover:bg-white transition-colors"
                  onClick={() => setShowSummary(true)}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-gray-700">第{round.roundIndex}轮总结</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                      round.moderatorAnalysis.consensusLevel >= 80 ? 'bg-green-500' :
                      round.moderatorAnalysis.consensusLevel >= 60 ? 'bg-blue-500' :
                      round.moderatorAnalysis.consensusLevel >= 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}>
                      {round.moderatorAnalysis.consensusLevel >= 80 ? '高度共识' :
                       round.moderatorAnalysis.consensusLevel >= 60 ? '有进展' :
                       round.moderatorAnalysis.consensusLevel >= 40 ? '有分歧' :
                       '分歧较大'} {round.moderatorAnalysis.consensusLevel}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">
                    {round.moderatorAnalysis.summary}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-indigo-500">
                    <span>查看完整分析</span>
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>
              </div>
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
                      <div>
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
