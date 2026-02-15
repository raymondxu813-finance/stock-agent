// /middleware.ts

/**
 * Next.js Middleware - API 路由鉴权守卫 + CORS
 *
 * 功能：
 * 1. CORS 处理 — 仅在配置 CORS_ALLOWED_ORIGINS 时激活（本地开发同源无需 CORS）
 * 2. JWT 认证 — 校验 Bearer Token，注入用户信息到请求头
 * 3. 请求追踪 — 为每个请求生成唯一 x-request-id
 *
 * 白名单路由（登录、注册、健康检查）不需要 JWT 认证。
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

/**
 * CORS 配置
 *
 * 本地开发：不设 CORS_ALLOWED_ORIGINS -> CORS 逻辑完全不激活（同源不需要）
 * 生产环境：设为 Vercel 前端域名（如 "https://app.example.com"），多个用逗号分隔
 */
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** 检查 origin 是否在允许列表中 */
function isOriginAllowed(origin: string | null): boolean {
  if (!ALLOWED_ORIGINS.length) return false; // 未配置 CORS，不激活
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/** 生成 CORS 响应头 */
function getCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 预检缓存 24 小时
  };
}

/** 给 NextResponse 附加 CORS 头（如需要） */
function withCors(response: NextResponse, origin: string | null): NextResponse {
  if (origin && isOriginAllowed(origin)) {
    const corsHeaders = getCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

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
  const origin = request.headers.get('origin');

  // 只拦截 /api/* 路由
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Vercel 环境下，API 请求会被 beforeFiles rewrite 代理到 ECS ALB，
  // 鉴权由 ECS 端 middleware 处理，这里直接放行即可。
  if (process.env.VERCEL && process.env.API_BACKEND_URL) {
    return NextResponse.next();
  }

  // === CORS 预检请求（OPTIONS）===
  // 仅在配置了 CORS_ALLOWED_ORIGINS 时处理；本地开发同源不会发送 OPTIONS
  if (request.method === 'OPTIONS' && isOriginAllowed(origin)) {
    return withCors(
      new NextResponse(null, { status: 204 }),
      origin
    );
  }

  // 为每个 API 请求生成唯一请求 ID（用于链路追踪）
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 白名单路由放行（但仍注入 requestId + CORS 头）
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    return withCors(response, origin);
  }

  // 提取 Bearer Token
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return withCors(
      NextResponse.json({ error: '未登录，请先登录' }, { status: 401 }),
      origin
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return withCors(
      NextResponse.json({ error: '未登录，请先登录' }, { status: 401 }),
      origin
    );
  }

  // 验证 JWT
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);

    if (!payload.userId || !payload.username || payload.type !== 'access') {
      return withCors(
        NextResponse.json({ error: 'Token 无效' }, { status: 401 }),
        origin
      );
    }

    // 注入用户信息和请求 ID 到请求头，供后续 API route 使用
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId as string);
    requestHeaders.set('x-user-name', payload.username as string);
    requestHeaders.set('x-user-role', (payload.role as string) || 'user');
    requestHeaders.set('x-request-id', requestId);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    return withCors(response, origin);
  } catch {
    return withCors(
      NextResponse.json({ error: 'Token 已过期或无效，请重新登录' }, { status: 401 }),
      origin
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
