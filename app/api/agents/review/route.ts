import { NextRequest, NextResponse } from 'next/server';
import { getSession, getSessionAsync, restoreSession, buildHistoryText } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildAgentReviewUserPrompt } from '@/prompts/builder';
import { llmClient } from '@/lib/llmClient';
import type { AgentId } from '@/prompts/roundAgentPrompts';

/**
 * 获取单个 Agent 的互评
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, agentId, roundIndex, otherAgentsSpeeches, sessionData } = body;

    if (!sessionId || !agentId || !roundIndex || !otherAgentsSpeeches) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, agentId, roundIndex, otherAgentsSpeeches' },
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

    // 构建历史记录文本
    const historyText = buildHistoryText(session.rounds);

    // 生成互评
    const systemPrompt = agent.systemPrompt;
    const userPrompt = buildAgentReviewUserPrompt(agentId as AgentId, {
      topic: session.topicTitle,
      description: session.topicDescription,
      history: historyText,
      round_index: roundIndex,
      other_agents_speeches: otherAgentsSpeeches,
    });

    console.log(`[API /api/agents/review] Generating review for agent: ${agentId} (${agent.name})`);
    const review = await llmClient.generate(systemPrompt, userPrompt, agentId);
    console.log(`[API /api/agents/review] Review generated successfully for agent: ${agentId}`);

    return NextResponse.json({
      agentId,
      agentName: agent.name,
      review,
    });
  } catch (error) {
    console.error('[API /api/agents/review] Error:', error);
    console.error('[API /api/agents/review] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate review' },
      { status: 500 }
    );
  }
}
