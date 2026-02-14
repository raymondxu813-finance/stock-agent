// /lib/auth/types.ts

/**
 * 认证系统类型定义
 *
 * AuthProvider 接口是认证系统的核心抽象。
 * 当前使用 LocalAuthProvider（账号密码），
 * 未来对接公司账号系统时只需实现此接口即可切换。
 */

/** 用户信息（所有 provider 统一返回此格式） */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar?: string;
  role: 'user' | 'admin';
}

/** 认证提供商接口 - 替换认证系统时只需实现此接口 */
export interface AuthProvider {
  /** 登录验证，成功返回用户信息，失败抛出错误 */
  authenticate(credentials: {
    username: string;
    password: string;
  }): Promise<AuthUser>;

  /** 根据用户 ID 获取用户信息（用于 JWT 刷新/验证时） */
  getUserById(userId: string): Promise<AuthUser | null>;

  /** 注册新用户（可选，某些 provider 不支持） */
  register?(data: {
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthUser>;

  /** 修改密码（可选） */
  changePassword?(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void>;
}

/** JWT Token 对 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
}

/** JWT Payload（存储在 token 中的数据） */
export interface JwtPayload {
  userId: string;
  username: string;
  role: 'user' | 'admin';
  type: 'access' | 'refresh';
}
