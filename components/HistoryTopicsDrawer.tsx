'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Discussion } from '@/types';

// 历史话题类型（保存完整的Discussion对象）
interface HistoryTopic {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  discussion: Discussion;
}

// localStorage key
const HISTORY_TOPICS_KEY = 'multiagent_history_topics';

type HistoryTopicsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopic: (discussion: Discussion) => void;
  isLoading?: boolean;
};

export function HistoryTopicsDrawer({ isOpen, onClose, onSelectTopic, isLoading = false }: HistoryTopicsDrawerProps) {
  const [historyTopics, setHistoryTopics] = useState<HistoryTopic[]>([]);

  // 从localStorage加载历史话题
  useEffect(() => {
    const loadHistoryTopics = () => {
      try {
        const stored = localStorage.getItem(HISTORY_TOPICS_KEY);
        if (stored) {
          const topics = JSON.parse(stored) as any[];
          // 过滤和验证：只保留有效的历史话题（有discussion字段的）
          const validTopics = topics
            .filter(t => t && t.id && t.title && t.discussion)
            .map(t => ({
              id: t.id,
              title: t.title,
              createdAt: t.createdAt || Date.now(),
              updatedAt: t.updatedAt || t.createdAt || Date.now(),
              discussion: t.discussion,
            })) as HistoryTopic[];
          
          // 按更新时间倒序排列
          const sortedTopics = validTopics.sort((a, b) => b.updatedAt - a.updatedAt);
          setHistoryTopics(sortedTopics);
        }
      } catch (error) {
        console.error('[HistoryTopicsDrawer] Error loading history topics:', error);
        setHistoryTopics([]);
      }
    };
    loadHistoryTopics();
  }, [isOpen]); // 当抽屉打开时重新加载

  // 处理历史话题点击
  const handleTopicClick = (historyTopic: HistoryTopic) => {
    onClose();
    onSelectTopic(historyTopic.discussion);
  };

  return (
    <>
      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Drawer Header */}
          <div className="px-4 py-4 flex items-center justify-between border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">历史话题</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* History Topics List */}
          <div className="flex-1 overflow-y-auto">
            {historyTopics.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500">暂无历史话题</p>
              </div>
            ) : (
              <div className="px-2 py-2">
                {historyTopics.map((historyTopic) => (
                  <button
                    key={historyTopic.id}
                    onClick={() => handleTopicClick(historyTopic)}
                    disabled={isLoading}
                    className="w-full px-4 py-3 mb-2 text-left bg-white rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100"
                  >
                    <p className="text-sm text-gray-900 font-medium mb-1">{historyTopic.title}</p>
                    <p className="text-xs text-gray-500">
                      {historyTopic.discussion?.rounds && historyTopic.discussion.rounds.length > 0
                        ? `${historyTopic.discussion.rounds.length} 轮讨论`
                        : '新话题'}
                      {' · '}
                      {new Date(historyTopic.updatedAt || historyTopic.createdAt || Date.now()).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
