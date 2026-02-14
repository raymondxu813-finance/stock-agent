// /lib/auth/jwt.ts

/**
 * JWT 工具函数
 * 使用 jose 库（轻量、纯 JS、Edge 兼容）
 */

import { SignJWT, jwtVerify } from 'jose';
import type { JwtPayload, TokenPair } from './types';

/** 获取 JWT 签名密钥 */
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // 开发环境使用默认密钥，生产环境必须配置
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[JWT] JWT_SECRET environment variable is required in production');
    }
    // 开发环境警告（避免在 logger 初始化前循环依赖，使用 console）
    console.warn('[JWT] JWT_SECRET not set, using default development key. DO NOT use in production!');
    return new TextEncoder().encode('dev-jwt-secret-do-not-use-in-production-12345');
  }
  return new TextEncoder().encode(secret);
}

/** 解析时间字符串为秒数（如 "2h" -> 7200, "7d" -> 604800） */
function parseExpiration(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7200; // 默认 2 小时
  const num = parseInt(match[1]);
  switch (match[2]) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 7200;
  }
}

/** Access Token 有效期（秒） */
function getAccessTokenExpiry(): number {
  return parseExpiration(process.env.AUTH_TOKEN_EXPIRES_IN || '2h');
}

/** Refresh Token 有效期（秒） */
function getRefreshTokenExpiry(): number {
  return parseExpiration(process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN || '7d');
}

/**
 * 签发 Access Token + Refresh Token
 */
export async function signTokenPair(payload: Omit<JwtPayload, 'type'>): Promise<TokenPair> {
  const secret = getSecret();
  const accessExpiry = getAccessTokenExpiry();
  const refreshExpiry = getRefreshTokenExpiry();

  const accessToken = await new SignJWT({
    ...payload,
    type: 'access',
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${accessExpiry}s`)
    .sign(secret);

  const refreshToken = await new SignJWT({
    ...payload,
    type: 'refresh',
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${refreshExpiry}s`)
    .sign(secret);

  return {
    accessToken,
    refreshToken,
    expiresIn: accessExpiry,
  };
}

/**
 * 验证并解析 JWT Token
 * @returns 解析后的 payload，验证失败返回 null
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);

    // 校验必要字段
    if (!payload.userId || !payload.username || !payload.role || !payload.type) {
      return null;
    }

    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as 'user' | 'admin',
      type: payload.type as 'access' | 'refresh',
    };
  } catch {
    return null;
  }
}

/**
 * 从 Authorization 头中提取 Bearer Token
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}
