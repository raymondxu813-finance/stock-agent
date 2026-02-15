import { NextRequest, NextResponse } from 'next/server';
import { getSession, getSessionAsync, restoreSession } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildAgentDisagreementAnalysisUserPrompt } from '@/prompts/builder';
import { moderatorLLMClient } from '@/lib/moderatorLLMClient';

/**
 * 获取单个 Agent 的分歧分析
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, agentId, agentName, mySpeech, allAgentsSpeeches, topic, sessionData } = body;

    if (!sessionId || !agentId || !mySpeech || !allAgentsSpeeches || !topic) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, agentId, mySpeech, allAgentsSpeeches, topic' },
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

    const agent = session.agents.find(a => a.id === agentId);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // 构建分歧分析 prompt
    const systemPrompt = `你是${agentName}，请根据本轮所有Agent的发言，找出与你观点有分歧的其他Agent，并明确@对方，总结分歧点。控制在100字以内。`;
    const userPrompt = buildAgentDisagreementAnalysisUserPrompt({
      topic: topic,
      all_agents_speeches: allAgentsSpeeches,
      my_speech: mySpeech,
    });

    // 使用主持人专用的 LLM Client 生成分歧分析
    const disagreementAnalysis = await moderatorLLMClient.generate(systemPrompt, userPrompt, agentId);

    return NextResponse.json({
      agentId,
      agentName: agentName || agent.name,
      disagreementAnalysis,
    });
  } catch (error) {
    console.error('[API /api/agents/disagreement] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate disagreement analysis' },
      { status: 500 }
    );
  }
}
