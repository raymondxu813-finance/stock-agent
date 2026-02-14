// /lib/storage/redis.ts

/**
 * Redis 会话存储（预留接口）
 *
 * 生产环境推荐使用。支持：
 * - 多实例共享会话
 * - 自动 TTL 过期
 * - 分布式锁
 *
 * 使用时需要安装 ioredis：npm install ioredis
 * 然后取消注释下面的实现代码。
 */

import type { Session } from '../discussionService';
import type { SessionStore } from './types';

// 默认 TTL：24 小时
const DEFAULT_TTL = 24 * 60 * 60;
const KEY_PREFIX = 'session:';
const USER_INDEX_PREFIX = 'user_sessions:';

export class RedisSessionStore implements SessionStore {
  // private redis: Redis;

  constructor() {
    // TODO: 启用 Redis 时取消注释
    // const Redis = require('ioredis');
    // this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    // console.log('[RedisSessionStore] Connected to Redis');
    console.warn('[RedisSessionStore] Redis not configured. Install ioredis and set REDIS_URL to enable.');
  }

  async get(sessionId: string): Promise<Session | null> {
    // const data = await this.redis.get(KEY_PREFIX + sessionId);
    // if (!data) return null;
    // return JSON.parse(data) as Session;
    throw new Error('RedisSessionStore not implemented. Set REDIS_URL and install ioredis.');
  }

  async set(sessionId: string, session: Session, ttlSeconds?: number): Promise<void> {
    // const ttl = ttlSeconds || DEFAULT_TTL;
    // const data = JSON.stringify(session);
    // await this.redis.setex(KEY_PREFIX + sessionId, ttl, data);
    //
    // // 维护用户索引
    // const userId = (session as any).userId;
    // if (userId) {
    //   await this.redis.sadd(USER_INDEX_PREFIX + userId, sessionId);
    //   await this.redis.expire(USER_INDEX_PREFIX + userId, ttl);
    // }
    throw new Error('RedisSessionStore not implemented.');
  }

  async delete(sessionId: string): Promise<void> {
    // await this.redis.del(KEY_PREFIX + sessionId);
    throw new Error('RedisSessionStore not implemented.');
  }

  async listByUser(userId: string, limit?: number): Promise<Session[]> {
    // const sessionIds = await this.redis.smembers(USER_INDEX_PREFIX + userId);
    // const sessions: Session[] = [];
    // for (const id of sessionIds.slice(0, limit || 50)) {
    //   const session = await this.get(id);
    //   if (session) sessions.push(session);
    // }
    // return sessions;
    throw new Error('RedisSessionStore not implemented.');
  }

  async getAllIds(): Promise<string[]> {
    // const keys = await this.redis.keys(KEY_PREFIX + '*');
    // return keys.map(k => k.replace(KEY_PREFIX, ''));
    throw new Error('RedisSessionStore not implemented.');
  }

  async size(): Promise<number> {
    // const keys = await this.redis.keys(KEY_PREFIX + '*');
    // return keys.length;
    throw new Error('RedisSessionStore not implemented.');
  }
}
