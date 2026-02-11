'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import type { Discussion } from '@/types';
import type { AgentId } from '@/prompts/roundAgentPrompts';
import { HistoryTopicsDrawer } from './HistoryTopicsDrawer';

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

// 默认选择的4个agent
const DEFAULT_AGENTS = [
  {
    id: 'macro_economist' as AgentId,
    name: '涨停敢死队长',
    color: 'bg-red-500',
    icon: '🔥',
  },
  {
    id: 'finance_expert' as AgentId,
    name: '价值投资苦行僧',
    color: 'bg-emerald-600',
    icon: '🧘',
  },
  {
    id: 'senior_stock_practitioner' as AgentId,
    name: '量化狙击手',
    color: 'bg-indigo-600',
    icon: '📊',
  },
  {
    id: 'veteran_stock_tycoon' as AgentId,
    name: '草根股神老王',
    color: 'bg-amber-600',
    icon: '🎣',
  },
];

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

  // 保存历史话题到localStorage（保存完整的Discussion对象）
  const saveHistoryTopic = (discussion: Discussion) => {
    try {
      const stored = localStorage.getItem(HISTORY_TOPICS_KEY);
      const topics: HistoryTopic[] = stored ? JSON.parse(stored) : [];
      
      const now = Date.now();
      // 检查是否已存在
      const existingIndex = topics.findIndex(t => t.id === discussion.id);
      if (existingIndex >= 0) {
        // 更新现有话题的数据和时间
        topics[existingIndex] = {
          id: discussion.id!,
          title: discussion.title,
          createdAt: topics[existingIndex].createdAt, // 保留原始创建时间
          updatedAt: now,
          discussion: discussion, // 保存完整的讨论数据
        };
      } else {
        // 添加新话题
        topics.push({
          id: discussion.id!,
          title: discussion.title,
          createdAt: now,
          updatedAt: now,
          discussion: discussion,
        });
      }
      
      // 限制最多保存50个历史话题
      const limitedTopics = topics.slice(0, 50);
      const sortedTopics = limitedTopics.sort((a, b) => b.updatedAt - a.updatedAt);
      localStorage.setItem(HISTORY_TOPICS_KEY, JSON.stringify(sortedTopics));
    } catch (error) {
      console.error('[WelcomePage] Error saving history topic:', error);
    }
  };

  // 创建讨论的通用函数
  const createDiscussion = async (topicTitle: string) => {
    if (!topicTitle.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const agentIds = DEFAULT_AGENTS.map(a => a.id);

      // 创建会话
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

      console.log('[WelcomePage] Session created:', session.id);

      // 创建讨论对象，进入讨论页面
      const discussion: Discussion = {
        id: session.id,
        title: topicTitle.trim(),
        background: '',
        agents: DEFAULT_AGENTS.map(a => ({
          id: a.id,
          name: a.name,
          description: '',
          color: a.color,
          icon: a.icon,
          selected: true, // 默认都选中
        })),
        rounds: [],
        comments: [], // 初始化为空数组
        moderatorAnalysis: {
          round: 0,
          consensusLevel: 0,
          summary: '',
          newPoints: [],
          consensus: [],
          disagreements: [],
        }, // 初始化 moderatorAnalysis
        sessionData: session,
      };

      // 保存历史话题（保存完整的Discussion对象）
      saveHistoryTopic(discussion);

      onCreateDiscussion(discussion);
    } catch (error) {
      console.error('[WelcomePage] Error creating discussion:', error);
      alert(`创建讨论失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理输入框提交
  const handleStartDiscussion = async () => {
    await createDiscussion(topic);
  };

  // 处理热门话题点击
  const handleTopicClick = async (topicText: string) => {
    await createDiscussion(topicText);
  };

  // 处理历史话题选择
  const handleSelectHistoryTopic = (discussion: Discussion) => {
    // 直接使用保存的完整讨论数据，恢复上次的讨论状态
    onCreateDiscussion(discussion);
  };

  return (
    <div className="h-full bg-[#f5f5f5] flex flex-col relative">
      {/* 历史话题抽屉 - 复用共享组件 */}
      <HistoryTopicsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectTopic={handleSelectHistoryTopic}
        isLoading={isLoading}
      />

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-lg text-gray-900">MultiAgent</h1>
        <div className="w-10" /> {/* 占位符，保持居中 */}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <p className="text-sm text-gray-500 mb-4">同一个 AI，可能遇到幻觉</p>
        <h2 className="text-3xl text-gray-900 mb-2">问多个 AI，</h2>
        <h2 className="text-3xl text-gray-900 mb-4">得到真相</h2>
        <p className="text-base text-gray-600">重大决定的 AI 顾问团</p>
      </div>

      {/* Selected Agents Display */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 mb-3 px-2">参与讨论的 AI</p>
        <div className="grid grid-cols-4 gap-3">
          {DEFAULT_AGENTS.map((agent) => (
            <div key={agent.id} className="flex flex-col items-center">
              <div className={`w-14 h-14 ${agent.color} rounded-full flex items-center justify-center text-xl mb-1.5 shadow-md`}>
                {agent.icon}
              </div>
              <span className="text-xs text-gray-900 text-center leading-tight">{agent.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Topics */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 mb-3 px-2">试试这些问题</p>
        <div className="space-y-2">
          {POPULAR_TOPICS.map((topicText, index) => (
            <button
              key={index}
              onClick={() => handleTopicClick(topicText)}
              disabled={isLoading}
              className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <p className="text-sm text-gray-900">{topicText}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-4 pb-8">
        <div className="bg-white rounded-full px-5 py-3 shadow-lg flex items-center gap-3">
          <input
            type="text"
            placeholder="输入话题，开始讨论..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleStartDiscussion();
              }
            }}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <button
            onClick={handleStartDiscussion}
            disabled={!topic.trim() || isLoading}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-opacity ${
              topic.trim() && !isLoading
                ? 'bg-indigo-500 opacity-100'
                : 'bg-indigo-500 opacity-50 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
