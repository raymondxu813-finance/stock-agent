// /lib/storage/types.ts

/**
 * 会话存储抽象接口
 *
 * 当前实现：MemorySessionStore（内存存储，兼容现有逻辑）
 * 生产环境：RedisSessionStore（Redis，支持多实例、TTL）
 * 长期方案：DatabaseSessionStore（PostgreSQL，持久化）
 */

import type { Session } from '../discussionService';

export interface SessionStore {
  /** 获取会话 */
  get(sessionId: string): Promise<Session | null>;

  /** 保存会话（可选 TTL，单位秒） */
  set(sessionId: string, session: Session, ttlSeconds?: number): Promise<void>;

  /** 删除会话 */
  delete(sessionId: string): Promise<void>;

  /** 列出某用户的所有会话（需要 Session 有 userId 字段） */
  listByUser(userId: string, limit?: number): Promise<Session[]>;

  /** 获取所有会话 ID（调试用） */
  getAllIds(): Promise<string[]>;

  /** 获取会话总数 */
  size(): Promise<number>;
}
