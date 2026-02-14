'use client';

import React, { useState } from 'react';
import { LogIn, UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

/**
 * 登录/注册页面
 * 简洁的移动端适配界面
 */
export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { username, password }
        : { username, password, displayName: displayName || username };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '操作失败');
        return;
      }

      // 保存 Token
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess();
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 bg-gradient-to-b from-surface-card to-surface-page">
      {/* Logo 区域 */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
          <span className="text-white text-2xl font-bold">AI</span>
        </div>
        <h1 className="text-xl font-bold text-content-heading">多 Agent 股票讨论</h1>
        <p className="text-sm text-content-muted mt-1">
          {mode === 'login' ? '登录你的账号' : '创建新账号'}
        </p>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="w-full max-w-[300px] space-y-4">
        {/* 用户名 */}
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            用户名
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            className="w-full px-3 py-2.5 border border-line rounded-lg text-sm text-content-primary bg-surface-input
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              placeholder:text-content-placeholder"
            required
            autoComplete="username"
          />
        </div>

        {/* 显示名称（仅注册时） */}
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              显示名称
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="你的昵称（可选）"
              className="w-full px-3 py-2.5 border border-line rounded-lg text-sm text-content-primary bg-surface-input
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                placeholder:text-content-placeholder"
              autoComplete="name"
            />
          </div>
        )}

        {/* 密码 */}
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            密码
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-3 py-2.5 border border-line rounded-lg text-sm pr-10 text-content-primary bg-surface-input
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                placeholder:text-content-placeholder"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-content-placeholder hover:text-content-secondary"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-[#E05454]/10 px-3 py-2 rounded-lg">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-white text-sm font-medium
            bg-gradient-to-r from-blue-500 to-blue-600
            hover:from-blue-600 hover:to-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : mode === 'login' ? (
            <>
              <LogIn size={16} />
              登录
            </>
          ) : (
            <>
              <UserPlus size={16} />
              注册
            </>
          )}
        </button>

        {/* 切换登录/注册 */}
        <div className="text-center text-sm text-content-muted">
          {mode === 'login' ? (
            <span>
              没有账号？{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="text-blue-600 hover:underline"
              >
                立即注册
              </button>
            </span>
          ) : (
            <span>
              已有账号？{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="text-blue-600 hover:underline"
              >
                去登录
              </button>
            </span>
          )}
        </div>
      </form>

      {/* 底部提示 */}
      <p className="mt-8 text-xs text-content-placeholder">
        演示账号: demo / demo123
      </p>
    </div>
  );
}
