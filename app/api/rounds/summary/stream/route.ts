import { NextRequest } from 'next/server';
import { getSession, restoreSession, buildAgentsBriefList } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildRoundSummaryUserPrompt } from '@/prompts/builder';
import { roundSummarySystemPromptTemplate } from '@/prompts/roundSummaryPrompts';
import { llmClient } from '@/lib/llmClient';
import { getCurrentStreamingSection, convertModeratorTextToAnalysis, type ModeratorSection } from '@/lib/utils';
import { roundSummarySchema, validateRequest } from '@/lib/validation';
import { createRequestLogger } from '@/lib/logger';

/**
 * 流式生成本轮讨论的总结（Server-Sent Events）
 * 
 * 改进：
 * - 使用结构化文本格式（带【段落】标记），不再使用 JSON
 * - 流式输出时发送 section_change 事件，前端可逐段显示
 * - 完成后解析文本转换为 ModeratorAnalysis 结构
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Zod 结构化校验
    const validation = validateRequest(roundSummarySchema, body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, roundIndex, agentsSpeeches, agentsReviews, agentsReplies, sessionData, userQuestion } = validation.data;

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

    // 归属权校验：只能操作自己的会话
    const currentUserId = request.headers.get('x-user-id');
    if (session.userId && currentUserId && session.userId !== currentUserId) {
      return new Response(
        JSON.stringify({ error: '无权访问该会话' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 构造发言文本
    const truncateText = (text: string | undefined | null, maxLength: number = 2000): string => {
      const textStr = String(text || '');
      if (textStr.length <= maxLength) return textStr;
      return textStr.substring(0, maxLength) + '\n\n[内容已截断]';
    };

    // 处理观点阐述（本轮Agent发言）
    const currentRoundAgentsSpeeches = agentsSpeeches && Array.isArray(agentsSpeeches) && agentsSpeeches.length > 0
      ? agentsSpeeches
          .map((s: any) => {
            const speechText = s.speech || s.content || '';
            const truncatedSpeech = truncateText(speechText, 500);
            return `【${s.agentName}（${s.agentId}）的观点阐述】\n${truncatedSpeech}`;
          })
          .join('\n\n')
      : '';

    // 处理互评（旧逻辑兼容，新架构不再使用）
    const currentRoundAgentsReviews = agentsReviews && Array.isArray(agentsReviews) && agentsReviews.length > 0
      ? agentsReviews
          .map((r: any) => {
            const reviewText = r.review || r.content || '';
            const truncatedReview = truncateText(reviewText, 400);
            return `【${r.agentName}（${r.agentId}）的互评】\n${truncatedReview}`;
          })
          .join('\n\n')
      : '';

    // 处理针对性回复（旧逻辑兼容）
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

    // 用户提问上下文
    const userQuestionContext = userQuestion
      ? `【用户提问】\n${userQuestion}\n\n---\n\n`
      : '';

    // 合并所有讨论内容
    const allDiscussionContent = [
      userQuestionContext,
      currentRoundAgentsSpeeches,
      currentRoundAgentsReviews,
      currentRoundAgentsRepliesText,
    ].filter(Boolean).join('\n\n---\n\n');

    const finalAgentsSpeeches = allDiscussionContent || '本轮暂无发言内容。';
    const finalAgentsReviews = currentRoundAgentsRepliesText || currentRoundAgentsReviews || '';

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
    
    // 保存主持人prompts到session
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
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', roundIndex })}\n\n`))) {
            return;
          }
          
          let fullContent = '';
          let currentSection: ModeratorSection | null = null;
          
          // 使用纯文本流式输出（不再使用 JSON 模式）
          await llmClient.generateStream(systemPrompt, userPrompt, undefined, (chunk: string) => {
            if (isCancelled) return;
            fullContent += chunk;
            
            // 检测段落切换
            const newSection = getCurrentStreamingSection(fullContent);
            if (newSection && newSection !== currentSection) {
              currentSection = newSection;
              // 发送段落切换事件
              safeEnqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'section_change', section: currentSection })}\n\n`
              ));
            }
            
            // 发送内容块（附带当前段落信息）
            safeEnqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'chunk', content: chunk, section: currentSection })}\n\n`
            ));
          });
          
          if (isCancelled) return;
          
          // 解析结构化文本为 ModeratorAnalysis
          const reqLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown', { sessionId, roundIndex });
          reqLog.info({ contentLength: fullContent.length }, '[summary/stream] Summary text received');
          const totalAgents = session.agents.length;
          const roundSummary = convertModeratorTextToAnalysis(fullContent, roundIndex, totalAgents);
          reqLog.info({ consensusLevel: roundSummary.consensusLevel }, '[summary/stream] Summary parsed');
          
          // 保存总结到 session（转换为兼容格式，包含 v2 新字段）
          // agentsSummary: 从 topicComparisons 构建每个 agent 的观点摘要（如有），否则 fallback 到 newPoints
          const agentsSummary = (() => {
            if (roundSummary.topicComparisons && roundSummary.topicComparisons.length > 0) {
              // 按 agent 聚合各维度的观点
              const agentMap = new Map<string, string[]>();
              for (const tc of roundSummary.topicComparisons) {
                for (const ap of tc.agentPositions) {
                  if (!agentMap.has(ap.agentName)) agentMap.set(ap.agentName, []);
                  agentMap.get(ap.agentName)!.push(`${tc.topic}: ${ap.position}`);
                }
              }
              return Array.from(agentMap.entries()).map(([name, points]) => {
                const agent = session.agents.find((a: any) => a.name === name);
                return {
                  agentId: agent?.id || name,
                  agentName: name,
                  keyPoints: points,
                };
              });
            }
            // Fallback: newPoints（维度名称列表）
            return roundSummary.newPoints.map((point: string, i: number) => ({
              agentId: session.agents[i]?.id || `agent_${i}`,
              agentName: session.agents[i]?.name || `Agent ${i}`,
              keyPoints: [point],
            }));
          })();

          // conflicts: 保留 v2 sides 的完整观点文本
          const conflicts = roundSummary.disagreements.map((d: any) => {
            const positions: Array<{ agentName: string; position: string }> = [];
            if (d.sides && d.sides.length > 0) {
              for (const side of d.sides) {
                for (const a of (side.agents || [])) {
                  positions.push({ agentName: a.name, position: side.position });
                }
              }
            } else {
              for (const a of (d.supportAgents || [])) {
                positions.push({ agentName: a.name, position: '支持' });
              }
              for (const a of (d.opposeAgents || [])) {
                positions.push({ agentName: a.name, position: '反对' });
              }
            }
            return { issue: d.topic, positions };
          });

          session.rounds.push({
            roundIndex,
            topicTitle: session.topicTitle,
            consensusLevel: roundSummary.consensusLevel,
            overallSummary: roundSummary.summary,
            agentsSummary,
            topicComparisons: roundSummary.topicComparisons,
            consensus: roundSummary.consensus.map((c: any) => ({
              point: c.content,
              supportingAgents: c.agents,
              supportCount: c.agents.length,
              totalAgents,
            })),
            conflicts,
            highlights: roundSummary.highlights,
            insights: [],
            openQuestions: [],
            nextRoundSuggestions: [],
            sentimentSummary: roundSummary.sentimentSummary,
          });
          
          // 发送完成信息（包含解析后的结构化数据）
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
          if (isCancelled) return;
          
          const errLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown', { sessionId, roundIndex });
          errLog.error({ err: error }, '[summary/stream] Stream error');
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
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
    const errLog = createRequestLogger(request.headers.get('x-request-id') || 'unknown');
    errLog.error({ err: error }, '[summary/stream] Request error');
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate summary' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
