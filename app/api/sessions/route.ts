import { NextRequest, NextResponse } from 'next/server';
import { startSession } from '@/lib/discussionService';
import type { AgentId } from '@/prompts/roundAgentPrompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topicTitle, topicDescription, userGoal, agentIds } = body;

    if (!topicTitle || !userGoal || !agentIds || !Array.isArray(agentIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: topicTitle, userGoal, agentIds' },
        { status: 400 }
      );
    }

    const session = await startSession({
      topicTitle,
      topicDescription: topicDescription || '',
      userGoal,
      agentIds: agentIds as AgentId[],
    });

    console.log('[API /api/sessions] Session created:', session.id);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    const { getSession } = await import('@/lib/discussionService');
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get session' },
      { status: 500 }
    );
  }
}
