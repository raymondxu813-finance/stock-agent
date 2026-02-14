// /lib/llmClient.ts

import { logger } from './logger';

/**
 * LLM Client 抽象接口和实现
 * 用于统一调用大语言模型 API
 * 
 * 重构：Key 管理已迁移至 ApiKeyPoolManager (lib/apiKeyPool.ts)
 * OpenAILLMClient 支持两种模式：
 *   1. 注入单个 apiKey（如 moderatorLLMClient 传入专用 Key）
 *   2. 无 apiKey 时使用全局 ApiKeyPoolManager（推荐方式）
 */

import { getApiKeyPool } from './apiKeyPool';

/**
 * LLM Client 接口
 * 定义了调用大语言模型的标准方法
 */
export interface LLMClient {
  /**
   * 生成文本内容
   * 
   * @param systemPrompt System Prompt，定义模型的角色和行为
   * @param userPrompt User Prompt，用户的具体请求
   * @param agentId 可选的 Agent ID，用于选择不同的 API 提供商
   * @returns Promise<string> 生成的文本内容
   */
  generate(systemPrompt: string, userPrompt: string, agentId?: string): Promise<string>;
  
  /**
   * 流式生成文本内容
   * 
   * @param systemPrompt System Prompt，定义模型的角色和行为
   * @param userPrompt User Prompt，用户的具体请求
   * @param agentId 可选的 Agent ID，用于选择不同的 API 提供商
   * @param onChunk 接收到每个数据块时的回调函数
   * @returns Promise<string> 完整生成的文本内容
   */
  generateStream(
    systemPrompt: string, 
    userPrompt: string, 
    agentId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string>;
}

/**
 * OpenAI LLM Client
 * 使用 OpenAI 兼容 API 进行文本生成（DeepSeek/OpenAI）
 * 
 * Key 管理策略：
 * - 如果构造时传入 apiKey，使用该固定 Key（如主持人专用 Key）
 * - 否则使用全局 ApiKeyPoolManager 进行智能调度（推荐）
 */
export class OpenAILLMClient implements LLMClient {
  private fixedApiKey?: string;
  private baseURL?: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config?: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    // 如果传入了固定 apiKey，使用它；否则后续调用通过 ApiKeyPoolManager 获取
    this.fixedApiKey = config?.apiKey;

    this.baseURL = config?.baseURL || process.env.OPENAI_BASE_URL;
    this.model = config?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = config?.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '2000');
    this.temperature = config?.temperature || parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');

    if (this.fixedApiKey) {
      logger.info('[OpenAILLMClient] Initialized with fixed API key');
    } else {
      logger.info('[OpenAILLMClient] Initialized, will use ApiKeyPoolManager for key selection');
    }
  }

  /**
   * 获取 API Key：优先使用固定 Key，否则从池中获取
   */
  private async getApiKey(): Promise<{ apiKey: string; keyId?: string }> {
    if (this.fixedApiKey) {
      return { apiKey: this.fixedApiKey };
    }
    const pool = getApiKeyPool();
    const { keyId, apiKey } = await pool.acquireKey();
    return { apiKey, keyId };
  }

  /**
   * 释放 Key（仅池化 Key 需要释放）
   */
  private releaseKey(keyId?: string): void {
    if (keyId) {
      getApiKeyPool().releaseKey(keyId);
    }
  }

  /**
   * 上报成功（仅池化 Key）
   */
  private reportSuccess(keyId?: string): void {
    if (keyId) {
      getApiKeyPool().reportSuccess(keyId);
    }
  }

  /**
   * 上报失败（仅池化 Key）
   */
  private reportFailure(keyId?: string, error?: any): void {
    if (keyId) {
      getApiKeyPool().reportFailure(keyId, error);
    }
  }

  async generate(systemPrompt: string, userPrompt: string, agentId?: string): Promise<string> {
    // 判断是否需要 JSON 格式
    const needsJSON = this.shouldReturnJSON(systemPrompt, userPrompt);

    // 如果使用池化模式，利用 executeWithRetry 自动重试
    if (!this.fixedApiKey) {
      const pool = getApiKeyPool();
      return pool.executeWithRetry(async (apiKey) => {
        return this.doGenerate(apiKey, systemPrompt, userPrompt, needsJSON);
      });
    }

    // 固定 Key 模式：直接调用（无自动重试）
    return this.doGenerate(this.fixedApiKey, systemPrompt, userPrompt, needsJSON);
  }

  private async doGenerate(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    needsJSON: boolean,
  ): Promise<string> {
    const { default: OpenAI } = await import('openai');
    
    const openai = new OpenAI({
      apiKey,
      baseURL: this.baseURL || 'https://api.openai.com/v1',
    });

    const effectiveMaxTokens = needsJSON 
      ? Math.min(this.maxTokens, 4000)
      : Math.min(this.maxTokens, 1500);

    let finalSystemPrompt = systemPrompt;
    let finalUserPrompt = userPrompt;
    
    if (needsJSON) {
      const hasJsonKeyword = 
        systemPrompt.toLowerCase().includes('json') ||
        userPrompt.toLowerCase().includes('json');
      if (!hasJsonKeyword) {
        finalUserPrompt = `${userPrompt}\n\n请以 JSON 格式输出结果。`;
      }
    }

    const apiStartTime = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      const completion = await openai.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: finalUserPrompt },
          ],
          max_tokens: effectiveMaxTokens,
          temperature: this.temperature,
          response_format: needsJSON 
            ? { type: 'json_object' as const }
            : undefined,
        },
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      const apiDuration = Date.now() - apiStartTime;
      logger.debug({ durationMs: apiDuration }, '[OpenAILLMClient] API call completed');
      
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from API');
      }

      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API call timeout after 60 seconds');
      }
      throw error;
    }
  }

  /**
   * 流式生成文本内容
   */
  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    agentId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const needsJSON = this.shouldReturnJSON(systemPrompt, userPrompt);

    // 如果使用池化模式，利用 executeWithRetry 自动重试
    if (!this.fixedApiKey) {
      const pool = getApiKeyPool();
      return pool.executeWithRetry(async (apiKey) => {
        return this.doGenerateStream(apiKey, systemPrompt, userPrompt, needsJSON, onChunk);
      });
    }

    // 固定 Key 模式
    return this.doGenerateStream(this.fixedApiKey, systemPrompt, userPrompt, needsJSON, onChunk);
  }

  private async doGenerateStream(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    needsJSON: boolean,
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    const { default: OpenAI } = await import('openai');
    
    const openai = new OpenAI({
      apiKey,
      baseURL: this.baseURL || 'https://api.openai.com/v1',
    });

    const effectiveMaxTokens = needsJSON 
      ? Math.min(this.maxTokens, 4000)
      : Math.min(this.maxTokens, 1500);

    let finalSystemPrompt = systemPrompt;
    let finalUserPrompt = userPrompt;
    
    if (needsJSON) {
      const hasJsonKeyword = 
        systemPrompt.toLowerCase().includes('json') ||
        userPrompt.toLowerCase().includes('json');
      if (!hasJsonKeyword) {
        finalUserPrompt = `${userPrompt}\n\n请以 JSON 格式输出结果。`;
      }
    }

    const apiStartTime = Date.now();
    let fullContent = '';
    
    const stream = await openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: finalUserPrompt },
      ],
      max_tokens: effectiveMaxTokens,
      temperature: this.temperature,
      stream: true,
      response_format: needsJSON 
        ? { type: 'json_object' as const }
        : undefined,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        if (onChunk) {
          onChunk(content);
        }
      }
    }
    
    const apiDuration = Date.now() - apiStartTime;
    logger.debug({ durationMs: apiDuration, contentLength: fullContent.length }, '[OpenAILLMClient] Streaming completed');
    
    return fullContent;
  }


  /**
   * 判断是否应该返回 JSON 格式
   * 根据 systemPrompt 和 userPrompt 的内容判断
   * 
   * 注意：只有总结相关的请求才需要 JSON 格式
   * Agent 发言和互评应该返回自然语言文本，不需要 JSON
   */
  private shouldReturnJSON(systemPrompt: string, userPrompt: string): boolean {
    const systemLower = systemPrompt.toLowerCase();
    const userLower = userPrompt.toLowerCase();
    
    // 精确判断：只有总结器相关的请求才需要 JSON
    // 关键标识：systemPrompt 中包含"总结器"且明确要求 JSON 结构
    const isSummaryRequest = 
      systemLower.includes('总结器') && 
      (systemLower.includes('json 结构') || systemLower.includes('json结构') || systemLower.includes('输出指定的 json'));
    
    // 或者 userPrompt 中明确要求 JSON 格式
    const userRequiresJSON = 
      userLower.includes('json 格式') || 
      userLower.includes('json格式') ||
      userLower.includes('请对第') && userLower.includes('轮讨论进行结构化总结') ||
      userLower.includes('all_round_summaries');
    
    return isSummaryRequest || userRequiresJSON;
  }
}

/**
 * Mock LLM Client
 * 用于本地开发和测试，不进行真实的 API 调用
 */
class MockLLMClient implements LLMClient {
  async generate(systemPrompt: string, userPrompt: string, agentId?: string): Promise<string> {
    // 检查是否是轮次总结请求（包含 roundSummarySystemPromptTemplate）
    // 检测条件：systemPrompt 包含"总结器"且 userPrompt 包含"请对第"和"轮讨论进行结构化总结"
    if (systemPrompt.includes('多 Agent 话题讨论系统的总结器') && 
        (userPrompt.includes('请对第') || userPrompt.includes('轮讨论进行结构化总结'))) {
      // 返回模拟的 RoundSummary JSON
      const roundMatch = userPrompt.match(/请对第\s*(\d+)\s*轮/);
      const roundIndex = roundMatch ? parseInt(roundMatch[1]) : 1;
      
      // 提取话题标题
      const topicMatch = userPrompt.match(/标题：([^\n]+)/);
      const topicTitle = topicMatch ? topicMatch[1].trim() : '测试话题';
      
      // 提取 agent 信息 - 从 current_round_agents_speeches 中提取（格式：【名称（ID）】）
      const agentMatches = userPrompt.match(/【([^（]+)（([^）]+)）】/g) || [];
      let agents: Array<{ agentName: string; agentId: string }> = [];
      
      if (agentMatches.length > 0) {
        // 去重，因为可能有重复的 agent
        const agentMap = new Map<string, { agentName: string; agentId: string }>();
        agentMatches.forEach(m => {
          const nameMatch = m.match(/【([^（]+)/);
          const idMatch = m.match(/（([^）]+)/);
          if (nameMatch && idMatch) {
            const agentId = idMatch[1].trim();
            if (!agentMap.has(agentId)) {
              agentMap.set(agentId, {
                agentName: nameMatch[1].trim(),
                agentId: agentId,
              });
            }
          }
        });
        agents = Array.from(agentMap.values());
      }
      
      // 如果没有提取到，使用默认值
      if (agents.length === 0) {
        agents = [
          { agentName: '涨停敢死队长', agentId: 'macro_economist' },
          { agentName: '价值投资苦行僧', agentId: 'finance_expert' },
          { agentName: '量化狙击手', agentId: 'senior_stock_practitioner' },
        ];
      }
      
      return JSON.stringify({
        roundIndex,
        topicTitle,
        overallSummary: `本轮讨论中，各 Agent 从不同角度分析了"${topicTitle}"这个话题，提出了各自的见解和建议。涨停敢死队长从短线盘面和资金流向角度进行了分析，价值投资苦行僧从企业内在价值和护城河角度给出了建议，量化狙击手从数据和模型角度提供了量化分析。`,
        agentsSummary: agents.map(a => ({
          agentId: a.agentId,
          agentName: a.agentName,
          keyPoints: [
            `${a.agentName} 从专业角度分析了当前话题`,
            '提出了几个关键观点和建议',
            '对风险因素进行了评估',
          ],
        })),
        consensus: [
          {
            point: '需要进一步关注市场变化',
            supportingAgents: agents.slice(0, 2).map(a => a.agentName),
            supportCount: 2,
            totalAgents: agents.length,
          },
        ],
        conflicts: [
          {
            issue: '对短期走势的判断存在分歧',
            positions: agents.map(a => ({
              agentName: a.agentName,
              position: `${a.agentName} 认为需要谨慎观察`,
            })),
          },
        ],
        insights: [
          '市场存在不确定性',
          '需要关注政策变化',
        ],
        openQuestions: [
          '未来政策走向如何？',
          '市场情绪如何变化？',
        ],
        nextRoundSuggestions: [
          '深入讨论政策影响',
          '分析市场情绪变化',
        ],
      }, null, 2);
    }
    
    // 检查是否是会话总结请求
    if (systemPrompt.includes('对整个会话') && userPrompt.includes('all_round_summaries_json')) {
      return JSON.stringify({
        topicTitle: '测试话题',
        roundCount: 1,
        finalConsensus: [],
        persistentConflicts: [],
        keyFactors: [],
        risks: [],
        actionableSuggestions: [],
        textReport: '这是模拟的会话总结报告。',
      }, null, 2);
    }
    
    // 默认返回 Agent 发言内容
    const agentNameMatch = systemPrompt.match(/【基础身份】\s*- 名称：([^\n]+)/);
    const agentName = agentNameMatch ? agentNameMatch[1].trim() : 'AI Agent';
    
      return `作为 ${agentName}，我对当前话题有以下观点：

1. 从我的专业角度来看，这个话题涉及多个重要方面。
2. 需要综合考虑各种因素，包括市场环境、政策变化等。
3. 建议采取谨慎的态度，同时保持对机会的敏感度。

以上是我的初步分析，后续可以根据更多信息进行深入讨论。`;
  }

  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    agentId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    // Mock 流式输出：模拟打字机效果
    const fullContent = await this.generate(systemPrompt, userPrompt, agentId);
    
    // 模拟流式输出，每次发送一个字符
    if (onChunk) {
      for (let i = 0; i < fullContent.length; i++) {
        onChunk(fullContent[i]);
        // 模拟网络延迟，每 10 个字符延迟一次
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }
    
    return fullContent;
  }
}

/**
 * 根据环境变量决定使用哪个 LLM Client
 * 如果设置了 OPENAI_API_KEY 或 OPENAI_API_KEYS，使用 OpenAILLMClient
 * 否则使用 MockLLMClient（用于开发测试）
 * 
 * 注意：在 Next.js 中，环境变量只在服务端可用
 * 这个函数会在每次调用时检查环境变量，确保能正确读取
 */
function createLLMClient(): LLMClient {
  // 在服务端环境中检查环境变量
  // Next.js 会自动加载 .env.local 文件中的环境变量
  const apiKey = typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined;
  const apiKeys = typeof process !== 'undefined' ? process.env.OPENAI_API_KEYS : undefined;
  
  if (apiKey || apiKeys) {
    const keyCount = apiKeys 
      ? apiKeys.split(',').filter(k => k.trim().length > 0).length 
      : (apiKey ? 1 : 0);
    
    logger.info({
      keyCount,
      model: process.env.OPENAI_MODEL || 'deepseek-chat',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    }, '[llmClient] Using DeepSeek/OpenAI API');
    
    if (keyCount > 1) {
      logger.info('[llmClient] Multi-key load balancing enabled');
    }
    
    return new OpenAILLMClient();
  } else {
    logger.info('[llmClient] Using Mock LLM Client (set OPENAI_API_KEY or OPENAI_API_KEYS in .env.local)');
    return new MockLLMClient();
  }
}

/**
 * 默认导出的 LLM Client 实例
 * 根据环境变量自动选择使用真实 API 或 Mock 实现
 * 
 * 注意：在 Next.js API Routes 中，环境变量会自动加载
 * 如果环境变量没有生效，请确保：
 * 1. .env.local 文件存在于项目根目录
 * 2. 重启开发服务器（npm run dev）
 */
export const llmClient: LLMClient = createLLMClient();
