import { NextResponse } from 'next/server';
import { getApiKeyPool } from '@/lib/apiKeyPool';
import { isDatabaseAvailable } from '@/lib/db';

/**
 * 健康检查端点
 * GET /api/health - 基本健康状态
 * GET /api/health?detail=true - 包含 Key 池详细信息（仅开发环境）
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const detail = url.searchParams.get('detail') === 'true';

  const pool = getApiKeyPool();
  const stats = pool.getPoolStats();
  const isProduction = process.env.NODE_ENV === 'production';

  // 检查数据库连接
  const dbAvailable = await isDatabaseAvailable();

  const health: Record<string, any> = {
    status: stats.healthyKeys > 0 ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      configured: !!process.env.DATABASE_URL,
      connected: dbAvailable,
    },
  };

  // 生产环境仅返回基本状态；开发环境返回 Key 池详情
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
      totalKeys: stats.totalKeys,
      healthyKeys: stats.healthyKeys,
      activeCalls: stats.activeCalls,
    };
  }

  const statusCode = stats.healthyKeys > 0 ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
