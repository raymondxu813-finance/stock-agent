// /lib/db/usageLog.ts

/**
 * LLM 使用量日志服务
 *
 * 记录每次 LLM 调用的使用量数据，用于：
 * - 用量统计和计费
 * - 性能分析
 * - 异常监控
 *
 * 当数据库未配置时，安静地跳过写入（不影响业务流程）。
 */

import { getPrismaClient } from './index';
import { logger } from '../logger';

export interface UsageLogEntry {
  userId?: string;
  sessionId?: string;
  callType: 'speech' | 'review' | 'summary' | 'moderator' | 'other';
  keyId?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  requestId?: string;
}

/**
 * 记录一次 LLM 调用的使用量（异步，不阻塞主流程）
 */
export function logUsage(entry: UsageLogEntry): void {
  const prisma = getPrismaClient();
  if (!prisma) return; // 未配置数据库时静默跳过

  prisma.usageLog
    .create({
      data: {
        userId: entry.userId || null,
        sessionId: entry.sessionId || null,
        callType: entry.callType,
        keyId: entry.keyId || null,
        model: entry.model || null,
        promptTokens: entry.promptTokens || null,
        completionTokens: entry.completionTokens || null,
        totalTokens: entry.totalTokens || null,
        durationMs: entry.durationMs || null,
        success: entry.success,
        errorMessage: entry.errorMessage || null,
        requestId: entry.requestId || null,
      },
    })
    .catch((err: unknown) => {
      logger.warn({ err }, '[UsageLog] Failed to write usage log');
    });
}

/**
 * 获取使用量统计（管理员用）
 */
export async function getUsageStats(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalTokens: number;
  avgDurationMs: number;
  callsByType: Record<string, number>;
} | null> {
  const prisma = getPrismaClient();
  if (!prisma) return null;

  try {
    const where: any = {};
    if (options?.userId) where.userId = options.userId;
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) where.createdAt.gte = options.startDate;
      if (options?.endDate) where.createdAt.lte = options.endDate;
    }

    const [aggregate, callsByType] = await Promise.all([
      prisma.usageLog.aggregate({
        where,
        _count: { id: true },
        _sum: { totalTokens: true, durationMs: true },
        _avg: { durationMs: true },
      }),
      prisma.usageLog.groupBy({
        by: ['callType'],
        where,
        _count: { id: true },
      }),
    ]);

    const successCount = await prisma.usageLog.count({
      where: { ...where, success: true },
    });

    return {
      totalCalls: aggregate._count.id,
      successCalls: successCount,
      failedCalls: aggregate._count.id - successCount,
      totalTokens: aggregate._sum.totalTokens || 0,
      avgDurationMs: Math.round(aggregate._avg.durationMs || 0),
      callsByType: Object.fromEntries(
        callsByType.map((g: { callType: string; _count: { id: number } }) => [g.callType, g._count.id])
      ),
    };
  } catch (error) {
    logger.error({ err: error }, '[UsageLog] Failed to get usage stats');
    return null;
  }
}
