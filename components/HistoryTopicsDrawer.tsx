'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen } from 'lucide-react';
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

// 时间分组辅助
const getTimeGroup = (timestamp: number): 'today' | 'week' | 'earlier' => {
  const now = Date.now();
  const diff = now - timestamp;
  const oneDay = 24 * 60 * 60 * 1000;
  if (diff < oneDay) return 'today';
  if (diff < 7 * oneDay) return 'week';
  return 'earlier';
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
          const validTopics = topics
            .filter(t => t && t.id && t.title && t.discussion)
            .map(t => ({
              id: t.id,
              title: t.title,
              createdAt: t.createdAt || Date.now(),
              updatedAt: t.updatedAt || t.createdAt || Date.now(),
              discussion: t.discussion,
            })) as HistoryTopic[];

          const sortedTopics = validTopics.sort((a, b) => b.updatedAt - a.updatedAt);
          setHistoryTopics(sortedTopics);
        }
      } catch (error) {
        console.error('[HistoryTopicsDrawer] Error loading history topics:', error);
        setHistoryTopics([]);
      }
    };
    loadHistoryTopics();
  }, [isOpen]);

  const handleTopicClick = (historyTopic: HistoryTopic) => {
    onClose();
    onSelectTopic(historyTopic.discussion);
  };

  // Group topics by time
  const todayTopics = historyTopics.filter(t => getTimeGroup(t.updatedAt) === 'today');
  const weekTopics = historyTopics.filter(t => getTimeGroup(t.updatedAt) === 'week');
  const earlierTopics = historyTopics.filter(t => getTimeGroup(t.updatedAt) === 'earlier');

  const renderTopicList = (topics: HistoryTopic[]) => (
    <div className="space-y-2">
      {topics.map((historyTopic) => (
        <button
          key={historyTopic.id}
          onClick={() => handleTopicClick(historyTopic)}
          disabled={isLoading}
          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <p className="text-[14px] text-[#333333] line-clamp-2 leading-relaxed">
            {historyTopic.title}
          </p>
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[280px] bg-white z-[70] shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F0]">
          <h2 className="text-[19px] font-bold text-black">历史消息</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] active:scale-95 transition-all"
          >
            <X className="w-5 h-5 text-[#666666]" strokeWidth={2} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-5 pt-5 pb-4">
          <button
            onClick={() => {
              onClose();
              // Navigate to home handled by parent
            }}
            className="w-full h-11 rounded-full border-2 border-[#AAE874] bg-white text-[15px] font-bold text-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-[#AAE874]/5"
          >
            <span className="text-[20px] text-[#AAE874]">+</span>
            新建对话
          </button>
        </div>

        {/* Scrollable History */}
        <div className="flex-1 overflow-y-auto pb-20" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {historyTopics.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[14px] text-[#999999]">暂无历史话题</p>
            </div>
          ) : (
            <>
              {/* Today Section */}
              {todayTopics.length > 0 && (
                <div className="px-5 pb-4">
                  <h3 className="text-[12px] font-bold text-[#999999] mb-3">今天</h3>
                  {renderTopicList(todayTopics)}
                </div>
              )}

              {/* Last 7 Days Section */}
              {weekTopics.length > 0 && (
                <div className="px-5 pb-4">
                  <h3 className="text-[12px] font-bold text-[#999999] mb-3">7天内</h3>
                  {renderTopicList(weekTopics)}
                </div>
              )}

              {/* Earlier Section */}
              {earlierTopics.length > 0 && (
                <div className="px-5 pb-4">
                  <h3 className="text-[12px] font-bold text-[#999999] mb-3">更早</h3>
                  {renderTopicList(earlierTopics)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - User Guide */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#F0F0F0] px-5 py-4">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors">
            <BookOpen className="w-5 h-5 text-[#666666]" strokeWidth={2} />
            <span className="text-[14px] text-[#333333] font-medium">使用指南</span>
          </button>
        </div>
      </div>
    </>
  );
}
