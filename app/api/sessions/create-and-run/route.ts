import { NextRequest, NextResponse } from 'next/server';
import { startSession, runRound } from '@/lib/discussionService';
import type { AgentId } from '@/prompts/roundAgentPrompts';

/**
 * 创建会话并运行第一轮讨论
 * 在同一个请求中完成，避免内存状态丢失问题
 * 
 * 注意：这个 API 会进行多次 LLM 调用（每个 Agent 的发言、互评，以及总结）
 * 可能需要较长时间，请确保客户端有足够的超时时间
 */
export const maxDuration = 300; // 5 分钟超时（Vercel Pro 计划支持）

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  
  try {
    const body = await request.json();
    const { topicTitle, topicDescription, userGoal, agentIds } = body;

    if (!topicTitle || !userGoal || !agentIds || !Array.isArray(agentIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: topicTitle, userGoal, agentIds' },
        { status: 400 }
      );
    }

    console.log('[API /api/sessions/create-and-run] Creating session...');
    console.log('[API /api/sessions/create-and-run] Request details:', {
      topicTitle,
      agentCount: agentIds.length,
      agentIds,
    });

    // 创建会话
    const session = await startSession({
      topicTitle,
      topicDescription: topicDescription || '',
      userGoal,
      agentIds: agentIds as AgentId[],
    });

    console.log('[API /api/sessions/create-and-run] Session created:', session.id);
    console.log('[API /api/sessions/create-and-run] Session creation took:', Date.now() - requestStartTime, 'ms');

    // 在同一个请求中运行第一轮
    console.log('[API /api/sessions/create-and-run] Running first round...');
    const roundStartTime = Date.now();
    const updatedSession = await runRound(session.id);
    const roundDuration = Date.now() - roundStartTime;
    
    console.log('[API /api/sessions/create-and-run] First round completed');
    console.log('[API /api/sessions/create-and-run] Round duration:', roundDuration, 'ms');
    console.log('[API /api/sessions/create-and-run] Total request duration:', Date.now() - requestStartTime, 'ms');
    console.log('[API /api/sessions/create-and-run] Rounds count:', updatedSession.rounds.length);

    return NextResponse.json({ session: updatedSession }, { status: 201 });
  } catch (error) {
    console.error('[API /api/sessions/create-and-run] Error:', error);
    console.error('[API /api/sessions/create-and-run] Error after:', Date.now() - requestStartTime, 'ms');
    
    // 提供更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[API /api/sessions/create-and-run] Error stack:', errorStack);
    
    return NextResponse.json(
      { 
        error: `Failed to create session and run round: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
