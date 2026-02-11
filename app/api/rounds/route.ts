import { NextRequest, NextResponse } from 'next/server';
import { runRound, type Session } from '@/lib/discussionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, sessionData } = body;

    console.log('[API /api/rounds] Received request with sessionId:', sessionId);

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // 导入函数用于调试
    const { getAllSessions } = await import('@/lib/discussionService');
    const allSessions = getAllSessions();
    console.log('[API /api/rounds] Available sessions before runRound:', Array.from(allSessions.keys()));

    // 如果提供了 sessionData，使用它恢复 session
    const session = await runRound(sessionId, sessionData as Session | undefined);

    console.log('[API /api/rounds] Round completed successfully, session rounds:', session.rounds.length);

    return NextResponse.json({ session });
  } catch (error) {
    console.error('[API /api/rounds] Error running round:', error);
    const { getAllSessions } = await import('@/lib/discussionService');
    const allSessions = getAllSessions();
    console.error('[API /api/rounds] Available sessions on error:', Array.from(allSessions.keys()));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run round' },
      { status: 500 }
    );
  }
}
