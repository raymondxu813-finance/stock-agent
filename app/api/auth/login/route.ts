import { NextRequest, NextResponse } from 'next/server';
import { authProvider, signTokenPair } from '@/lib/auth';

/**
 * POST /api/auth/login
 * 用户登录，返回 JWT access_token + refresh_token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '请输入用户名和密码' },
        { status: 400 }
      );
    }

    // 通过 AuthProvider 验证身份
    const user = await authProvider.authenticate({ username, password });

    // 签发 JWT Token 对
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
    const message = error instanceof Error ? error.message : '登录失败';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
