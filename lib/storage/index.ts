// /lib/storage/index.ts

/**
 * 会话存储入口
 *
 * 根据环境变量选择存储实现（优先级从高到低）：
 * - 有 DATABASE_URL -> DatabaseSessionStore（PostgreSQL，持久化）
 * - 有 REDIS_URL   -> RedisSessionStore（生产缓存，预留）
 * - 否则           -> MemorySessionStore（开发默认）
 */

import type { SessionStore } from './types';
import { MemorySessionStore } from './memory';
import { logger } from '../logger';

export type { SessionStore } from './types';

let _store: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (!_store) {
    if (process.env.DATABASE_URL) {
      try {
        // 动态导入避免在未安装 Prisma 时报错
        const { DatabaseSessionStore } = require('./database');
        _store = new DatabaseSessionStore();
        logger.info('[SessionStore] Using DatabaseSessionStore (PostgreSQL)');
      } catch (error) {
        logger.warn({ err: error }, '[SessionStore] Failed to init DatabaseSessionStore, falling back to MemorySessionStore');
        _store = new MemorySessionStore();
      }
    } else if (process.env.REDIS_URL) {
      // 未来启用 Redis 时切换此处
      // const { RedisSessionStore } = require('./redis');
      // _store = new RedisSessionStore();
      logger.warn('[SessionStore] REDIS_URL set but RedisSessionStore not yet enabled. Using MemorySessionStore.');
      _store = new MemorySessionStore();
    } else {
      logger.info('[SessionStore] Using MemorySessionStore (set DATABASE_URL for production)');
      _store = new MemorySessionStore();
    }
  }
  return _store!;
}
