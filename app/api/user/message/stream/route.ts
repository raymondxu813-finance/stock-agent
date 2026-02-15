import { NextRequest } from 'next/server';
import { getSession, getSessionAsync, restoreSession } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { defaultStockAgents } from '@/prompts/agents';
import { SENTIMENT_SUFFIX_INSTRUCTION } from '@/prompts/agents';
import { buildUserQuestionReplyUserPrompt, buildUserQuestionSystemPrompt } from '@/prompts/builder';
import { executeAgentStream } from '@/lib/agentExecutor';
import { parseSentimentBlock } from '@/lib/utils';

/**
 * 用户提问 → Agent 带工具回复 (Server-Sent Events)
 * 
 * 讨论完毕后，用户可以自由提问：
 * - 可 @某个 agent → 仅该 agent 回复
 * - 不 @任何人 → 所有 agent 依次回复
 * 
 * Agent 回复时可使用工具（查询股价、新闻等）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      userMessage,
      mentionedAgentIds,    // string[] - 用户 @提及的 agent ID
      historyContext,       // 之前讨论的要点摘要
      sessionData,          // 完整的 session 数据（用于恢复）
    } = body;

    if (!sessionId || !userMessage) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, userMessage' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 恢复或获取 session
    // 优先内存 -> 持久化存储 -> sessionData 恢复
    let session = await getSessionAsync(sessionId);
    if (!session && sessionData) {
      await restoreSession(sessionData as Session);
      session = getSession(sessionId);
    }

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 确定需要回复的 agents
    const respondingAgents = (mentionedAgentIds && mentionedAgentIds.length > 0)
      ? session.agents.filter(a => mentionedAgentIds.includes(a.id))
      : session.agents;

    if (respondingAgents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No agents found to respond' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[API /api/user/message/stream] User question: "${userMessage.substring(0, 100)}..."`);
    console.log(`[API /api/user/message/stream] Responding agents: ${respondingAgents.map(a => a.name).join(', ')}`);

    // 创建 SSE 流
    let isCancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // 监听请求取消
        request.signal.addEventListener('abort', () => {
          isCancelled = true;
          try { controller.close(); } catch { /* ignore */ }
        });

        // 安全的 enqueue
        const safeEnqueue = (data: Uint8Array): boolean => {
          if (isCancelled) return false;
          try {
            controller.enqueue(data);
            return true;
          } catch (error: any) {
            if (error?.code === 'ERR_INVALID_STATE' || error?.message?.includes('closed')) {
              isCancelled = true;
              return false;
            }
            throw error;
          }
        };

        try {
          // 收集已回复 agent 的内容，供后续 agent 参考
          const previousAgentReplies: Array<{ agentName: string; content: string }> = [];

          // 依次处理每个 agent（顺序，像群聊一样逐个回复）
          for (const agent of respondingAgents) {
            if (isCancelled) break;

            // 发送 agent 开始事件
            if (!safeEnqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'agent_start', agentId: agent.id, agentName: agent.name })}\n\n`
            ))) break;

            // 构建 system prompt：agent 原有 prompt + 用户提问模式后缀 + 情绪输出指令
            const systemPrompt = buildUserQuestionSystemPrompt(agent.systemPrompt) + SENTIMENT_SUFFIX_INSTRUCTION;

            // 构建其他 agent 的回复上下文（如果有的话）
            const otherAgentsContext = previousAgentReplies.length > 0
              ? previousAgentReplies.map(r => `【${r.agentName}】\n${r.content}`).join('\n\n')
              : '';

            // 构建 user prompt
            const userPrompt = buildUserQuestionReplyUserPrompt({
              topic: session!.topicTitle,
              history_context: historyContext || '暂无之前的讨论摘要',
              user_message: userMessage,
              other_agents_context: otherAgentsContext || undefined,
            });

            console.log(`[API /api/user/message/stream] Agent ${agent.name} starting...`);

            try {
              // 使用 agentExecutor 执行带工具调用的 agent（原生 OpenAI SDK）
              const { text: fullText, toolCalls } = await executeAgentStream(
                { systemPrompt, userPrompt, maxSteps: 5 },
                agent.id,
                agent.name,
                encoder,
                safeEnqueue,
              );

              if (isCancelled) break;

              // 解析情绪数据
              const { cleanContent: sentimentClean, sentiments } = parseSentimentBlock(fullText);
              // 兜底：剥离可能残留的 DSML 标记
              const dsmlIdx = sentimentClean.search(/<[|｜\s]*(?:DSML[|｜\s]*)?(?:function_calls|tool_call|invoke)/i);
              const cleanContent = dsmlIdx >= 0 ? sentimentClean.substring(0, dsmlIdx).trim() : sentimentClean;

              // 提取 @mention 的目标 agent
              let targetAgentId: string | undefined;
              let targetAgentName: string | undefined;
              if (cleanContent) {
                const mentionMatch = cleanContent.match(/@([^，。\s\n@]+)/);
                if (mentionMatch && mentionMatch[1]) {
                  const mentioned = session!.agents.find(a => a.name === mentionMatch[1].trim());
                  if (mentioned) {
                    targetAgentId = mentioned.id;
                    targetAgentName = mentioned.name;
                  }
                }
              }

              // 发送 agent 完成事件
              if (!safeEnqueue(encoder.encode(
                `data: ${JSON.stringify({
                  type: 'agent_done',
                  agentId: agent.id,
                  agentName: agent.name,
                  content: cleanContent,
                  targetAgentId,
                  targetAgentName,
                  sentiments: sentiments.length > 0 ? sentiments : undefined,
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                })}\n\n`
              ))) break;

              // 记录此 agent 的回复，供后续 agent 参考
              previousAgentReplies.push({
                agentName: agent.name,
                content: cleanContent,
              });

            } catch (agentError) {
              console.error(`[API /api/user/message/stream] Agent ${agent.name} error:`, agentError);
              
              // 发送单个 agent 的错误，不中断其他 agent
              if (!safeEnqueue(encoder.encode(
                `data: ${JSON.stringify({
                  type: 'agent_done',
                  agentId: agent.id,
                  agentName: agent.name,
                  content: `抱歉，${agent.name}回复时遇到了问题，请稍后再试。`,
                  error: agentError instanceof Error ? agentError.message : 'Unknown error',
                })}\n\n`
              ))) break;
            }
          }

          // 发送全部完成事件
          if (!isCancelled) {
            safeEnqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'all_done' })}\n\n`
            ));
          }

          controller.close();
        } catch (error) {
          if (isCancelled) return;
          console.error('[API /api/user/message/stream] Stream error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to process user message';
          try {
            safeEnqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`
            ));
            controller.close();
          } catch { /* ignore */ }
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
    console.error('[API /api/user/message/stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to process user message' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
