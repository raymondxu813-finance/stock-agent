// /app/api/sessions/history/route.ts

import { createRequestLogger } from '@/lib/logger';

/**
 * 用户历史会话 API
 *
 * GET  /api/sessions/history         — 查询当前用户的会话列表
 * DELETE /api/sessions/history?id=xxx — 删除当前用户拥有的指定会话
 *
 * 通过 middleware 注入的 x-user-id 请求头识别当前用户。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionStore } from '@/lib/storage';
import { getSession } from '@/lib/discussionService';

/**
 * 查询当前用户的会话列表
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr) : 50;

    const store = getSessionStore();
    const sessions = await store.listByUser(userId, limit);

    // 返回精简的会话列表（不含完整的 rounds 数据，减小传输量）
    const list = sessions.map((s) => ({
      id: s.id,
      topicTitle: s.topicTitle,
      topicDescription: s.topicDescription,
      userGoal: s.userGoal,
      agentCount: s.agents.length,
      roundCount: s.rounds.length,
      // 从 session id 中提取创建时间
      createdAt: parseInt(s.id.split('_')[1] || '0'),
    }));

    return NextResponse.json({ sessions: list });
  } catch (error) {
    const reqLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown');
    reqLog.error({ err: error }, '[sessions/history] GET error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询历史失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除当前用户拥有的指定会话
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: '缺少会话 ID' },
        { status: 400 }
      );
    }

    // 先检查归属权
    const store = getSessionStore();
    const session = await store.get(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: '会话不存在' },
        { status: 404 }
      );
    }

    if (session.userId && session.userId !== userId) {
      return NextResponse.json(
        { error: '无权删除该会话' },
        { status: 403 }
      );
    }

    await store.delete(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const reqLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown');
    reqLog.error({ err: error }, '[sessions/history] DELETE error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除会话失败' },
      { status: 500 }
    );
  }
}
