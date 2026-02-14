import { NextRequest, NextResponse } from 'next/server';
import { authProvider, signTokenPair } from '@/lib/auth';

/**
 * POST /api/auth/register
 * 用户注册（仅当 AuthProvider 支持时可用）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查是否支持注册
    if (!authProvider.register) {
      return NextResponse.json(
        { error: '当前认证系统不支持注册' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, password, displayName } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '请输入用户名和密码' },
        { status: 400 }
      );
    }

    if (username.length < 2 || username.length > 30) {
      return NextResponse.json(
        { error: '用户名长度 2-30 个字符' },
        { status: 400 }
      );
    }

    // 通过 AuthProvider 注册
    const user = await authProvider.register({
      username,
      password,
      displayName: displayName || username,
    });

    // 注册成功自动签发 Token
    const tokens = await signTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json(
      { user, ...tokens },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
