import { NextRequest } from 'next/server';
import { getSession, restoreSession, buildHistoryText } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildAgentSpeechUserPrompt } from '@/prompts/builder';
import { llmClient } from '@/lib/llmClient';
import type { AgentId } from '@/prompts/roundAgentPrompts';

/**
 * 流式获取单个 Agent 的发言（Server-Sent Events）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, agentId, roundIndex, sessionData } = body;

    if (!sessionId || !agentId || !roundIndex) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, agentId, roundIndex' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 恢复或获取 session
    let session = getSession(sessionId);
    
    if (!session && sessionData) {
      restoreSession(sessionData as Session);
      session = getSession(sessionId);
    }
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const agent = session.agents.find(a => a.id === agentId);
    if (!agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 构建历史记录文本
    const historyText = buildHistoryText(session.rounds);

    // 生成发言
    const systemPrompt = agent.systemPrompt;
    const userPrompt = buildAgentSpeechUserPrompt(agentId as AgentId, {
      topic: session.topicTitle,
      description: session.topicDescription,
      history: historyText,
      round_index: roundIndex,
    });

    // 创建 ReadableStream 用于流式输出
    let isCancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // 监听请求取消
        request.signal.addEventListener('abort', () => {
          isCancelled = true;
          try {
            controller.close();
          } catch (e) {
            // Controller可能已经关闭，忽略错误
          }
        });
        
        // 安全的enqueue函数，检查controller状态
        const safeEnqueue = (data: Uint8Array) => {
          if (isCancelled) return false;
          try {
            controller.enqueue(data);
            return true;
          } catch (error: any) {
            // Controller已关闭或处于无效状态
            if (error?.code === 'ERR_INVALID_STATE' || error?.message?.includes('closed')) {
              isCancelled = true;
              return false;
            }
            throw error;
          }
        };
        
        try {
          // 发送初始信息
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', agentId, agentName: agent.name })}\n\n`))) {
            return; // 请求已取消
          }
          
          let fullContent = '';
          
          // 调用流式生成方法
          await llmClient.generateStream(systemPrompt, userPrompt, agentId, (chunk: string) => {
            if (isCancelled) return; // 请求已取消，停止处理
            fullContent += chunk;
            // 发送每个数据块
            if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`))) {
              return; // Controller已关闭，停止处理
            }
          });
          
          // 如果请求已取消，不发送完成信息
          if (isCancelled) return;
          
          // 发送完成信息
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', agentId, agentName: agent.name, speech: fullContent })}\n\n`))) {
            return;
          }
          
          controller.close();
        } catch (error) {
          if (isCancelled) return; // 请求已取消，忽略错误
          
          console.error('[API /api/agents/speech/stream] Error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
          try {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`));
            controller.close();
          } catch (e) {
            // Controller可能已关闭，忽略
          }
        }
      },
      cancel() {
        isCancelled = true;
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
    console.error('[API /api/agents/speech/stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate speech' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
