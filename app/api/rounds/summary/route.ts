import { NextRequest, NextResponse } from 'next/server';
import { getSession, getSessionAsync, restoreSession, buildAgentsBriefList, parseRoundSummary, updateAndPersistSession } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildRoundSummaryUserPrompt } from '@/prompts/builder';
import { roundSummarySystemPromptTemplate } from '@/prompts/roundSummaryPrompts';
import { llmClient } from '@/lib/llmClient';

/**
 * 生成本轮讨论的总结
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, roundIndex, agentsSpeeches, agentsReviews, sessionData } = body;

    if (!sessionId || !roundIndex || !agentsSpeeches || agentsReviews === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, roundIndex, agentsSpeeches, agentsReviews' },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 构造发言和互评文本（进一步缩短以提升速度）
    const truncateText = (text: string, maxLength: number = 2000): string => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '\n\n[内容已截断]';
    };

    const currentRoundAgentsSpeeches = agentsSpeeches
      .map((s: any) => {
        const truncatedSpeech = truncateText(s.speech, 500); // 从800减少到500
        return `【${s.agentName}（${s.agentId}）】\n${truncatedSpeech}`;
      })
      .join('\n\n');

    // 处理互评：如果为空数组（第一轮），则使用空字符串
    const currentRoundAgentsReviews = agentsReviews && agentsReviews.length > 0
      ? agentsReviews
          .map((r: any) => {
            const truncatedReview = truncateText(r.review, 400);
            return `【${r.agentName}（${r.agentId}）的互评】\n${truncatedReview}`;
          })
          .join('\n\n')
      : '本轮暂无互评内容。'; // 第一轮没有互评

    // 生成总结
    const agentsBriefList = buildAgentsBriefList(session.agents);
    const systemPrompt = roundSummarySystemPromptTemplate;
    const userPrompt = buildRoundSummaryUserPrompt({
      round_index: roundIndex,
      topic_title: session.topicTitle,
      topic_description: session.topicDescription,
      user_goal: session.userGoal,
      agents_brief_list: agentsBriefList,
      current_round_agents_speeches: currentRoundAgentsSpeeches,
      current_round_agents_reviews: currentRoundAgentsReviews,
    });

    console.log('[API /api/rounds/summary] Generating round summary...');
    const summaryResponse = await llmClient.generate(systemPrompt, userPrompt);
    console.log('[API /api/rounds/summary] Summary response received, length:', summaryResponse.length);
    const roundSummary = parseRoundSummary(summaryResponse);
    console.log('[API /api/rounds/summary] Summary parsed successfully');

    // 保存总结到 session
    session.rounds.push(roundSummary);

    // 立即持久化到内存 Map + DB/Redis（修复：之前未持久化导致多端丢数据）
    updateAndPersistSession(session);

    return NextResponse.json({
      roundSummary,
      session,
    });
  } catch (error) {
    console.error('[API /api/rounds/summary] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
