import { NextRequest } from 'next/server';
import { getSession, restoreSession, buildAgentsBriefList, parseRoundSummary } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildRoundSummaryUserPrompt } from '@/prompts/builder';
import { roundSummarySystemPromptTemplate } from '@/prompts/roundSummaryPrompts';
import { llmClient } from '@/lib/llmClient';

/**
 * 流式生成本轮讨论的总结（Server-Sent Events）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, roundIndex, agentsSpeeches, agentsReviews, agentsReplies, sessionData } = body;

    if (!sessionId || !roundIndex) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, roundIndex' }),
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

    // 构造发言和互评文本（进一步缩短以提升速度）
    const truncateText = (text: string | undefined | null, maxLength: number = 2000): string => {
      // 确保 text 是字符串类型
      const textStr = String(text || '');
      if (textStr.length <= maxLength) return textStr;
      return textStr.substring(0, maxLength) + '\n\n[内容已截断]';
    };

    // 处理观点阐述
    const currentRoundAgentsSpeeches = agentsSpeeches && Array.isArray(agentsSpeeches) && agentsSpeeches.length > 0
      ? agentsSpeeches
          .map((s: any) => {
            const speechText = s.speech || s.content || '';
            const truncatedSpeech = truncateText(speechText, 500);
            return `【${s.agentName}（${s.agentId}）的观点阐述】\n${truncatedSpeech}`;
          })
          .join('\n\n')
      : '';

    // 处理互评（旧逻辑兼容）
    const currentRoundAgentsReviews = agentsReviews && Array.isArray(agentsReviews) && agentsReviews.length > 0
      ? agentsReviews
          .map((r: any) => {
            const reviewText = r.review || r.content || '';
            const truncatedReview = truncateText(reviewText, 400);
            return `【${r.agentName}（${r.agentId}）的互评】\n${truncatedReview}`;
          })
          .join('\n\n')
      : '';

    // 处理针对性回复（新逻辑）
    const currentRoundAgentsRepliesText = agentsReplies && Array.isArray(agentsReplies) && agentsReplies.length > 0
      ? agentsReplies
          .map((r: any) => {
            const replyText = r.reply || r.content || '';
            const truncatedReply = truncateText(replyText, 400);
            const replyLabel = r.replyRound ? `第${r.replyRound}次回复` : '针对性回复';
            return `【${r.agentName}（${r.agentId}）的${replyLabel}】\n${truncatedReply}`;
          })
          .join('\n\n')
      : '';

    // 合并所有讨论内容
    const allDiscussionContent = [
      currentRoundAgentsSpeeches,
      currentRoundAgentsReviews,
      currentRoundAgentsRepliesText,
    ].filter(Boolean).join('\n\n---\n\n');

    // 如果完全没有内容，使用默认文本
    const finalAgentsSpeeches = allDiscussionContent || '本轮暂无发言内容。';
    const finalAgentsReviews = currentRoundAgentsRepliesText || currentRoundAgentsReviews || '本轮暂无互评/回复内容。';

    // 生成总结
    const agentsBriefList = buildAgentsBriefList(session.agents);
    const systemPrompt = roundSummarySystemPromptTemplate;
    const userPrompt = buildRoundSummaryUserPrompt({
      round_index: roundIndex,
      topic_title: session.topicTitle,
      topic_description: session.topicDescription,
      user_goal: session.userGoal,
      agents_brief_list: agentsBriefList,
      current_round_agents_speeches: finalAgentsSpeeches,
      current_round_agents_reviews: finalAgentsReviews,
    });
    
    // 保存主持人prompts到session（用于持久化）
    if (!session.moderatorPrompts) {
      session.moderatorPrompts = {};
    }
    session.moderatorPrompts[roundIndex] = {
      systemPrompt,
      userPrompt,
    };

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
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', roundIndex })}\n\n`))) {
            return; // 请求已取消
          }
          
          let fullContent = '';
          
          // 调用流式生成方法
          await llmClient.generateStream(systemPrompt, userPrompt, undefined, (chunk: string) => {
            if (isCancelled) return; // 请求已取消，停止处理
            fullContent += chunk;
            // 发送每个数据块
            if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`))) {
              return; // Controller已关闭，停止处理
            }
          });
          
          // 如果请求已取消，不继续处理
          if (isCancelled) return;
          
          // 解析总结
          console.log('[API /api/rounds/summary/stream] Summary response received, length:', fullContent.length);
          const roundSummary = parseRoundSummary(fullContent);
          console.log('[API /api/rounds/summary/stream] Summary parsed successfully');
          
          // 保存总结到 session
          session.rounds.push(roundSummary);
          
          // 发送完成信息和解析后的总结（包含主持人prompts）
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'done', 
            roundIndex,
            roundSummary,
            session,
            moderatorPrompts: {
              systemPrompt,
              userPrompt,
            }
          })}\n\n`))) {
            return;
          }
          
          controller.close();
        } catch (error) {
          if (isCancelled) return; // 请求已取消，忽略错误
          
          console.error('[API /api/rounds/summary/stream] Error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
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
    console.error('[API /api/rounds/summary/stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate summary' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
