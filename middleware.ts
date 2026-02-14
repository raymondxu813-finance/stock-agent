// /middleware.ts

/**
 * Next.js Middleware - API 路由鉴权守卫
 *
 * 拦截所有 /api/* 请求，校验 JWT Token。
 * 白名单路由（登录、注册、健康检查）不需要认证。
 *
 * 通过在请求头中注入 x-user-id / x-user-name / x-user-role，
 * 让后续 API route 无需重复解析 Token 即可获取用户信息。
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/** 不需要认证的路由白名单 */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/health',
];

/** 获取 JWT 密钥（与 lib/auth/jwt.ts 保持一致） */
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Middleware] 生产环境必须配置 JWT_SECRET 环境变量');
    }
    console.warn('[Middleware] JWT_SECRET 未设置，使用开发密钥。请勿在生产环境中使用！');
    return new TextEncoder().encode('dev-jwt-secret-do-not-use-in-production-12345');
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 只拦截 /api/* 路由
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 为每个 API 请求生成唯一请求 ID（用于链路追踪）
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 白名单路由放行（但仍注入 requestId）
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 提取 Bearer Token
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: '未登录，请先登录' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return NextResponse.json(
      { error: '未登录，请先登录' },
      { status: 401 }
    );
  }

  // 验证 JWT
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);

    if (!payload.userId || !payload.username || payload.type !== 'access') {
      return NextResponse.json(
        { error: 'Token 无效' },
        { status: 401 }
      );
    }

    // 注入用户信息和请求 ID 到请求头，供后续 API route 使用
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId as string);
    requestHeaders.set('x-user-name', payload.username as string);
    requestHeaders.set('x-user-role', (payload.role as string) || 'user');
    requestHeaders.set('x-request-id', requestId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Token 已过期或无效，请重新登录' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
