// /lib/moderatorLLMClient.ts

/**
 * 主持人专用的 LLM Client
 * 使用独立的 API KEY，避免与 Agent 发言的 API KEY 冲突
 */

import { OpenAILLMClient } from './llmClient';
import type { LLMClient } from './llmClient';

// 主持人专用的 API KEY
const MODERATOR_API_KEY = 'sk-43d3e1a176dd45838295cfaafcd345b4';

/**
 * 创建主持人专用的 LLM Client 实例
 */
export function createModeratorLLMClient(): LLMClient {
  return new OpenAILLMClient({
    apiKey: MODERATOR_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || 'deepseek-chat',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  });
}

// 创建并导出主持人专用的 LLM Client 实例
export const moderatorLLMClient = createModeratorLLMClient();
