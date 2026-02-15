// /lib/validation.ts

/**
 * API 请求输入校验工具
 * 使用 Zod 进行结构化校验，防止恶意输入
 */

import { z } from 'zod';

// ============================================
// 通用校验规则
// ============================================

/** 安全字符串：去除首尾空白，限制长度 */
const safeString = (maxLength: number = 500) =>
  z.string().trim().min(1, '不能为空').max(maxLength, `最大 ${maxLength} 字符`);

/** 可选安全字符串 */
const optionalSafeString = (maxLength: number = 500) =>
  z.string().trim().max(maxLength, `最大 ${maxLength} 字符`).optional().default('');

/** Agent ID 格式校验 */
const agentIdSchema = z.string().trim().min(1).max(100).regex(
  /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  'Agent ID 只能包含字母、数字和下划线'
);

/** Session ID 格式校验 */
const sessionIdSchema = z.string().trim().min(1).max(200);

// ============================================
// API 路由专用 Schema
// ============================================

/** POST /api/sessions - 创建会话 */
export const createSessionSchema = z.object({
  topicTitle: safeString(200),
  topicDescription: optionalSafeString(2000),
  userGoal: safeString(500),
  agentIds: z.array(agentIdSchema).min(2, '至少选择 2 个 Agent').max(12, '最多选择 12 个 Agent'),
});

/** POST /api/agents/speech/stream - Agent 发言 */
export const agentSpeechSchema = z.object({
  sessionId: sessionIdSchema,
  agentId: agentIdSchema,
  roundIndex: z.number().int().positive().max(100),
  sessionData: z.any().optional(),
  previousRoundComments: z.array(z.any()).optional(),
  userQuestion: z.string().trim().max(2000).optional(),
  userMentionedAgentIds: z.array(agentIdSchema).optional(),
});

/** POST /api/agents/reply/stream - Agent 回复 */
export const agentReplySchema = z.object({
  sessionId: sessionIdSchema,
  agentId: agentIdSchema,
  roundIndex: z.number().int().positive().max(100),
  sessionData: z.any().optional(),
  previousRoundComments: z.array(z.any()).optional(),
  targetAgentId: agentIdSchema.optional(),
});

/** POST /api/rounds/summary/stream - 轮次总结 */
export const roundSummarySchema = z.object({
  sessionId: sessionIdSchema,
  roundIndex: z.number().int().positive().max(100),
  agentsSpeeches: z.array(z.object({
    agentId: agentIdSchema,
    agentName: safeString(100),
    speech: z.string().max(10000).optional(),
    content: z.string().max(10000).optional(),
  })).optional(),
  agentsReviews: z.array(z.any()).optional(),
  agentsReplies: z.array(z.any()).optional(),
  sessionData: z.any().optional(),
  userQuestion: z.string().trim().max(2000).optional(),
  /** 原始发言数据（含 toolCalls / sentiments），由前端附加，用于历史恢复 */
  rawSpeeches: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    content: z.string(),
    sentiments: z.array(z.any()).optional(),
    toolCalls: z.array(z.any()).optional(),
    completedAt: z.number().optional(),
  })).optional(),
  /** 用户 @提及的 agent ID 列表 */
  userMentionedAgentIds: z.array(z.string()).optional(),
  /** 用户提问时间戳 */
  userQuestionTime: z.number().optional(),
});

/** POST /api/user/message/stream - 用户消息 */
export const userMessageSchema = z.object({
  sessionId: sessionIdSchema,
  message: safeString(2000),
  agentIds: z.array(agentIdSchema).optional(),
  sessionData: z.any().optional(),
});

// ============================================
// 校验辅助函数
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * 校验请求体
 * @param schema Zod schema
 * @param body 请求体
 * @returns 校验结果
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }

  // 提取第一个错误信息（Zod v4 使用 issues 而非 errors）
  const issues = result.error.issues;
  if (issues && issues.length > 0) {
    const firstIssue = issues[0];
    const path = firstIssue.path?.join('.') || '';
    const message = path ? `${path}: ${firstIssue.message}` : firstIssue.message;
    return { success: false, error: message };
  }

  return { success: false, error: result.error.message || '输入校验失败' };
}
