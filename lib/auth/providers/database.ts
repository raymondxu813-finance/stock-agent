// /lib/auth/providers/database.ts

/**
 * PostgreSQL 数据库认证提供商
 *
 * 使用 Prisma ORM 将用户数据存储在 PostgreSQL 中。
 * 替代 LocalAuthProvider 的 JSON 文件存储，适用于生产环境。
 *
 * 密码使用 bcrypt 哈希存储。
 */

import bcrypt from 'bcryptjs';
import type { AuthProvider, AuthUser } from '../types';
import { getPrismaClient } from '../../db';
import { logger } from '../../logger';

const SALT_ROUNDS = 10;

export class DatabaseAuthProvider implements AuthProvider {
  async authenticate(credentials: {
    username: string;
    password: string;
  }): Promise<AuthUser> {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('数据库未配置，无法进行认证');
    }

    const user = await prisma.user.findUnique({
      where: { username: credentials.username },
    });

    if (!user) {
      throw new Error('用户名或密码错误');
    }

    const valid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!valid) {
      throw new Error('用户名或密码错误');
    }

    logger.info({ userId: user.id, username: user.username }, '[DatabaseAuth] User authenticated');

    return this.toAuthUser(user);
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const prisma = getPrismaClient();
    if (!prisma) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;
    return this.toAuthUser(user);
  }

  async register(data: {
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthUser> {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('数据库未配置，无法注册');
    }

    // 检查用户名是否已存在
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });
    if (existing) {
      throw new Error('用户名已存在');
    }

    // 密码强度校验
    if (data.password.length < 6) {
      throw new Error('密码长度至少 6 位');
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        role: 'user',
        passwordHash,
      },
    });

    logger.info({ userId: user.id, username: user.username }, '[DatabaseAuth] New user registered');

    return this.toAuthUser(user);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('数据库未配置');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('用户不存在');
    }

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      throw new Error('原密码错误');
    }

    if (newPassword.length < 6) {
      throw new Error('新密码长度至少 6 位');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    logger.info({ userId: user.id, username: user.username }, '[DatabaseAuth] Password changed');
  }

  /** 将数据库 User 转为 AuthUser（移除敏感字段） */
  private toAuthUser(user: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    avatar: string | null;
    role: string;
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email || undefined,
      avatar: user.avatar || undefined,
      role: user.role as 'user' | 'admin',
    };
  }
}
