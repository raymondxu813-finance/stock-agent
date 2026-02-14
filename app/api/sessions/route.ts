import { NextRequest, NextResponse } from 'next/server';
import { startSession } from '@/lib/discussionService';
import type { AgentId } from '@/prompts/roundAgentPrompts';
import { createSessionSchema, validateRequest } from '@/lib/validation';
import { createRequestLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Zod 结构化校验
    const validation = validateRequest(createSessionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { topicTitle, topicDescription, userGoal, agentIds } = validation.data;

    // 从 middleware 注入的请求头获取当前用户 ID
    const userId = request.headers.get('x-user-id') || undefined;

    const session = await startSession({
      topicTitle,
      topicDescription: topicDescription || '',
      userGoal,
      agentIds: agentIds as AgentId[],
      userId,
    });

    const reqLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown', { userId });
    reqLog.info({ sessionId: session.id }, '[API /api/sessions] Session created');

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const reqLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown');
    reqLog.error({ err: error }, '[API /api/sessions] Error creating session');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    const { getSessionAsync } = await import('@/lib/discussionService');
    const session = await getSessionAsync(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 归属权校验：只能访问自己的会话
    const userId = request.headers.get('x-user-id');
    if (session.userId && userId && session.userId !== userId) {
      return NextResponse.json(
        { error: '无权访问该会话' },
        { status: 403 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    const reqLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown');
    reqLog.error({ err: error }, '[API /api/sessions] Error getting session');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get session' },
      { status: 500 }
    );
  }
}
