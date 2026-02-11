'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, SendHorizontal } from 'lucide-react';
import type { Discussion, AvatarType } from '@/types';
import { AgentAvatar } from './AgentAvatar';
import type { AgentId } from '@/prompts/roundAgentPrompts';
import { HistoryTopicsDrawer } from './HistoryTopicsDrawer';
import { AgentSlot, type SlotAgent } from './AgentSlot';
import { AgentSelectionSheet } from './AgentSelectionSheet';

// 历史话题类型
interface HistoryTopic {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  discussion: Discussion;
}

// localStorage key（与 HistoryTopicsDrawer 和 DiscussionPage 保持一致）
const HISTORY_TOPICS_KEY = 'multiagent_history_topics';

type WelcomePageProps = {
  onCreateDiscussion: (discussion: Discussion) => void;
};

// 全部可用 agent（含头像映射）
const ALL_AGENTS: (SlotAgent & { agentId: AgentId; color: string; icon: string })[] = [
  {
    id: 'macro_economist',
    agentId: 'macro_economist' as AgentId,
    name: '涨停敢死队长',
    avatar: 'rocket' as AvatarType,
    auraColor: 'from-purple-400/20 to-pink-500/10',
    color: 'bg-red-500',
    icon: '🔥',
  },
  {
    id: 'finance_expert',
    agentId: 'finance_expert' as AgentId,
    name: '价值投资苦行僧',
    avatar: 'safe' as AvatarType,
    auraColor: 'from-amber-400/20 to-yellow-600/10',
    color: 'bg-emerald-600',
    icon: '🧘',
  },
  {
    id: 'senior_stock_practitioner',
    agentId: 'senior_stock_practitioner' as AgentId,
    name: '量化狙击手',
    avatar: 'lightning' as AvatarType,
    auraColor: 'from-blue-400/20 to-indigo-600/10',
    color: 'bg-indigo-600',
    icon: '📊',
  },
  {
    id: 'veteran_stock_tycoon',
    agentId: 'veteran_stock_tycoon' as AgentId,
    name: '草根股神老王',
    avatar: 'rings' as AvatarType,
    auraColor: 'from-emerald-400/20 to-teal-600/10',
    color: 'bg-amber-600',
    icon: '🎣',
  },
];

const MAX_SLOTS = 6;

// 热门话题列表
const POPULAR_TOPICS = [
  '腾讯股票接下来走势如何？',
  '苹果公司未来3年投资价值分析',
  '新能源板块是否还有投资机会？',
  '当前市场环境下如何配置资产？',
];

export function WelcomePage({ onCreateDiscussion }: WelcomePageProps) {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const topicsScrollRef = useRef<HTMLDivElement>(null);
  // 默认选中全部4个agent
  const [selectedAgents, setSelectedAgents] = useState<typeof ALL_AGENTS>(
    [...ALL_AGENTS]
  );

  // Track active topic card scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (topicsScrollRef.current) {
        const scrollLeft = topicsScrollRef.current.scrollLeft;
        const cardWidth = topicsScrollRef.current.clientWidth - 40 + 8; // card width + gap
        const newIndex = Math.round(scrollLeft / cardWidth);
        setActiveTopicIndex(Math.min(newIndex, POPULAR_TOPICS.length - 1));
      }
    };
    const el = topicsScrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const toggleAgent = (agent: SlotAgent) => {
    const found = selectedAgents.find(a => a.id === agent.id);
    if (found) {
      setSelectedAgents(selectedAgents.filter(a => a.id !== agent.id));
    } else if (selectedAgents.length < MAX_SLOTS) {
      const fullAgent = ALL_AGENTS.find(a => a.id === agent.id);
      if (fullAgent) {
        setSelectedAgents([...selectedAgents, fullAgent]);
      }
    }
  };

  const removeAgent = (agentId: string) => {
    setSelectedAgents(selectedAgents.filter(a => a.id !== agentId));
  };

  // Create array of MAX_SLOTS slots
  const slots = Array.from({ length: MAX_SLOTS }, (_, index) => selectedAgents[index] || null);

  // 保存历史话题到localStorage
  const saveHistoryTopic = (discussion: Discussion) => {
    try {
      const stored = localStorage.getItem(HISTORY_TOPICS_KEY);
      const topics: HistoryTopic[] = stored ? JSON.parse(stored) : [];

      const now = Date.now();
      const existingIndex = topics.findIndex(t => t.id === discussion.id);
      if (existingIndex >= 0) {
        topics[existingIndex] = {
          id: discussion.id!,
          title: discussion.title,
          createdAt: topics[existingIndex].createdAt,
          updatedAt: now,
          discussion: discussion,
        };
      } else {
        topics.push({
          id: discussion.id!,
          title: discussion.title,
          createdAt: now,
          updatedAt: now,
          discussion: discussion,
        });
      }

      const limitedTopics = topics.slice(0, 50);
      const sortedTopics = limitedTopics.sort((a, b) => b.updatedAt - a.updatedAt);
      localStorage.setItem(HISTORY_TOPICS_KEY, JSON.stringify(sortedTopics));
    } catch (error) {
      console.error('[WelcomePage] Error saving history topic:', error);
    }
  };

  // 创建讨论的通用函数
  const createDiscussion = async (topicTitle: string) => {
    if (!topicTitle.trim() || isLoading || selectedAgents.length === 0) return;

    setIsLoading(true);
    try {
      const agentIds = selectedAgents.map(a => a.agentId);

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: topicTitle.trim(),
          topicDescription: '',
          userGoal: '希望给出投资决策建议',
          agentIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create discussion: ${errorData.error || response.statusText}`);
      }

      const { session } = await response.json();

      if (!session || !session.id) {
        throw new Error('Invalid session response');
      }

      const discussion: Discussion = {
        id: session.id,
        title: topicTitle.trim(),
        background: '',
        agents: selectedAgents.map(a => ({
          id: a.id,
          name: a.name,
          description: '',
          color: a.color,
          icon: a.icon,
          selected: true,
          avatarType: a.avatar,
          auraColor: a.auraColor,
        })),
        rounds: [],
        comments: [],
        moderatorAnalysis: {
          round: 0,
          consensusLevel: 0,
          summary: '',
          newPoints: [],
          consensus: [],
          disagreements: [],
        },
        sessionData: session,
      };

      saveHistoryTopic(discussion);
      onCreateDiscussion(discussion);
    } catch (error) {
      console.error('[WelcomePage] Error creating discussion:', error);
      alert(`创建讨论失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDiscussion = async () => {
    await createDiscussion(topic);
  };

  const handleTopicClick = async (topicText: string) => {
    await createDiscussion(topicText);
  };

  const handleSelectHistoryTopic = (discussion: Discussion) => {
    onCreateDiscussion(discussion);
  };

  return (
    <div className="h-full bg-white flex flex-col relative">
      {/* Ambient Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-24 left-10 w-1 h-1 bg-[#AAE874] rounded-full opacity-40 animate-pulse" />
        <div className="absolute top-32 right-16 w-1.5 h-1.5 bg-[#AAE874] rounded-full opacity-30 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-48 left-20 w-1 h-1 bg-[#AAE874] rounded-full opacity-35 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-56 right-24 w-1 h-1 bg-[#AAE874] rounded-full opacity-45 animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* 历史话题抽屉 */}
      <HistoryTopicsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectTopic={handleSelectHistoryTopic}
        isLoading={isLoading}
      />

      {/* Agent Selection Sheet */}
      <AgentSelectionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        agents={ALL_AGENTS}
        selectedAgents={selectedAgents}
        onToggle={toggleAgent}
        maxSlots={MAX_SLOTS}
      />

      {/* Header */}
      <div className="relative px-5 py-4 flex items-center justify-between">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="w-10 h-10 rounded-full border border-[#E0E0E0] flex items-center justify-center active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5 text-[#333333]" strokeWidth={1.5} />
        </button>
        <h1 className="text-[16px] font-medium text-black">MultiAgent</h1>
        <div className="w-10" />
      </div>

      {/* Brand Header — Figma BrandHeader 风格 */}
      <div className="relative pt-8 pb-6">
        {/* Centered Brand Icon — Figma GreenSphere */}
        <div className="flex justify-center mb-10 relative">
          {/* Floating Particles Around Icon */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-8 left-[35%] w-1 h-1 bg-[#AAE874] rounded-full opacity-40 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="absolute top-2 right-[30%] w-1.5 h-1.5 bg-[#AAE874] rounded-full opacity-30 animate-pulse" style={{ animationDelay: '0.7s' }} />
            <div className="absolute bottom-4 left-[25%] w-1 h-1 bg-[#AAE874] rounded-full opacity-35 animate-pulse" style={{ animationDelay: '1.2s' }} />
            <div className="absolute bottom-0 right-[38%] w-1 h-1 bg-[#AAE874] rounded-full opacity-45 animate-pulse" style={{ animationDelay: '1.7s' }} />
          </div>
          {/* GreenSphere 3D Avatar — 100px, matching Figma BrandHeader */}
          <div className="relative z-10 drop-shadow-2xl">
            <AgentAvatar type="sphere" size={100} />
          </div>
        </div>

        {/* Left-Aligned Text Content */}
        <div className="px-5 text-left space-y-2">
          <p className="text-[14px] text-[#999999] leading-relaxed">
            同一个 AI，可能遇到幻觉
          </p>
          <h2 className="text-[22px] text-black font-medium">问多个 AI，得到真相</h2>
          <p className="text-[14px] text-[#999999] leading-relaxed">
            选择你的 AI 顾问团，开始讨论
          </p>
        </div>
      </div>

      {/* 2x3 Agent Slot Grid */}
      <div className="relative px-5 pb-4">
        <div className="flex flex-col items-center gap-8 mb-4">
          {/* Row 1 */}
          <div className="flex justify-center gap-8">
            {slots.slice(0, 3).map((agent, index) => (
              <AgentSlot
                key={index}
                agent={agent || undefined}
                onClick={() => setIsSheetOpen(true)}
                onDelete={agent ? () => removeAgent(agent.id) : undefined}
              />
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex justify-center gap-8">
            {slots.slice(3, 6).map((agent, index) => (
              <AgentSlot
                key={index + 3}
                agent={agent || undefined}
                onClick={() => setIsSheetOpen(true)}
                onDelete={agent ? () => removeAgent(agent.id) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Selection Count */}
        <div className="text-center mb-4">
          <p className="text-[14px] text-[#666666]">
            已选 <span className="font-bold text-[#AAE874]">{selectedAgents.length}/{MAX_SLOTS}</span>
          </p>
        </div>
      </div>

      {/* Recommended Topics Carousel */}
      <div className="px-5 mb-3 flex-shrink-0">
        <div
          ref={topicsScrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth"
        >
          {POPULAR_TOPICS.map((topicText, index) => (
            <button
              key={index}
              onClick={() => handleTopicClick(topicText)}
              disabled={isLoading || selectedAgents.length === 0}
              className="flex-shrink-0 w-[calc(100%-40px)] snap-start bg-white rounded-full px-4 py-2.5 border border-[#E8E8E8] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-[#AAE874] hover:shadow-[0_4px_12px_rgba(170,232,116,0.2)] active:scale-[0.98] transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#AAE874]/10 flex items-center justify-center group-hover:bg-[#AAE874]/20 transition-colors">
                  <span className="text-[14px]">💡</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#333333] font-medium truncate">
                    {topicText}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {/* Dot Indicators */}
        <div className="flex justify-center gap-1.5 mt-3">
          {POPULAR_TOPICS.map((_, index) => (
            <div
              key={index}
              className={`rounded-full transition-all duration-200 ${
                index === activeTopicIndex
                  ? 'w-4 h-1.5 bg-[#AAE874]'
                  : 'w-1.5 h-1.5 bg-[#E0E0E0]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sticky Action Bar */}
      <div className="sticky bottom-0 left-0 right-0 px-5 pb-6 pt-4 z-50">
        {/* Glassmorphic Background with Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#AAE874]/10 via-white/95 to-white/90 backdrop-blur-xl" />

        {/* Input Bar Container */}
        <div className="relative flex items-center gap-3">
          {/* Input Field */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartDiscussion()}
              placeholder="输入话题，开始讨论..."
              className="w-full px-5 py-3.5 bg-white border border-[#E8E8E8] rounded-full text-[15px] text-black placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#AAE874] focus:shadow-[0_0_0_3px_rgba(170,232,116,0.1)] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleStartDiscussion}
            disabled={!topic.trim() || isLoading || selectedAgents.length === 0}
            className={`
              flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all
              ${topic.trim() && !isLoading && selectedAgents.length > 0
                ? 'bg-[#AAE874] active:scale-95 shadow-[0_4px_16px_rgba(170,232,116,0.4)] hover:shadow-[0_6px_20px_rgba(170,232,116,0.5)]'
                : 'bg-[#E8E8E8] cursor-not-allowed opacity-50'
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
    </div>
  );
}
