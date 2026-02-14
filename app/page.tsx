'use client';

import { useState, useEffect } from 'react';
import { WelcomePage } from '@/components/WelcomePage';
import { DiscussionPage } from '@/components/DiscussionPage';
import { LoginPage } from '@/components/LoginPage';
import { isApiUrl, isAuthUrl, getApiUrl } from '@/lib/apiConfig';
import type { Discussion } from '@/types';

/**
 * 全局 fetch 拦截：自动为所有 API 请求携带 Authorization 头
 *
 * 支持两种模式：
 * - 本地开发（无 NEXT_PUBLIC_API_BASE_URL）：匹配相对路径 /api/...
 * - 生产部署（设了 NEXT_PUBLIC_API_BASE_URL）：同时匹配相对和绝对路径
 */
const originalFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

if (typeof window !== 'undefined') {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // 只为 API 请求添加 token（排除 auth 相关接口）
    if (isApiUrl(url) && !isAuthUrl(url)) {
      const token = localStorage.getItem('access_token');
      if (token) {
        const headers = new Headers(init?.headers);
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }

    const response = await originalFetch(input, init);

    // 如果返回 401，可能是 token 过期，尝试刷新
    if (response.status === 401 && isApiUrl(url) && !isAuthUrl(url)) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshResponse = await originalFetch(getApiUrl('/api/auth/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            localStorage.setItem('access_token', data.accessToken);
            localStorage.setItem('refresh_token', data.refreshToken);
            if (data.user) {
              localStorage.setItem('user', JSON.stringify(data.user));
            }

            // 用新 token 重试原请求
            const retryHeaders = new Headers(init?.headers);
            retryHeaders.set('Authorization', `Bearer ${data.accessToken}`);
            return originalFetch(input, { ...init, headers: retryHeaders });
          }
        } catch {
          // refresh 失败，不处理
        }
      }

      // 刷新失败，清除 token
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }

    return response;
  };
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState<'welcome' | 'discussion'>('welcome');
  const [discussion, setDiscussion] = useState<Discussion | null>(null);

  // 检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    setIsAuthenticated(!!(token && user));
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentPage('welcome');
    setDiscussion(null);
  };

  const handleCreateDiscussion = (newDiscussion: Discussion) => {
    setDiscussion(newDiscussion);
    setCurrentPage('discussion');
  };

  const handleBackToHome = () => {
    setCurrentPage('welcome');
    setDiscussion(null);
  };

  // 加载中（检查登录状态）
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-surface-page">
        <div className="w-full max-w-[390px] h-[100dvh] max-h-[844px] bg-surface-card overflow-hidden relative
          sm:rounded-[32px] sm:border sm:border-line
          max-sm:max-h-none max-sm:rounded-none max-sm:border-none
          flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-surface-page">
      {/* H5 容器：移动端全屏，桌面端以 390×844 居中展示 */}
      <div className="w-full max-w-[390px] h-[100dvh] max-h-[844px] bg-surface-card overflow-hidden relative
        sm:rounded-[32px] sm:border sm:border-line
        max-sm:max-h-none max-sm:rounded-none max-sm:border-none">
        {!isAuthenticated && (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )}
        {isAuthenticated && currentPage === 'welcome' && (
          <WelcomePage
            onCreateDiscussion={handleCreateDiscussion}
            onLogout={handleLogout}
          />
        )}
        {isAuthenticated && currentPage === 'discussion' && discussion && (
          <DiscussionPage
            discussion={discussion}
            onBack={handleBackToHome}
            onUpdateDiscussion={setDiscussion}
          />
        )}
      </div>
    </div>
  );
}
