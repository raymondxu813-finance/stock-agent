import { NextRequest, NextResponse } from 'next/server';
import { summarizeSession } from '@/lib/discussionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    const summary = await summarizeSession(sessionId);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error summarizing session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to summarize session' },
      { status: 500 }
    );
  }
}
