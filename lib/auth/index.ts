// /lib/auth/index.ts

/**
 * 认证系统入口
 *
 * ============================================================
 * 根据环境变量自动选择认证提供商：
 *   - DATABASE_URL 配置时 -> DatabaseAuthProvider（PostgreSQL）
 *   - 否则               -> LocalAuthProvider（本地 JSON 文件）
 * 也可手动切换到公司账号系统。
 * ============================================================
 */

import type { AuthProvider } from './types';
import { LocalAuthProvider } from './providers/local';
// import { CompanyAuthProvider } from './providers/company';

function createAuthProvider(): AuthProvider {
  // 优先使用数据库认证（生产环境推荐）
  if (process.env.DATABASE_URL) {
    try {
      const { DatabaseAuthProvider } = require('./providers/database');
      console.log('[Auth] Using DatabaseAuthProvider (PostgreSQL)');
      return new DatabaseAuthProvider();
    } catch (error) {
      console.warn('[Auth] Failed to init DatabaseAuthProvider, falling back to LocalAuthProvider:', error);
    }
  }

  // 默认使用本地文件认证（开发环境）
  console.log('[Auth] Using LocalAuthProvider (local file)');
  return new LocalAuthProvider();
}

export const authProvider: AuthProvider = createAuthProvider();

// ====== 手动切换到公司账号系统时，取消注释下面的代码 ======
// export const authProvider: AuthProvider = new CompanyAuthProvider({
//   apiBaseUrl: process.env.COMPANY_AUTH_API_URL!,
//   appId: process.env.COMPANY_AUTH_APP_ID!,
//   appSecret: process.env.COMPANY_AUTH_APP_SECRET!,
// });

// 导出类型
export type { AuthUser, AuthProvider, TokenPair, JwtPayload } from './types';
export { signTokenPair, verifyToken, extractBearerToken } from './jwt';
