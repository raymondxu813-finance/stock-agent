import { NextRequest, NextResponse } from 'next/server';
import { authProvider, signTokenPair, verifyToken } from '@/lib/auth';

/**
 * POST /api/auth/refresh
 * 使用 refresh_token 获取新的 token 对
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: '缺少 refreshToken' },
        { status: 400 }
      );
    }

    // 验证 refresh token
    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'refresh token 无效或已过期' },
        { status: 401 }
      );
    }

    // 确认用户仍然存在
    const user = await authProvider.getUserById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 401 }
      );
    }

    // 签发新的 token 对
    const tokens = await signTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      user,
      ...tokens,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token 刷新失败';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
