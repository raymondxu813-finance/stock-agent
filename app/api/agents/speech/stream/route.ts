import { NextRequest } from 'next/server';
import { getSession, restoreSession, buildHistoryText } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildAgentSpeechUserPrompt, buildAgentSubsequentRoundSpeechUserPrompt } from '@/prompts/builder';
import { executeAgentStream } from '@/lib/agentExecutor';
import type { AgentId } from '@/prompts/roundAgentPrompts';
import { parseSentimentBlock } from '@/lib/utils';
import { SENTIMENT_SUFFIX_INSTRUCTION } from '@/prompts/agents';

const TOOL_USAGE_INSTRUCTION = '\n\n你可以在需要数据支持时调用工具：查询实时股价、获取最新资讯、分析K线数据。主动用数据说话。';

/**
 * 流式获取单个 Agent 的发言（Server-Sent Events）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, agentId, roundIndex, sessionData, previousRoundComments } = body;

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

    // 根据轮次选择不同的prompt构建方式
    let systemPrompt: string;
    let userPrompt: string;
    let targetAgentId: string | undefined;
    let targetAgentName: string | undefined;

    if (roundIndex > 1 && previousRoundComments && Array.isArray(previousRoundComments) && previousRoundComments.length > 0) {
      // 第二轮及后续轮次：使用前端传来的上一轮原始发言数据
      console.log(`[API /api/agents/speech/stream] Round ${roundIndex}: Using previousRoundComments from frontend, count: ${previousRoundComments.length}`);
      
      // 构建上一轮所有agent的发言内容
      const previousRoundSpeeches = previousRoundComments
        .map((c: any) => `【${c.agentName || 'Unknown'}】\n${c.content || ''}`)
        .join('\n\n');
      
      // 获取当前agent在上一轮的发言
      const myPreviousSpeech = previousRoundComments.find(
        (c: any) => c.agentId === agentId
      );
      
      const myPreviousContent = myPreviousSpeech?.content || '（上一轮未发言）';
      
      // 使用第二轮及后续轮次的专用prompt模板
      userPrompt = buildAgentSubsequentRoundSpeechUserPrompt(agentId as AgentId, {
        topic: session.topicTitle,
        description: '', // 第二轮不需要话题背景，避免干扰
        history: '', // 第二轮不需要历史记录，避免干扰
        round_index: roundIndex,
        previous_round_index: roundIndex - 1,
        previous_round_speeches: previousRoundSpeeches,
        my_previous_speech: myPreviousContent,
      });
      
      // 完全替换system prompt，要求针对分歧agent回应
      systemPrompt = `你是${agent.name}。你正在参与一场多人讨论的后续轮次。

规则：
1. 只回应跟你有明确、实质性分歧的Agent，观点相近的不用回应
2. 用 @Agent名称 提及对方，说清楚分歧在哪，亮出你的看法
3. 不要笼统总结话题，只聚焦具体分歧
4. 200字以内，抓重点，说人话，像跟同行聊天一样自然` + SENTIMENT_SUFFIX_INSTRUCTION + TOOL_USAGE_INSTRUCTION;
      
      console.log(`[API /api/agents/speech/stream] Using SUBSEQUENT round prompt for ${agent.name} in round ${roundIndex}`);
      console.log(`[API /api/agents/speech/stream] User prompt preview (first 500 chars):`, userPrompt.substring(0, 500));
      console.log(`[API /api/agents/speech/stream] System prompt preview (first 300 chars):`, systemPrompt.substring(0, 300));
    } else {
      // 第一轮：使用原来的prompt模板 + 情绪输出指令 + 工具使用提示
      systemPrompt = agent.systemPrompt + SENTIMENT_SUFFIX_INSTRUCTION + TOOL_USAGE_INSTRUCTION;
      userPrompt = buildAgentSpeechUserPrompt(agentId as AgentId, {
        topic: session.topicTitle,
        description: session.topicDescription,
        history: historyText,
        round_index: roundIndex,
        previous_round_context: '', // 第一轮没有上一轮内容
        debate_instruction: '', // 第一轮没有辩论指令
      });
    }

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
          
          // 确保 systemPrompt 和 userPrompt 都有值
          if (!systemPrompt || !userPrompt) {
            throw new Error(`Missing prompt: systemPrompt=${!!systemPrompt}, userPrompt=${!!userPrompt}`);
          }
          
          // 使用支持工具调用的 agent 执行器
          const { text: fullContent, toolCalls } = await executeAgentStream(
            { systemPrompt, userPrompt, maxSteps: 3, temperature: 0.7 },
            agentId,
            agent.name,
            encoder,
            safeEnqueue,
          );
          
          // 如果请求已取消，不发送完成信息
          if (isCancelled) return;
          
          // 如果是第二轮及后续轮次，尝试从发言内容中提取@的agent名称
          if (roundIndex > 1 && fullContent) {
            // 查找 @Agent名称 的模式
            const mentionMatch = fullContent.match(/@([^，。\s\n]+)/);
            if (mentionMatch && mentionMatch[1]) {
              const mentionedAgentName = mentionMatch[1].trim();
              // 查找对应的agent
              const mentionedAgent = session.agents.find(a => a.name === mentionedAgentName);
              if (mentionedAgent) {
                targetAgentId = mentionedAgent.id;
                targetAgentName = mentionedAgent.name;
              }
            }
          }
          
          // 从发言内容中解析 [SENTIMENT] 块，分离正文和情绪数据
          const { cleanContent, sentiments } = parseSentimentBlock(fullContent);
          
          // 发送完成信息（包含prompts和工具调用记录用于持久化）
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'done', 
            agentId, 
            agentName: agent.name, 
            speech: cleanContent,
            targetAgentId,
            targetAgentName,
            sentiments: sentiments.length > 0 ? sentiments : undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            systemPrompt,
            userPrompt
          })}\n\n`))) {
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
