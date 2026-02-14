// /lib/auth/providers/local.ts

/**
 * 本地账号密码认证提供商
 *
 * 使用内存存储 + 文件持久化，适用于开发和小规模部署。
 * 生产环境建议迁移到 DatabaseAuthProvider（对接 PostgreSQL）。
 */

import bcrypt from 'bcryptjs';
import type { AuthProvider, AuthUser } from '../types';
import { logger } from '../../logger';
import fs from 'fs';
import path from 'path';

interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar?: string;
  role: 'user' | 'admin';
  passwordHash: string;
  createdAt: string;
}

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');
const SALT_ROUNDS = 10;

export class LocalAuthProvider implements AuthProvider {
  private users: Map<string, StoredUser> = new Map();
  private loaded = false;

  constructor() {
    this.loadUsers();
  }

  /** 从文件加载用户数据 */
  private loadUsers(): void {
    if (this.loaded) return;

    try {
      if (fs.existsSync(USERS_FILE)) {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        if (Array.isArray(data)) {
          for (const user of data) {
            this.users.set(user.id, user);
          }
        }
        logger.info({ count: this.users.size }, '[LocalAuth] Users loaded from file');
      } else if (process.env.NODE_ENV === 'production') {
        // 生产环境不自动创建默认用户，避免安全风险
        logger.warn('[LocalAuth] 生产环境未找到用户数据文件，请通过注册接口或手动创建管理员账号');
      } else {
        // 开发环境首次运行，创建默认用户
        this.createDefaultUsers();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        logger.error({ err: error }, '[LocalAuth] 生产环境加载用户数据失败');
      } else {
        logger.warn({ err: error }, '[LocalAuth] Failed to load users file, creating defaults');
        this.createDefaultUsers();
      }
    }

    this.loaded = true;
  }

  /** 创建默认用户 */
  private createDefaultUsers(): void {
    const defaultUsers: Array<{
      username: string;
      password: string;
      displayName: string;
      role: 'user' | 'admin';
    }> = [
      { username: 'admin', password: 'admin123', displayName: '管理员', role: 'admin' },
      { username: 'demo', password: 'demo123', displayName: '演示用户', role: 'user' },
    ];

    for (const u of defaultUsers) {
      const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const passwordHash = bcrypt.hashSync(u.password, SALT_ROUNDS);
      this.users.set(id, {
        id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        passwordHash,
        createdAt: new Date().toISOString(),
      });
    }

    this.saveUsers();
    logger.info('[LocalAuth] Created default users: admin/admin123, demo/demo123');
  }

  /** 保存用户数据到文件 */
  private saveUsers(): void {
    try {
      const dir = path.dirname(USERS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.users.values());
      fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error({ err: error }, '[LocalAuth] Failed to save users');
    }
  }

  /** 将 StoredUser 转为 AuthUser（移除密码哈希） */
  private toAuthUser(stored: StoredUser): AuthUser {
    return {
      id: stored.id,
      username: stored.username,
      displayName: stored.displayName,
      email: stored.email,
      avatar: stored.avatar,
      role: stored.role,
    };
  }

  async authenticate(credentials: {
    username: string;
    password: string;
  }): Promise<AuthUser> {
    const stored = Array.from(this.users.values()).find(
      (u) => u.username === credentials.username
    );

    if (!stored) {
      throw new Error('用户名或密码错误');
    }

    const valid = await bcrypt.compare(credentials.password, stored.passwordHash);
    if (!valid) {
      throw new Error('用户名或密码错误');
    }

    return this.toAuthUser(stored);
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const stored = this.users.get(userId);
    if (!stored) return null;
    return this.toAuthUser(stored);
  }

  async register(data: {
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthUser> {
    // 检查用户名是否已存在
    const existing = Array.from(this.users.values()).find(
      (u) => u.username === data.username
    );
    if (existing) {
      throw new Error('用户名已存在');
    }

    // 密码强度校验
    if (data.password.length < 6) {
      throw new Error('密码长度至少 6 位');
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const stored: StoredUser = {
      id,
      username: data.username,
      displayName: data.displayName,
      role: 'user',
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.users.set(id, stored);
    this.saveUsers();

    logger.info({ userId: id, username: data.username }, '[LocalAuth] New user registered');
    return this.toAuthUser(stored);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const stored = this.users.get(userId);
    if (!stored) {
      throw new Error('用户不存在');
    }

    const valid = await bcrypt.compare(oldPassword, stored.passwordHash);
    if (!valid) {
      throw new Error('原密码错误');
    }

    if (newPassword.length < 6) {
      throw new Error('新密码长度至少 6 位');
    }

    stored.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    this.saveUsers();

    logger.info({ username: stored.username }, '[LocalAuth] Password changed');
  }
}
