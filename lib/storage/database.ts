// /lib/storage/database.ts

/**
 * PostgreSQL 会话存储
 *
 * 基于 Prisma ORM，将讨论会话持久化到 PostgreSQL。
 * 实现 SessionStore 接口，可通过 lib/storage/index.ts 切换。
 *
 * Session 对象的 agents / rounds / moderatorPrompts 等复杂字段
 * 序列化为 JSON 存储在 TEXT 列中。
 */

import type { Session } from '../discussionService';
import type { SessionStore } from './types';
import { getPrismaClient } from '../db';
import { logger } from '../logger';

export class DatabaseSessionStore implements SessionStore {
  async get(sessionId: string): Promise<Session | null> {
    const prisma = getPrismaClient();
    if (!prisma) return null;

    try {
      const row = await prisma.discussionSession.findUnique({
        where: { id: sessionId },
      });

      if (!row) return null;
      return this.rowToSession(row);
    } catch (error) {
      logger.error({ err: error, sessionId }, '[DatabaseSessionStore] get failed');
      return null;
    }
  }

  async set(sessionId: string, session: Session, ttlSeconds?: number): Promise<void> {
    const prisma = getPrismaClient();
    if (!prisma) return;

    try {
      const data = {
        id: sessionId,
        userId: session.userId || null,
        topicTitle: session.topicTitle,
        topicDescription: session.topicDescription || '',
        userGoal: session.userGoal || '',
        agentsJson: JSON.stringify(session.agents),
        roundsJson: JSON.stringify(session.rounds),
        moderatorPromptsJson: session.moderatorPrompts
          ? JSON.stringify(session.moderatorPrompts)
          : null,
      };

      await prisma.discussionSession.upsert({
        where: { id: sessionId },
        update: data,
        create: data,
      });
    } catch (error) {
      logger.error({ err: error, sessionId }, '[DatabaseSessionStore] set failed');
    }
  }

  async delete(sessionId: string): Promise<void> {
    const prisma = getPrismaClient();
    if (!prisma) return;

    try {
      await prisma.discussionSession.delete({
        where: { id: sessionId },
      });
    } catch (error) {
      logger.error({ err: error, sessionId }, '[DatabaseSessionStore] delete failed');
    }
  }

  async listByUser(userId: string, limit?: number): Promise<Session[]> {
    const prisma = getPrismaClient();
    if (!prisma) return [];

    try {
      const rows = await prisma.discussionSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit || 50,
      });

      return rows.map((row: any) => this.rowToSession(row));
    } catch (error) {
      logger.error({ err: error, userId }, '[DatabaseSessionStore] listByUser failed');
      return [];
    }
  }

  async getAllIds(): Promise<string[]> {
    const prisma = getPrismaClient();
    if (!prisma) return [];

    try {
      const rows = await prisma.discussionSession.findMany({
        select: { id: true },
      });
      return rows.map((r: { id: string }) => r.id);
    } catch (error) {
      logger.error({ err: error }, '[DatabaseSessionStore] getAllIds failed');
      return [];
    }
  }

  async size(): Promise<number> {
    const prisma = getPrismaClient();
    if (!prisma) return 0;

    try {
      return await prisma.discussionSession.count();
    } catch (error) {
      logger.error({ err: error }, '[DatabaseSessionStore] size failed');
      return 0;
    }
  }

  /** 将数据库行转换为 Session 对象 */
  private rowToSession(row: {
    id: string;
    userId: string | null;
    topicTitle: string;
    topicDescription: string;
    userGoal: string;
    agentsJson: string;
    roundsJson: string;
    moderatorPromptsJson: string | null;
  }): Session {
    return {
      id: row.id,
      userId: row.userId || undefined,
      topicTitle: row.topicTitle,
      topicDescription: row.topicDescription,
      userGoal: row.userGoal,
      agents: JSON.parse(row.agentsJson),
      rounds: JSON.parse(row.roundsJson),
      moderatorPrompts: row.moderatorPromptsJson
        ? JSON.parse(row.moderatorPromptsJson)
        : undefined,
    };
  }
}
