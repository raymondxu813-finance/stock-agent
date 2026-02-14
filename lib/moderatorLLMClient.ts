// /lib/moderatorLLMClient.ts

import { logger } from './logger';

/**
 * 主持人专用的 LLM Client
 * 使用独立的 API KEY，避免与 Agent 发言的 API KEY 冲突
 * 
 * 如果设置了 MODERATOR_API_KEY 环境变量，则使用独立的主持人 Key
 * 否则回退到通用的 OPENAI_API_KEY / OPENAI_API_KEYS
 */

import { OpenAILLMClient } from './llmClient';
import type { LLMClient } from './llmClient';

/**
 * 创建主持人专用的 LLM Client 实例
 */
export function createModeratorLLMClient(): LLMClient {
  const moderatorKey = process.env.MODERATOR_API_KEY;

  if (moderatorKey) {
    logger.info('[moderatorLLMClient] Using dedicated MODERATOR_API_KEY');
    return new OpenAILLMClient({
      apiKey: moderatorKey,
      baseURL: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL || 'deepseek-chat',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    });
  }

  // 回退：使用通用 API Key 池
  logger.info('[moderatorLLMClient] MODERATOR_API_KEY not set, falling back to shared OPENAI_API_KEYS');
  return new OpenAILLMClient({
    baseURL: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || 'deepseek-chat',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  });
}

// 创建并导出主持人专用的 LLM Client 实例
export const moderatorLLMClient = createModeratorLLMClient();
