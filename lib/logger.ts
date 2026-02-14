// /lib/logger.ts

/**
 * 结构化日志工具
 *
 * 基于 pino 的轻量级 JSON 结构化日志。
 *
 * 功能：
 * - 生产环境输出 JSON 格式（方便日志采集和分析）
 * - 开发环境输出可读的彩色格式（pino-pretty）
 * - 支持请求 ID（requestId）关联追踪
 * - 支持子 logger（按模块创建带上下文的 logger）
 *
 * 使用方式：
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId, sessionId }, '用户创建了新讨论');
 *   logger.error({ err: error, keyId }, 'LLM 调用失败');
 *
 *   // 带请求 ID 的子 logger
 *   const reqLogger = createRequestLogger(requestId);
 *   reqLogger.info('处理请求开始');
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * 全局 logger 实例
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  // 生产环境输出纯 JSON，开发环境使用 pino-pretty
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
  // 基础字段
  base: {
    service: 'multiagent-stock',
    env: process.env.NODE_ENV || 'development',
  },
  // 时间戳格式
  timestamp: pino.stdTimeFunctions.isoTime,
  // 序列化 Error 对象
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * 创建带请求 ID 的子 logger
 *
 * @param requestId 请求追踪 ID
 * @param extra 额外的上下文信息（如 userId, sessionId 等）
 */
export function createRequestLogger(
  requestId: string,
  extra?: Record<string, unknown>
): pino.Logger {
  return logger.child({ requestId, ...extra });
}

/**
 * 生成唯一的请求 ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
