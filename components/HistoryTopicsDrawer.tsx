'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Sun, Moon, Loader2 } from 'lucide-react';
import type { Discussion } from '@/types';
import { useTheme } from '@/lib/ThemeContext';
import { getApiUrl } from '@/lib/apiConfig';
import { rebuildDiscussionFromSession } from '@/lib/sessionToDiscussion';

// 历史话题类型（精简，仅用于列表展示）
interface HistoryTopic {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  roundCount: number;
}

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
function SwipeableItem({ topic, onSelect, onDelete, disabled, isItemLoading }: {
  topic: HistoryTopic;
  onSelect: () => void;
  onDelete: () => void;
  disabled: boolean;
  isItemLoading?: boolean;
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
          className={`w-full text-left px-3 py-2.5 rounded-lg bg-surface-card hover:bg-surface-hover active:bg-surface-bubble transition-colors cursor-pointer select-none relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <p className="text-[14px] text-content-primary line-clamp-2 leading-relaxed">
            {topic.title}
          </p>
          {isItemLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-card/70 rounded-lg">
              <Loader2 className="w-4 h-4 text-content-muted animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoryTopicsDrawer({ isOpen, onClose, onSelectTopic, isLoading = false }: HistoryTopicsDrawerProps) {
  const [historyTopics, setHistoryTopics] = useState<HistoryTopic[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [loadingTopicId, setLoadingTopicId] = useState<string | null>(null); // 正在加载的 topic ID
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { isDark: isDarkMode, toggleTheme } = useTheme();

  // 从服务器加载历史话题（唯一数据源）
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadServerTopics = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(getApiUrl('/api/sessions/history?limit=50'));
        if (!res.ok) {
          // 401/403 说明 auth 已失效，由全局 fetch 拦截器处理跳转登录，
          // 这里不清空历史（保留当前列表直到页面跳转）
          if (res.status === 401 || res.status === 403) {
            console.warn('[HistoryTopicsDrawer] Auth expired, skipping history clear');
            return;
          }
          setHistoryTopics([]);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (!data.sessions || !Array.isArray(data.sessions)) {
          setHistoryTopics([]);
          return;
        }

        const topics: HistoryTopic[] = data.sessions.map((s: any) => ({
          id: s.id,
          title: s.topicTitle || '未命名讨论',
          createdAt: s.createdAt || Date.now(),
          updatedAt: s.createdAt || Date.now(),
          roundCount: s.roundCount || 0,
        }));

        setHistoryTopics(topics);
      } catch (error) {
        console.error('[HistoryTopicsDrawer] Error loading history:', error);
        if (!cancelled) setHistoryTopics([]);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };

    loadServerTopics();
    setShowClearConfirm(false);

    return () => { cancelled = true; };
  }, [isOpen]);

  /** 点击历史记录：先拉取完整 session，重建 Discussion 后进入讨论页 */
  const handleTopicClick = async (historyTopic: HistoryTopic) => {
    if (loadingTopicId) return; // 防止重复点击
    setLoadingTopicId(historyTopic.id);
    try {
      const res = await fetch(getApiUrl(`/api/sessions?id=${historyTopic.id}`));
      if (!res.ok) {
        console.error('[HistoryTopicsDrawer] Failed to fetch session:', res.status);
        alert('加载讨论失败，请稍后重试');
        return;
      }
      const { session } = await res.json();
      if (!session) {
        alert('讨论数据不存在');
        return;
      }
      const discussion = rebuildDiscussionFromSession(session);
      onClose();
      onSelectTopic(discussion);
    } catch (error) {
      console.error('[HistoryTopicsDrawer] Error loading session:', error);
      alert('加载讨论失败，请检查网络连接');
    } finally {
      setLoadingTopicId(null);
    }
  };

  /** 删除单条记录（服务器 + 本地状态） */
  const handleDeleteTopic = (topicId: string) => {
    setHistoryTopics((prev) => prev.filter((t) => t.id !== topicId));
    // 异步通知服务器删除
    fetch(getApiUrl(`/api/sessions/history?id=${topicId}`), { method: 'DELETE' }).catch((e) => {
      console.error('[HistoryTopicsDrawer] Error deleting from server:', e);
    });
  };

  /** 清空全部历史（逐条删除） */
  const handleClearAll = () => {
    const ids = historyTopics.map((t) => t.id);
    setHistoryTopics([]);
    setShowClearConfirm(false);
    // 异步逐条通知服务器删除
    ids.forEach((id) => {
      fetch(getApiUrl(`/api/sessions/history?id=${id}`), { method: 'DELETE' }).catch(() => {});
    });
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
          disabled={isLoading || (!!loadingTopicId && loadingTopicId !== historyTopic.id)}
          isItemLoading={loadingTopicId === historyTopic.id}
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
        className={`absolute left-0 top-0 bottom-0 w-[280px] bg-surface-card z-[70] transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <h2 className="text-[19px] font-bold text-content-primary">历史讨论</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover active:scale-95 transition-all"
          >
            <X className="w-5 h-5 text-content-secondary" strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable History */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory ? (
            /* 骨架屏 */
            <div className="px-5 pt-5 space-y-3">
              <div className="h-3 w-10 bg-surface-hover rounded animate-pulse" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-3 py-2.5 rounded-lg bg-surface-hover/50">
                  <div className="space-y-2">
                    <div className="h-3.5 bg-surface-hover rounded animate-pulse" style={{ width: `${70 + (i * 7) % 30}%`, animationDelay: `${i * 100}ms` }} />
                    <div className="h-3.5 bg-surface-hover rounded animate-pulse" style={{ width: `${40 + (i * 13) % 40}%`, animationDelay: `${i * 100 + 50}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : historyTopics.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[14px] text-content-muted">暂无历史讨论</p>
            </div>
          ) : (
            <>
              {/* Today Section */}
              {todayTopics.length > 0 && (
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-[12px] font-bold text-content-muted mb-2">今天</h3>
                  {renderTopicList(todayTopics)}
                </div>
              )}

              {/* Last 7 Days Section */}
              {weekTopics.length > 0 && (
                <div className="px-5 pb-3">
                  <h3 className="text-[12px] font-bold text-content-muted mb-2">7天内</h3>
                  {renderTopicList(weekTopics)}
                </div>
              )}

              {/* Earlier Section */}
              {earlierTopics.length > 0 && (
                <div className="px-5 pb-3">
                  <h3 className="text-[12px] font-bold text-content-muted mb-2">更早</h3>
                  {renderTopicList(earlierTopics)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — 清空历史 + 白天/黑夜模式 */}
        <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between">
          {/* 左侧：清空历史 */}
          {historyTopics.length > 0 ? (
            showClearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-content-muted">确认清空？</span>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 text-[12px] text-content-secondary rounded-full border border-line-dashed active:scale-95 transition-transform"
                >
                  取消
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-[12px] text-white bg-[#EF4444] rounded-full active:scale-95 transition-transform"
                >
                  清空
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 py-1.5 rounded-lg text-[13px] text-content-muted hover:text-content-secondary active:text-content-primary transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                清空历史
              </button>
            )
          ) : (
            <div />
          )}

          {/* 右侧：白天/黑夜模式切换 */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover active:scale-95 transition-all"
            title={isDarkMode ? '切换到白天模式' : '切换到黑夜模式'}
          >
            {isDarkMode ? (
              <Sun className="w-[18px] h-[18px] text-content-muted" strokeWidth={2} />
            ) : (
              <Moon className="w-[18px] h-[18px] text-content-muted" strokeWidth={2} />
            )}
          </button>
        </div>
        {/* Safe area spacer for iPhone */}
        <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </>
  );
}
