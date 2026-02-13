'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
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

/** 可左滑删除的历史记录 item */
function SwipeableItem({ topic, onSelect, onDelete, disabled }: {
  topic: HistoryTopic;
  onSelect: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [showDelete, setShowDelete] = useState(false);

  const DELETE_THRESHOLD = 64; // px to reveal delete button

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    currentXRef.current = diff;
    // Only allow left swipe (negative)
    const clamped = Math.max(-DELETE_THRESHOLD - 10, Math.min(0, diff));
    // If already showing delete and swiping right, allow closing
    if (showDelete) {
      const restore = Math.max(-DELETE_THRESHOLD - 10, Math.min(DELETE_THRESHOLD, diff));
      setOffsetX(restore > 0 ? 0 : -DELETE_THRESHOLD + restore);
    } else {
      setOffsetX(clamped);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (showDelete) {
      // If swiped right enough, close
      if (currentXRef.current > DELETE_THRESHOLD / 2) {
        setOffsetX(0);
        setShowDelete(false);
      } else {
        setOffsetX(-DELETE_THRESHOLD);
      }
    } else {
      if (currentXRef.current < -DELETE_THRESHOLD / 2) {
        setOffsetX(-DELETE_THRESHOLD);
        setShowDelete(true);
      } else {
        setOffsetX(0);
        setShowDelete(false);
      }
    }
  };

  // Mouse support for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    isDraggingRef.current = true;
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const diff = ev.clientX - startXRef.current;
      currentXRef.current = diff;
      const clamped = Math.max(-DELETE_THRESHOLD - 10, Math.min(0, diff));
      if (showDelete) {
        const restore = Math.max(-DELETE_THRESHOLD - 10, Math.min(DELETE_THRESHOLD, diff));
        setOffsetX(restore > 0 ? 0 : -DELETE_THRESHOLD + restore);
      } else {
        setOffsetX(clamped);
      }
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (showDelete) {
        if (currentXRef.current > DELETE_THRESHOLD / 2) {
          setOffsetX(0);
          setShowDelete(false);
        } else {
          setOffsetX(-DELETE_THRESHOLD);
        }
      } else {
        if (currentXRef.current < -DELETE_THRESHOLD / 2) {
          setOffsetX(-DELETE_THRESHOLD);
          setShowDelete(true);
        } else {
          setOffsetX(0);
          setShowDelete(false);
        }
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClick = () => {
    // Only select if not swiped
    if (!showDelete && Math.abs(currentXRef.current) < 5) {
      onSelect();
    }
  };

  const handleDeleteClick = () => {
    onDelete();
    setOffsetX(0);
    setShowDelete(false);
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg">
      {/* Delete button behind — only rendered when swiped */}
      {(showDelete || offsetX < 0) && (
        <div className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center bg-[#EF4444]">
          <button onClick={handleDeleteClick} className="w-full h-full flex items-center justify-center active:bg-[#DC2626] transition-colors">
            <Trash2 className="w-4 h-4 text-white" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Swipeable content — fully opaque background to cover red */}
      <div
        className="relative z-10 transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${offsetX}px)`, transitionDuration: isDraggingRef.current ? '0ms' : '200ms' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div
          className={`w-full text-left px-3 py-2.5 rounded-lg bg-white hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors cursor-pointer select-none ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <p className="text-[14px] text-[#333333] line-clamp-2 leading-relaxed">
            {topic.title}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HistoryTopicsDrawer({ isOpen, onClose, onSelectTopic, isLoading = false }: HistoryTopicsDrawerProps) {
  const [historyTopics, setHistoryTopics] = useState<HistoryTopic[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
        } else {
          setHistoryTopics([]);
        }
      } catch (error) {
        console.error('[HistoryTopicsDrawer] Error loading history topics:', error);
        setHistoryTopics([]);
      }
    };
    loadHistoryTopics();
    setShowClearConfirm(false);
  }, [isOpen]);

  const handleTopicClick = (historyTopic: HistoryTopic) => {
    onClose();
    onSelectTopic(historyTopic.discussion);
  };

  /** 删除单条记录 */
  const handleDeleteTopic = (topicId: string) => {
    const updated = historyTopics.filter(t => t.id !== topicId);
    setHistoryTopics(updated);
    try {
      localStorage.setItem(HISTORY_TOPICS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('[HistoryTopicsDrawer] Error saving after delete:', e);
    }
  };

  /** 清空全部历史 */
  const handleClearAll = () => {
    setHistoryTopics([]);
    setShowClearConfirm(false);
    try {
      localStorage.removeItem(HISTORY_TOPICS_KEY);
    } catch (e) {
      console.error('[HistoryTopicsDrawer] Error clearing history:', e);
    }
  };

  // Group topics by time
  const todayTopics = historyTopics.filter(t => getTimeGroup(t.updatedAt) === 'today');
  const weekTopics = historyTopics.filter(t => getTimeGroup(t.updatedAt) === 'week');
  const earlierTopics = historyTopics.filter(t => getTimeGroup(t.updatedAt) === 'earlier');

  const renderTopicList = (topics: HistoryTopic[]) => (
    <div className="space-y-1">
      {topics.map((historyTopic) => (
        <SwipeableItem
          key={historyTopic.id}
          topic={historyTopic}
          onSelect={() => handleTopicClick(historyTopic)}
          onDelete={() => handleDeleteTopic(historyTopic.id)}
          disabled={isLoading}
        />
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
        className={`absolute left-0 top-0 bottom-0 w-[280px] bg-white z-[70] transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F0] flex-shrink-0">
          <h2 className="text-[19px] font-bold text-black">历史讨论</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] active:scale-95 transition-all"
          >
            <X className="w-5 h-5 text-[#666666]" strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable History */}
        <div className="flex-1 overflow-y-auto">
          {historyTopics.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[14px] text-[#999999]">暂无历史讨论</p>
            </div>
          ) : (
            <>
              {/* Today Section */}
              {todayTopics.length > 0 && (
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-[12px] font-bold text-[#999999] mb-2">今天</h3>
                  {renderTopicList(todayTopics)}
                </div>
              )}

              {/* Last 7 Days Section */}
              {weekTopics.length > 0 && (
                <div className="px-5 pb-3">
                  <h3 className="text-[12px] font-bold text-[#999999] mb-2">7天内</h3>
                  {renderTopicList(weekTopics)}
                </div>
              )}

              {/* Earlier Section */}
              {earlierTopics.length > 0 && (
                <div className="px-5 pb-3">
                  <h3 className="text-[12px] font-bold text-[#999999] mb-2">更早</h3>
                  {renderTopicList(earlierTopics)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — 清空历史 */}
        {historyTopics.length > 0 && (
          <div className="flex-shrink-0 border-t border-[#F0F0F0] px-5 py-3">
            {showClearConfirm ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-[#999999]">确认清空全部？</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 text-[13px] text-[#666666] rounded-full border border-[#E0E0E0] active:scale-95 transition-transform"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-[13px] text-white bg-[#EF4444] rounded-full active:scale-95 transition-transform"
                  >
                    清空
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] text-[#999999] hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                清空历史
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
