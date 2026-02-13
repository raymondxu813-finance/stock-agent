import { NextRequest } from 'next/server';
import { getSession, restoreSession, buildHistoryText } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildAgentSpeechUserPrompt, buildSubsequentRoundSpeechUserPrompt, buildSubsequentRoundWithUserQuestionUserPrompt } from '@/prompts/builder';
import { executeAgentStream } from '@/lib/agentExecutor';
import type { AgentId } from '@/prompts/roundAgentPrompts';
import { parseSentimentBlock } from '@/lib/utils';
import { SENTIMENT_SUFFIX_INSTRUCTION } from '@/prompts/agents';

const TOOL_USAGE_INSTRUCTION = '\n\n你可以在需要数据支持时调用工具：查询实时股价、获取最新资讯、分析K线数据。主动用数据说话。';

/**
 * 流式获取单个 Agent 的发言（Server-Sent Events）
 * 
 * 新架构：每轮每个Agent只发言1次
 * - 第1轮：针对话题阐述观点
 * - 第2轮+ 有用户发言：回应用户提问 + 回应上一轮分歧
 * - 第2轮+ 无用户发言：仅回应上一轮分歧
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, agentId, roundIndex, sessionData, 
      previousRoundComments,
      userQuestion,         // 新增：用户提问内容（可选）
      userMentionedAgentIds // 新增：用户@的Agent ID列表（可选）
    } = body;

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

    // 根据轮次和是否有用户提问，选择不同的prompt构建方式
    let systemPrompt: string;
    let userPrompt: string;
    let targetAgentId: string | undefined;
    let targetAgentName: string | undefined;

    if (roundIndex > 1 && previousRoundComments && Array.isArray(previousRoundComments) && previousRoundComments.length > 0) {
      // ====== 第2轮及后续轮次 ======
      console.log(`[API /api/agents/speech/stream] Round ${roundIndex}: agent=${agent.name}, hasUserQuestion=${!!userQuestion}`);
      
      // 构建上一轮所有agent的发言内容
      const previousRoundSpeeches = previousRoundComments
        .map((c: any) => `【${c.agentName || 'Unknown'}】\n${c.content || ''}`)
        .join('\n\n');
      
      // 获取当前agent在上一轮的发言
      const myPreviousSpeech = previousRoundComments.find(
        (c: any) => c.agentId === agentId
      );
      const myPreviousContent = myPreviousSpeech?.content || '（上一轮未发言）';

      if (userQuestion && userQuestion.trim()) {
        // 有用户发言：回应用户 + 回应分歧
        userPrompt = buildSubsequentRoundWithUserQuestionUserPrompt({
          topic: session.topicTitle,
          round_index: roundIndex,
          user_question: userQuestion.trim(),
          previous_round_speeches: previousRoundSpeeches,
          my_previous_speech: myPreviousContent,
        });

        systemPrompt = `你是${agent.name}。你正在参与一场多人讨论的后续轮次。用户（投资者）向你提出了问题。

规则：
1. 先回应用户的提问（用 @你 提及用户），结合你的专业视角给出回答
2. 再回应跟你有明确分歧的Agent（用 @Agent名称），说清分歧、亮出看法
3. 200字以内，简洁有力
4. 像跟同行聊天一样自然` + SENTIMENT_SUFFIX_INSTRUCTION + TOOL_USAGE_INSTRUCTION;

        console.log(`[API /api/agents/speech/stream] Using SUBSEQUENT_WITH_USER prompt for ${agent.name}`);
      } else {
        // 无用户发言：仅回应分歧
        userPrompt = buildSubsequentRoundSpeechUserPrompt({
          topic: session.topicTitle,
          round_index: roundIndex,
          previous_round_speeches: previousRoundSpeeches,
          my_previous_speech: myPreviousContent,
        });

        systemPrompt = `你是${agent.name}。你正在参与一场多人讨论的后续轮次。

规则：
1. 只回应跟你有明确、实质性分歧的Agent，观点相近的不用回应
2. 用 @Agent名称 提及对方，说清楚分歧在哪，亮出你的看法
3. 不要笼统总结话题，只聚焦具体分歧
4. 200字以内，抓重点，说人话，像跟同行聊天一样自然` + SENTIMENT_SUFFIX_INSTRUCTION + TOOL_USAGE_INSTRUCTION;

        console.log(`[API /api/agents/speech/stream] Using SUBSEQUENT_NO_USER prompt for ${agent.name}`);
      }
    } else {
      // ====== 第1轮：针对话题阐述观点 ======
      systemPrompt = agent.systemPrompt + SENTIMENT_SUFFIX_INSTRUCTION + TOOL_USAGE_INSTRUCTION;
      userPrompt = buildAgentSpeechUserPrompt(agentId as AgentId, {
        topic: session.topicTitle,
        description: session.topicDescription,
        history: historyText,
        round_index: roundIndex,
        previous_round_context: '',
        debate_instruction: '',
      });
    }

    // 创建 ReadableStream 用于流式输出
    let isCancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        request.signal.addEventListener('abort', () => {
          isCancelled = true;
          try {
            controller.close();
          } catch (e) {
            // Controller可能已经关闭
          }
        });
        
        const safeEnqueue = (data: Uint8Array) => {
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
          // 发送初始信息
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', agentId, agentName: agent.name })}\n\n`))) {
            return;
          }
          
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
          
          if (isCancelled) return;
          
          // 提取@的agent名称
          if (roundIndex > 1 && fullContent) {
            // 检查是否@了用户（@你）
            if (fullContent.includes('@你')) {
              targetAgentName = '你';
            } else {
              // 查找 @Agent名称
              const mentionMatch = fullContent.match(/@([^，。\s\n]+)/);
              if (mentionMatch && mentionMatch[1]) {
                const mentionedAgentName = mentionMatch[1].trim();
                const mentionedAgent = session.agents.find(a => a.name === mentionedAgentName);
                if (mentionedAgent) {
                  targetAgentId = mentionedAgent.id;
                  targetAgentName = mentionedAgent.name;
                }
              }
            }
          }
          
          // 从发言内容中解析 [SENTIMENT] 块
          const { cleanContent, sentiments } = parseSentimentBlock(fullContent);
          
          // 发送完成信息
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
          if (isCancelled) return;
          
          console.error('[API /api/agents/speech/stream] Error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
          try {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`));
            controller.close();
          } catch (e) {
            // Controller可能已关闭
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
