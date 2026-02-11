import { NextRequest } from 'next/server';
import { getSession, restoreSession } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildAgentTargetedReplyUserPrompt } from '@/prompts/builder';
import { llmClient } from '@/lib/llmClient';
import { parseSentimentBlock } from '@/lib/utils';
import { SENTIMENT_SUFFIX_INSTRUCTION } from '@/prompts/agents';

/**
 * 流式获取单个 Agent 的针对性回复（Server-Sent Events）
 * 
 * 用于第一轮的针对性回复和第二轮+的多次针对性回复
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      agentId,
      roundIndex,
      replyRound,         // 第几次回复（1, 2, 3）
      allSpeeches,        // 本轮所有agent的发言/回复（用于构建上下文）
      mySpeech,           // 自己的发言
      previousReplies,    // 前几次回复的内容（供第2/3次回复参考）
      previousRoundComments, // 上一轮的发言数据（第二轮+使用）
      sessionData,
    } = body;

    if (!sessionId || !agentId || !roundIndex || !replyRound) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, agentId, roundIndex, replyRound' }),
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

    // 构建 system prompt（针对性回复专用 + 情绪输出指令）
    const systemPrompt = `你是${agent.name}。你正在参与一场多人讨论的针对性回复环节。

角色设定：${agent.bio || ''}

规则：
1. 找出跟你有明确分歧或高度共识的Agent，用 @Agent名称 提及对方
2. 态度鲜明、语言犀利：有分歧就直接反驳，有共识就简短赞同并补充
3. 不要重复阐述整体观点，聚焦在对具体Agent的回应上
4. 150字以内，抓重点，说人话，像跟同行聊天一样自然
5. 用中文输出，使用"我"的第一人称` + SENTIMENT_SUFFIX_INSTRUCTION;

    // 构建上下文文本
    let allSpeechesText = '';
    let mySpeechText = mySpeech || '';

    if (roundIndex === 1) {
      // 第一轮：基于本轮观点阐述
      if (allSpeeches && Array.isArray(allSpeeches)) {
        allSpeechesText = allSpeeches
          .map((s: any) => `【${s.agentName || 'Unknown'}】\n${s.content || s.speech || ''}`)
          .join('\n\n');
      }
    } else {
      // 第二轮+：基于上一轮回复或传入的allSpeeches
      if (allSpeeches && Array.isArray(allSpeeches)) {
        allSpeechesText = allSpeeches
          .map((s: any) => `【${s.agentName || 'Unknown'}】\n${s.content || s.speech || ''}`)
          .join('\n\n');
      }
    }

    // 构建前几次回复的参考文本
    let previousRepliesText = '';
    if (previousReplies && Array.isArray(previousReplies) && previousReplies.length > 0) {
      previousRepliesText = previousReplies
        .map((r: any) => `【${r.agentName || 'Unknown'}（第${r.replyRound || '?'}次回复）】\n${r.content || ''}`)
        .join('\n\n');
    }

    // 构建上一轮数据（第二轮+）
    let previousRoundSpeechesText = '';
    let myPreviousSpeechText = '';
    if (roundIndex > 1 && previousRoundComments && Array.isArray(previousRoundComments)) {
      previousRoundSpeechesText = previousRoundComments
        .map((c: any) => `【${c.agentName || 'Unknown'}】\n${c.content || ''}`)
        .join('\n\n');
      
      const myPrev = previousRoundComments.find((c: any) => c.agentId === agentId);
      myPreviousSpeechText = myPrev?.content || '（上一轮未发言）';
    }

    // 使用 builder 构建 user prompt
    const userPrompt = buildAgentTargetedReplyUserPrompt({
      topic: session.topicTitle,
      round_index: roundIndex,
      reply_round: replyRound,
      all_agents_speeches: allSpeechesText,
      my_speech: mySpeechText,
      previous_replies: previousRepliesText,
      previous_round_speeches: previousRoundSpeechesText || undefined,
      my_previous_speech: myPreviousSpeechText || undefined,
    });

    console.log(`[API /api/agents/reply/stream] Agent ${agent.name}, Round ${roundIndex}, Reply ${replyRound}`);
    console.log(`[API /api/agents/reply/stream] User prompt preview (first 300 chars):`, userPrompt.substring(0, 300));

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

        // 安全的enqueue函数
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

          let fullContent = '';

          // 调用流式生成
          await llmClient.generateStream(systemPrompt, userPrompt, agentId, (chunk: string) => {
            if (isCancelled) return;
            fullContent += chunk;
            if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`))) {
              return;
            }
          });

          if (isCancelled) return;

          // 尝试从回复内容中提取@的agent名称
          let targetAgentId: string | undefined;
          let targetAgentName: string | undefined;
          if (fullContent) {
            const mentionMatch = fullContent.match(/@([^，。\s\n@]+)/);
            if (mentionMatch && mentionMatch[1]) {
              const mentionedAgentName = mentionMatch[1].trim();
              const mentionedAgent = session!.agents.find(a => a.name === mentionedAgentName);
              if (mentionedAgent) {
                targetAgentId = mentionedAgent.id;
                targetAgentName = mentionedAgent.name;
              }
            }
          }

          // 从回复内容中解析 [SENTIMENT] 块，分离正文和情绪数据
          const { cleanContent, sentiments } = parseSentimentBlock(fullContent);

          // 发送完成信息
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            agentId,
            agentName: agent.name,
            reply: cleanContent,
            replyRound,
            targetAgentId,
            targetAgentName,
            sentiments: sentiments.length > 0 ? sentiments : undefined,
            systemPrompt,
            userPrompt,
          })}\n\n`))) {
            return;
          }

          controller.close();
        } catch (error) {
          if (isCancelled) return;

          console.error('[API /api/agents/reply/stream] Error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate reply';
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
    console.error('[API /api/agents/reply/stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate reply' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
