import { NextRequest } from 'next/server';
import { startSession } from '@/lib/discussionService';
import { runRoundWithProgress } from '@/lib/discussionService';
import type { AgentId } from '@/prompts/roundAgentPrompts';

/**
 * 创建会话并运行第一轮讨论（流式响应版本）
 * 使用 Server-Sent Events (SSE) 实时推送进度更新
 */
export const maxDuration = 300; // 5 分钟超时

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  
  try {
    const body = await request.json();
    const { topicTitle, topicDescription, userGoal, agentIds } = body;

    if (!topicTitle || !userGoal || !agentIds || !Array.isArray(agentIds)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: topicTitle, userGoal, agentIds' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 创建可读流用于 SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          // 发送会话创建开始事件
          sendEvent('session_creating', { message: '正在创建会话...' });

          // 创建会话
          const session = await startSession({
            topicTitle,
            topicDescription: topicDescription || '',
            userGoal,
            agentIds: agentIds as AgentId[],
          });

          sendEvent('session_created', { 
            sessionId: session.id,
            message: '会话创建成功'
          });

          // 运行第一轮讨论，带进度回调
          await runRoundWithProgress(session.id, (progress) => {
            sendEvent('progress', {
              ...progress,
              sessionId: session.id,
            });
          });

          // 获取最终结果
          const { getSession } = await import('@/lib/discussionService');
          const updatedSession = getSession(session.id);
          
          if (!updatedSession) {
            throw new Error('Session not found after round completion');
          }

          // 发送完成事件
          sendEvent('complete', { 
            session: updatedSession,
            message: '讨论完成'
          });

          controller.close();
        } catch (error) {
          console.error('[API /api/sessions/create-and-run-stream] Error:', error);
          sendEvent('error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            message: '发生错误'
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API /api/sessions/create-and-run-stream] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Failed to create stream: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
