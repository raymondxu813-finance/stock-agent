// /lib/storage/memory.ts

/**
 * 内存会话存储
 * 兼容现有逻辑，开发环境使用。
 * 数据在进程重启后丢失。
 */

import type { Session } from '../discussionService';
import type { SessionStore } from './types';

export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async set(sessionId: string, session: Session, ttlSeconds?: number): Promise<void> {
    this.sessions.set(sessionId, session);
    // 内存存储忽略 TTL（进程重启即丢失）
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listByUser(userId: string, limit?: number): Promise<Session[]> {
    const userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );
    // 按创建时间倒序（id 中包含时间戳）
    userSessions.sort((a, b) => {
      // session id 格式: session_{timestamp}_{random}
      const tsA = parseInt(a.id.split('_')[1] || '0');
      const tsB = parseInt(b.id.split('_')[1] || '0');
      return tsB - tsA;
    });
    return limit ? userSessions.slice(0, limit) : userSessions;
  }

  async getAllIds(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }

  async size(): Promise<number> {
    return this.sessions.size;
  }
}
