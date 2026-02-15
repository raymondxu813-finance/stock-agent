// /lib/storage/redis.ts

/**
 * Redis / Valkey 会话存储实现
 *
 * 适用于多实例部署场景下的会话共享。
 * 支持 TTL 自动过期，兼容 AWS Valkey（Redis 协议兼容）。
 *
 * 本地开发：无需 Redis，不设 REDIS_URL 即自动跳过
 * 生产环境：设置 REDIS_URL 后自动启用
 */

import Redis from 'ioredis';
import type { Session } from '../discussionService';
import type { SessionStore } from './types';
import { logger } from '../logger';

/** Key 前缀 */
const KEY_PREFIX = 'session:';
/** 用户索引前缀 */
const USER_INDEX_PREFIX = 'user_sessions:';
/** 默认 TTL：7 天（秒） */
const DEFAULT_TTL = 7 * 24 * 60 * 60;

export class RedisSessionStore implements SessionStore {
  private client: Redis;

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL is required for RedisSessionStore');
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) return null; // 超过 5 次停止重试
        return Math.min(times * 500, 5000);
      },
      lazyConnect: true,
    });

    this.client.on('error', (err: Error) => {
      logger.error({ err }, '[RedisSessionStore] Connection error');
    });

    this.client.on('connect', () => {
      logger.info('[RedisSessionStore] Connected');
    });

    // 延迟连接
    this.client.connect().catch((err: unknown) => {
      logger.error({ err }, '[RedisSessionStore] Initial connection failed');
    });
  }

  async get(sessionId: string): Promise<Session | null> {
    try {
      const data = await this.client.get(`${KEY_PREFIX}${sessionId}`);
      if (!data) return null;
      return JSON.parse(data) as Session;
    } catch (err) {
      logger.error({ err, sessionId }, '[RedisSessionStore] get() failed');
      return null;
    }
  }

  async set(sessionId: string, session: Session, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? DEFAULT_TTL;
    const data = JSON.stringify(session);

    try {
      const pipeline = this.client.pipeline();
      pipeline.setex(`${KEY_PREFIX}${sessionId}`, ttl, data);

      // 维护用户 -> 会话 ID 的索引（Sorted Set，score 为时间戳）
      if (session.userId) {
        pipeline.zadd(
          `${USER_INDEX_PREFIX}${session.userId}`,
          Date.now().toString(),
          sessionId
        );
      }

      await pipeline.exec();
    } catch (err) {
      logger.error({ err, sessionId }, '[RedisSessionStore] set() failed');
      throw err;
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      // 先读取 session 获取 userId，以便清理索引
      const session = await this.get(sessionId);
      const pipeline = this.client.pipeline();
      pipeline.del(`${KEY_PREFIX}${sessionId}`);

      if (session?.userId) {
        pipeline.zrem(`${USER_INDEX_PREFIX}${session.userId}`, sessionId);
      }

      await pipeline.exec();
    } catch (err) {
      logger.error({ err, sessionId }, '[RedisSessionStore] delete() failed');
      throw err;
    }
  }

  async listByUser(userId: string, limit = 50): Promise<Session[]> {
    try {
      // 获取最新的 N 个会话 ID（倒序）
      const sessionIds = await this.client.zrevrange(
        `${USER_INDEX_PREFIX}${userId}`,
        0,
        limit - 1
      );

      if (!sessionIds.length) return [];

      // 批量获取会话数据
      const keys = sessionIds.map((id) => `${KEY_PREFIX}${id}`);
      const results = await this.client.mget(...keys);

      const sessions: Session[] = [];
      const expiredIds: string[] = [];

      for (let i = 0; i < results.length; i++) {
        if (results[i]) {
          try {
            sessions.push(JSON.parse(results[i] as string) as Session);
          } catch {
            // 跳过损坏的数据
          }
        } else {
          // session 数据已过期，记录以便清理索引
          expiredIds.push(sessionIds[i]);
        }
      }

      // 异步清理 Sorted Set 中已过期的 session 索引
      if (expiredIds.length > 0) {
        logger.info({ userId, expiredIds }, '[RedisSessionStore] Cleaning up expired session index entries');
        this.client.zrem(`${USER_INDEX_PREFIX}${userId}`, ...expiredIds).catch((err) => {
          logger.warn({ err, userId }, '[RedisSessionStore] Failed to clean expired index entries');
        });
      }

      return sessions;
    } catch (err) {
      logger.error({ err, userId }, '[RedisSessionStore] listByUser() failed');
      return [];
    }
  }

  async getAllIds(): Promise<string[]> {
    try {
      const keys = await this.client.keys(`${KEY_PREFIX}*`);
      return keys.map((k) => k.replace(KEY_PREFIX, ''));
    } catch (err) {
      logger.error({ err }, '[RedisSessionStore] getAllIds() failed');
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await this.client.keys(`${KEY_PREFIX}*`);
      return keys.length;
    } catch (err) {
      logger.error({ err }, '[RedisSessionStore] size() failed');
      return 0;
    }
  }

  /** 检查 Redis 连接是否可用 */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /** 优雅关闭连接 */
  async disconnect(): Promise<void> {
    await this.client.quit();
    logger.info('[RedisSessionStore] Disconnected');
  }
}
