import { NextResponse } from 'next/server';
import { getApiKeyPool } from '@/lib/apiKeyPool';
import { isDatabaseAvailable } from '@/lib/db';

/**
 * 健康检查端点
 *
 * GET /api/health       - 基本健康状态（ALB 探测用，始终 200 只要应用存活）
 * GET /api/health?detail=true - 包含 Key 池详细信息（仅开发环境）
 *
 * 设计原则：
 * - 应用可用性（200/503）与 LLM 可用性解耦
 * - 只要应用进程存活、能响应请求 -> 200
 * - LLM 全部不可用 -> 应用仍返回 200，但 health.llm.status = "unavailable"
 * - 数据库不可用 -> 降级到内存存储，不影响应用可用性
 * - ALB 只关心 HTTP 200，不解析 JSON body
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const detail = url.searchParams.get('detail') === 'true';

  const pool = getApiKeyPool();
  const stats = pool.getPoolStats();
  const isProduction = process.env.NODE_ENV === 'production';

  // 检查数据库连接
  const dbAvailable = await isDatabaseAvailable();

  // 应用本身健康判断：只要进程存活就是 ok
  // LLM 和 DB 状态作为子字段报告，不影响 HTTP status code
  const appStatus = 'ok';

  const health: Record<string, unknown> = {
    status: appStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || 'dev',
    database: {
      configured: !!process.env.DATABASE_URL,
      connected: dbAvailable,
    },
    llm: {
      status: stats.healthyKeys > 0 ? 'available' : 'unavailable',
      healthyKeys: stats.healthyKeys,
      totalKeys: stats.totalKeys,
    },
  };

  // 开发环境返回 Key 池详情
  if (!isProduction) {
    health.keyPool = {
      totalKeys: stats.totalKeys,
      healthyKeys: stats.healthyKeys,
      degradedKeys: stats.degradedKeys,
      disabledKeys: stats.disabledKeys,
      openCircuitBreakers: stats.openCircuitBreakers,
      activeCalls: stats.activeCalls,
      maxConcurrent: stats.maxConcurrent,
      waitingRequests: stats.waitingRequests,
    };
    if (detail) {
      health.keyDetails = pool.getHealthReport();
    }
  } else {
    // 生产环境只暴露最小信息
    health.keyPool = {
      activeCalls: stats.activeCalls,
    };
  }

  // 始终返回 200 — ALB 只要收到 200 就认为容器健康
  return NextResponse.json(health, { status: 200 });
}
