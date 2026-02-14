'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, SendHorizontal, LogOut } from 'lucide-react';
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

// localStorage key（按用户 ID 隔离，与 HistoryTopicsDrawer 和 DiscussionPage 保持一致）
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
// 持久化已选 agent 的 localStorage key
const SELECTED_AGENTS_KEY = 'multiagent_selected_agents';

type WelcomePageProps = {
  onCreateDiscussion: (discussion: Discussion) => void;
  onLogout?: () => void;
};

// 全部可用 agent（含头像映射）
const ALL_AGENTS: (SlotAgent & { agentId: AgentId; color: string; icon: string })[] = [
  {
    id: 'macro_economist',
    agentId: 'macro_economist' as AgentId,
    name: '涨停敢死队长',
    description: '短线打板之王，5万本金十年翻到8000万',
    avatar: 'rocket' as AvatarType,
    auraColor: 'from-purple-400/20 to-pink-500/10',
    color: 'bg-red-500',
    icon: '🔥',
  },
  {
    id: 'finance_expert',
    agentId: 'finance_expert' as AgentId,
    name: '价值投资苦行僧',
    description: '巴菲特信徒，重仓优质股十年不动摇',
    avatar: 'safe' as AvatarType,
    auraColor: 'from-amber-400/20 to-yellow-600/10',
    color: 'bg-emerald-600',
    icon: '🧘',
  },
  {
    id: 'senior_stock_practitioner',
    agentId: 'senior_stock_practitioner' as AgentId,
    name: '量化狙击手',
    description: 'MIT 数学博士，用算法和数据统治市场',
    avatar: 'lightning' as AvatarType,
    auraColor: 'from-blue-400/20 to-indigo-600/10',
    color: 'bg-indigo-600',
    icon: '📊',
  },
  {
    id: 'veteran_stock_tycoon',
    agentId: 'veteran_stock_tycoon' as AgentId,
    name: '草根股神老王',
    description: '28年老股民，2万起步身家过三千万',
    avatar: 'rings' as AvatarType,
    auraColor: 'from-emerald-400/20 to-teal-600/10',
    color: 'bg-amber-600',
    icon: '🎣',
  },
  {
    id: 'policy_analyst',
    agentId: 'policy_analyst' as AgentId,
    name: '政策风向标',
    description: '前智库研究员，从红头文件中嗅到投资机会',
    avatar: 'compass' as AvatarType,
    auraColor: 'from-red-400/20 to-rose-500/10',
    color: 'bg-red-600',
    icon: '🏛️',
  },
  {
    id: 'etf_auntie',
    agentId: 'etf_auntie' as AgentId,
    name: 'ETF定投大妈',
    description: '退休老师，定投十年80万变160万',
    avatar: 'piggybank' as AvatarType,
    auraColor: 'from-pink-400/20 to-rose-400/10',
    color: 'bg-pink-500',
    icon: '🛒',
  },
  {
    id: 'cross_border_hunter',
    agentId: 'cross_border_hunter' as AgentId,
    name: '港美股猎人',
    description: '沃顿MBA，横跨A港美三大市场',
    avatar: 'globe' as AvatarType,
    auraColor: 'from-sky-400/20 to-blue-600/10',
    color: 'bg-sky-600',
    icon: '🌍',
  },
  {
    id: 'institutional_trader',
    agentId: 'institutional_trader' as AgentId,
    name: '机构操盘手',
    description: 'TOP10公募交易主管，管着300亿资金',
    avatar: 'shield' as AvatarType,
    auraColor: 'from-slate-400/20 to-slate-600/10',
    color: 'bg-slate-600',
    icon: '🏦',
  },
  {
    id: 'finance_kol',
    agentId: 'finance_kol' as AgentId,
    name: '财经大V',
    description: '300万粉丝博主，把股票讲成脱口秀',
    avatar: 'megaphone' as AvatarType,
    auraColor: 'from-orange-400/20 to-amber-500/10',
    color: 'bg-orange-500',
    icon: '🎙️',
  },
  {
    id: 'risk_controller',
    agentId: 'risk_controller' as AgentId,
    name: '风控铁面人',
    description: '前券商风控总监，被称"乌鸦嘴"但每次都对',
    avatar: 'radar' as AvatarType,
    auraColor: 'from-emerald-500/20 to-green-700/10',
    color: 'bg-emerald-700',
    icon: '🛡️',
  },
  {
    id: 'industry_researcher',
    agentId: 'industry_researcher' as AgentId,
    name: '行业深潜者',
    description: '前卖方首席，产业链从头到尾摸透',
    avatar: 'microscope' as AvatarType,
    auraColor: 'from-violet-400/20 to-purple-600/10',
    color: 'bg-violet-600',
    icon: '🔬',
  },
  {
    id: 'cycle_theorist',
    agentId: 'cycle_theorist' as AgentId,
    name: '周期天王',
    description: '经济学教授，用百年周期理论解读市场',
    avatar: 'hourglass' as AvatarType,
    auraColor: 'from-amber-400/20 to-orange-600/10',
    color: 'bg-amber-700',
    icon: '⏳',
  },
];

const MIN_SLOTS = 3;
const MAX_SLOTS = 6;

// 热门话题列表
const POPULAR_TOPICS = [
  '腾讯股票接下来走势如何？',
  '苹果公司未来3年投资价值分析',
  '新能源板块是否还有投资机会？',
  '当前市场环境下如何配置资产？',
];

export function WelcomePage({ onCreateDiscussion, onLogout }: WelcomePageProps) {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [isInputMultiLine, setIsInputMultiLine] = useState(false);
  const topicsScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // agent 选择状态（初始为空，由 useEffect 从 localStorage 加载或随机生成）
  const [selectedAgents, setSelectedAgents] = useState<typeof ALL_AGENTS>([]);

  // 首次加载：从 localStorage 恢复已选 agent，若无则随机选 4 位并持久化
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SELECTED_AGENTS_KEY);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        const restored = ids
          .map(id => ALL_AGENTS.find(a => a.id === id))
          .filter(Boolean) as typeof ALL_AGENTS;
        if (restored.length >= MIN_SLOTS && restored.length <= MAX_SLOTS) {
          setSelectedAgents(restored);
          return;
        }
      }
    } catch (e) {
      console.error('[WelcomePage] Error loading persisted agents:', e);
    }
    // 首次访问或数据异常：随机选 4 位
    const shuffled = [...ALL_AGENTS].sort(() => Math.random() - 0.5);
    const defaults = shuffled.slice(0, 4);
    setSelectedAgents(defaults);
    try {
      localStorage.setItem(SELECTED_AGENTS_KEY, JSON.stringify(defaults.map(a => a.id)));
    } catch (e) {
      console.error('[WelcomePage] Error persisting default agents:', e);
    }
  }, []);

  // 每次选择变更后持久化（跳过初始空数组）
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (selectedAgents.length === 0) return; // 防止初始空状态覆盖
    try {
      localStorage.setItem(SELECTED_AGENTS_KEY, JSON.stringify(selectedAgents.map(a => a.id)));
    } catch (e) {
      console.error('[WelcomePage] Error persisting agent selection:', e);
    }
  }, [selectedAgents]);

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
      // 不允许低于最少人数
      if (selectedAgents.length <= MIN_SLOTS) return;
      setSelectedAgents(selectedAgents.filter(a => a.id !== agent.id));
    } else if (selectedAgents.length < MAX_SLOTS) {
      const fullAgent = ALL_AGENTS.find(a => a.id === agent.id);
      if (fullAgent) {
        setSelectedAgents([...selectedAgents, fullAgent]);
      }
    }
  };

  // Create array of MAX_SLOTS(6) slots for the 2x3 grid
  const slots = Array.from({ length: MAX_SLOTS }, (_, index) => selectedAgents[index] || null);

  // 是否满足最低人数要求
  const isAgentCountValid = selectedAgents.length >= MIN_SLOTS && selectedAgents.length <= MAX_SLOTS;

  // 保存历史话题到localStorage
  const saveHistoryTopic = (discussion: Discussion) => {
    try {
      const key = getHistoryKey();
      const stored = localStorage.getItem(key);
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
      localStorage.setItem(key, JSON.stringify(sortedTopics));
    } catch (error) {
      console.error('[WelcomePage] Error saving history topic:', error);
    }
  };

  // 创建讨论的通用函数
  const createDiscussion = async (topicTitle: string) => {
    if (!topicTitle.trim() || isLoading || selectedAgents.length < MIN_SLOTS || selectedAgents.length > MAX_SLOTS) return;

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
    <div className="h-full bg-surface-card flex flex-col relative">
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
        minSlots={MIN_SLOTS}
        maxSlots={MAX_SLOTS}
      />

      {/* Header */}
      <div className="relative px-5 py-4 flex items-center justify-between">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5 text-content-primary" strokeWidth={1.5} />
        </button>
        <h1 className="text-[16px] font-medium text-content-primary">LeapAgents</h1>
        {onLogout ? (
          <button
            onClick={onLogout}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            title="退出登录"
          >
            <LogOut className="w-4 h-4 text-content-muted" strokeWidth={1.5} />
          </button>
        ) : (
          <div className="w-10" />
        )}
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
          {/* Brand Avatar — 100px */}
          <div className="relative z-10 drop-shadow-2xl">
            <img src="/brand-avatar.png" alt="LeapAgents" width={100} height={100} className="rounded-full" />
          </div>
        </div>

        {/* Left-Aligned Text Content */}
        <div className="px-5 text-center space-y-2">
          <p className="text-[14px] text-content-muted leading-relaxed">
            一个视角，难免有盲区
          </p>
          <h2 className="text-[22px] text-content-primary font-medium">多位专家交锋，越辩越明</h2>
          <p className="text-[14px] text-content-muted leading-relaxed">
            组建你的 AI 专家团，开始讨论
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
              />
            ))}
          </div>
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
              disabled={isLoading || selectedAgents.length < MIN_SLOTS}
              className="flex-shrink-0 w-[calc(100%-40px)] snap-start bg-surface-card rounded-full px-4 py-2.5 border border-line shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-[#AAE874] hover:shadow-[0_4px_12px_rgba(170,232,116,0.2)] active:scale-[0.98] transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#AAE874]/10 flex items-center justify-center group-hover:bg-[#AAE874]/20 transition-colors">
                  <span className="text-[14px]">💡</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-content-primary font-medium truncate">
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
                  : 'w-1.5 h-1.5 bg-line-dashed'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Action Bar — 与讨论页底部栏对齐 */}
      <div className="absolute bottom-0 left-0 right-0 z-50">
        {/* Glassmorphic Background with Gradient */}
        <div className="absolute inset-0 backdrop-blur-xl" style={{ background: `linear-gradient(to top, rgba(170,232,116,0.10), var(--color-glass-strong), var(--color-glass-medium))` }} />

        {/* Input Bar Container */}
        <div className={`relative flex gap-3 px-5 py-4 ${isInputMultiLine ? 'items-end' : 'items-center'}`}>
          {/* Input Field */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStartDiscussion();
                }
              }}
              placeholder="输入话题，开始讨论..."
              rows={1}
              className="block w-full px-5 bg-surface-input border border-line text-[14px] text-content-primary placeholder:text-content-placeholder resize-none focus:outline-none focus:border-[#AAE874] focus:shadow-[0_0_0_3px_rgba(170,232,116,0.1)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                // 自动滚动到文字底部
                target.scrollTop = target.scrollHeight;
              }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleStartDiscussion}
            disabled={!topic.trim() || isLoading || selectedAgents.length < MIN_SLOTS}
            className={`
              flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all
              ${topic.trim() && !isLoading && selectedAgents.length >= MIN_SLOTS
                ? 'bg-[#AAE874] active:scale-95 shadow-[0_4px_16px_rgba(170,232,116,0.4)] hover:shadow-[0_6px_20px_rgba(170,232,116,0.5)]'
                : 'bg-line cursor-not-allowed opacity-50'
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
        {/* Safe area spacer for iPhone */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
}
