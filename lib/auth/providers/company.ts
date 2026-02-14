// /lib/auth/providers/company.ts

/**
 * 公司账号系统认证提供商（模板）
 *
 * 未来对接公司已有账号系统时，实现此文件即可。
 * 只需在 lib/auth/index.ts 中切换一行配置。
 *
 * 示例：调用公司 REST API 进行认证
 */

import type { AuthProvider, AuthUser } from '../types';

interface CompanyAuthConfig {
  /** 公司认证 API 的基础 URL */
  apiBaseUrl: string;
  /** 应用 ID */
  appId: string;
  /** 应用密钥 */
  appSecret: string;
}

export class CompanyAuthProvider implements AuthProvider {
  private config: CompanyAuthConfig;

  constructor(config: CompanyAuthConfig) {
    this.config = config;
  }

  async authenticate(credentials: {
    username: string;
    password: string;
  }): Promise<AuthUser> {
    // TODO: 调用公司认证 API
    // const response = await fetch(`${this.config.apiBaseUrl}/auth/login`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-App-Id': this.config.appId,
    //     'X-App-Secret': this.config.appSecret,
    //   },
    //   body: JSON.stringify(credentials),
    // });
    //
    // if (!response.ok) throw new Error('认证失败');
    // const data = await response.json();
    //
    // return {
    //   id: data.userId,
    //   username: data.username,
    //   displayName: data.displayName || data.username,
    //   email: data.email,
    //   avatar: data.avatar,
    //   role: data.isAdmin ? 'admin' : 'user',
    // };

    throw new Error('CompanyAuthProvider 尚未实现，请参考模板完成对接');
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    // TODO: 调用公司用户信息 API
    // const response = await fetch(`${this.config.apiBaseUrl}/users/${userId}`, {
    //   headers: {
    //     'X-App-Id': this.config.appId,
    //     'X-App-Secret': this.config.appSecret,
    //   },
    // });
    //
    // if (!response.ok) return null;
    // const data = await response.json();
    // return { ... };

    throw new Error('CompanyAuthProvider 尚未实现');
  }

  // 注册和修改密码通常由公司统一账号系统管理，此处不实现
}
