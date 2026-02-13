'use client';

import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { Agent, Discussion } from '@/types';
import type { AgentId } from '@/prompts/roundAgentPrompts';

type NewDiscussionPageProps = {
  onBack: () => void;
  onCreateDiscussion: (discussion: Discussion) => void;
};

const PRESET_AGENTS: Agent[] = [
  {
    id: 'macro_economist',
    name: '涨停敢死队长',
    description: '短线游资之王，从盘面和资金流向给出最直接的操作判断',
    color: 'bg-red-500',
    icon: '🔥',
    selected: false,
  },
  {
    id: 'finance_expert',
    name: '价值投资苦行僧',
    description: '巴菲特门徒，从企业内在价值和护城河角度评估长期持有价值',
    color: 'bg-emerald-600',
    icon: '🧘',
    selected: false,
  },
  {
    id: 'senior_stock_practitioner',
    name: '量化狙击手',
    description: '华尔街归来的算法之神，用数据和模型说话，拒绝一切"凭感觉"',
    color: 'bg-indigo-600',
    icon: '📊',
    selected: false,
  },
  {
    id: 'veteran_stock_tycoon',
    name: '草根股神老王',
    description: '28年实战传奇，从人性和市场周期角度给出朴素但深刻的建议',
    color: 'bg-amber-600',
    icon: '🎣',
    selected: false,
  },
];

export function NewDiscussionPage({ onBack, onCreateDiscussion }: NewDiscussionPageProps) {
  const [title, setTitle] = useState('');
  const [background, setBackground] = useState('');
  const [agents, setAgents] = useState<Agent[]>(PRESET_AGENTS);
  const [isLoading, setIsLoading] = useState(false);

  const toggleAgent = (id: string) => {
    setAgents(agents.map(agent => 
      agent.id === id ? { ...agent, selected: !agent.selected } : agent
    ));
  };

  const selectedCount = agents.filter(a => a.selected).length;
  const canStart = title.trim() !== '' && selectedCount >= 3;

  const handleStart = async () => {
    if (!canStart || isLoading) return;

    setIsLoading(true);
    try {
      const selectedAgents = agents.filter(a => a.selected);
      const agentIds = selectedAgents.map(a => a.id) as AgentId[];

      // 只创建会话，不运行讨论
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: title,
          topicDescription: background,
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

      console.log('[NewDiscussionPage] Session created:', session.id);

      // 创建空的讨论对象，进入讨论页面后再开始请求
      const discussion: Discussion = {
        id: session.id,
        title,
        background,
        agents: selectedAgents,
        rounds: [], // 空的轮次，等待在讨论页面中填充
        comments: selectedAgents.map(agent => ({
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color,
          content: '等待发言...',
          expanded: false,
        })),
        moderatorAnalysis: {
          round: 1,
          consensusLevel: 0,
          summary: '讨论进行中...',
          newPoints: [],
          consensus: [],
          disagreements: [],
        },
        // 保存完整的 session 数据
        sessionData: session,
      };

      onCreateDiscussion(discussion);
    } catch (error) {
      console.error('Error creating discussion:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`创建讨论失败：${errorMessage}\n\n请检查浏览器控制台获取详细信息。`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="flex-1 text-center text-lg text-gray-900">新建讨论</h1>
        <div className="w-9"></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Topic Input */}
          <div className="bg-white rounded-2xl p-4">
            <label className="block text-sm text-gray-700 mb-2">讨论话题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：腾讯股票接下来走势如何"
              className="w-full px-0 py-2 text-base text-gray-900 placeholder-gray-400 border-0 border-b border-gray-200 focus:outline-none focus:border-blue-500"
            />

            <label className="block text-sm text-gray-700 mb-2 mt-6">背景说明（可选）</label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="你的持仓情况、关注点等..."
              rows={3}
              className="w-full px-0 py-2 text-sm text-gray-900 placeholder-gray-400 border-0 border-b border-gray-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Agent Selection */}
          <div className="bg-white rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-gray-900">选择参与的 AI（至少3个）</h2>
              <span className="text-xs text-gray-500">{selectedCount}/4</span>
            </div>

            <div className="space-y-3">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    agent.selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 ${agent.color} rounded-full flex items-center justify-center text-xl flex-shrink-0`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base text-gray-900">{agent.name}</span>
                        {agent.selected && (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-24"></div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
        <button
          onClick={handleStart}
          disabled={!canStart || isLoading}
          className={`w-full py-4 rounded-full transition-all text-base ${
            canStart && !isLoading
              ? 'bg-indigo-500 text-white shadow-lg active:scale-95'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {isLoading ? '创建中...' : '开始讨论'}
        </button>
        {/* Safe area spacer for iPhone */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
}
