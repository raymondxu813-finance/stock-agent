import { NextRequest, NextResponse } from 'next/server';
import { getSession, getSessionAsync, restoreSession, buildHistoryText } from '@/lib/discussionService';
import type { Session } from '@/lib/discussionService';
import { buildAgentSpeechUserPrompt } from '@/prompts/builder';
import { llmClient } from '@/lib/llmClient';
import type { AgentId } from '@/prompts/roundAgentPrompts';

/**
 * 获取单个 Agent 的发言
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, agentId, roundIndex, sessionData } = body;

    if (!sessionId || !agentId || !roundIndex) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, agentId, roundIndex' },
        { status: 400 }
      );
    }

    // 恢复或获取 session
    // 优先内存 -> 持久化存储 -> sessionData 恢复
    let session = await getSessionAsync(sessionId);
    
    if (!session && sessionData) {
      restoreSession(sessionData as Session);
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

    // 生成发言
    const systemPrompt = agent.systemPrompt;
    const userPrompt = buildAgentSpeechUserPrompt(agentId as AgentId, {
      topic: session.topicTitle,
      description: session.topicDescription,
      history: historyText,
      round_index: roundIndex,
    });

    const speech = await llmClient.generate(systemPrompt, userPrompt, agentId);

    return NextResponse.json({
      agentId,
      agentName: agent.name,
      speech,
    });
  } catch (error) {
    console.error('[API /api/agents/speech] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
