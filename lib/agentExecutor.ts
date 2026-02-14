// /lib/agentExecutor.ts

/**
 * Agent Executor - 使用原生 OpenAI SDK 实现带工具调用的 Agent 执行器
 * 
 * 使用与 llmClient.ts 相同的原生 openai SDK，确保与 DeepSeek 兼容。
 * 支持流式输出 + 工具调用（function calling）+ 多步对话。
 * 
 * 改进：在源头剥离 DSML 块和 [SENTIMENT] 块，只发送干净的增量 chunk 事件，
 *       不再发送 content_replace 事件，确保前端打字机输出流畅无闪烁。
 */

/**
 * API Key 管理：使用统一的 ApiKeyPoolManager
 */
import { getApiKeyPool } from './apiKeyPool';
import { logger } from './logger';

// ============================================
// OpenAI Function Calling 工具定义
// ============================================

/** OpenAI tools 格式的工具定义 */
const openaiTools: Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}> = [
  {
    type: 'function',
    function: {
      name: 'getStockPrice',
      description: '查询股票或指数的实时价格、涨跌幅、成交量等行情数据。支持A股、港股、美股。',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: '股票代码或名称，如 "比亚迪"、"600519"、"腾讯"、"AAPL"',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getLatestNews',
      description: '获取某只股票、行业或投资话题相关的最新新闻和资讯',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词，如 "比亚迪"、"新能源汽车"、"AI芯片"',
          },
          limit: {
            type: 'number',
            description: '返回新闻条数，默认3条',
          },
        },
        required: ['query'],
      },
    },
  },
];

/**
 * Parse DSML-style function calls from text output (DeepSeek native format).
 * DeepSeek sometimes outputs function calls as XML/DSML text instead of using
 * the standard tool_calls streaming API. This function detects and parses them.
 */
function parseDsmlToolCalls(text: string): { cleanText: string; toolCalls: Array<{ name: string; args: Record<string, any> }> } | null {
  // Find the start of a DSML/function_calls block
  const startIdx = text.search(/<[^>]*function_calls[^>]*>/i);
  if (startIdx === -1) return null;

  const cleanText = text.substring(0, startIdx).trim();
  const dsmlBlock = text.substring(startIdx);

  const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];

  // Match invoke blocks with flexible formatting (pipes, spaces, DSML markers)
  const invokeRegex = /<[^>]*invoke\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*invoke[^>]*>/gi;
  let invokeMatch;
  while ((invokeMatch = invokeRegex.exec(dsmlBlock)) !== null) {
    const name = invokeMatch[1];
    const paramsBlock = invokeMatch[2];
    const args: Record<string, any> = {};

    // Match parameter blocks
    const paramRegex = /<[^>]*parameter\s+name="([^"]+)"[^>]*>([^<]*)<\//gi;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsBlock)) !== null) {
      const pName = paramMatch[1];
      let pValue: any = paramMatch[2].trim();
      const num = Number(pValue);
      if (!isNaN(num) && pValue !== '') pValue = num;
      args[pName] = pValue;
    }

    // Map DSML tool names and parameter names to our tool's expected format
    const mappedName = mapDsmlToolName(name);
    const mappedArgs = mapDsmlToolArgs(mappedName, args);
    toolCalls.push({ name: mappedName, args: mappedArgs });
  }

  return toolCalls.length > 0 ? { cleanText, toolCalls } : null;
}

/**
 * Map DSML tool names to our actual tool names.
 */
function mapDsmlToolName(name: string): string {
  const nameMap: Record<string, string> = {
    'queryStockPrice': 'getStockPrice',
    'get_stock_price': 'getStockPrice',
    'stockPrice': 'getStockPrice',
    'getNews': 'getLatestNews',
    'get_latest_news': 'getLatestNews',
    'searchNews': 'getLatestNews',
    'latestNews': 'getLatestNews',
  };
  return nameMap[name] || name;
}

/**
 * Map DSML parameter names to our tool's expected parameter names.
 */
function mapDsmlToolArgs(toolName: string, args: Record<string, any>): Record<string, any> {
  const mapped = { ...args };

  switch (toolName) {
    case 'getLatestNews':
      if (mapped.keyword && !mapped.query) { mapped.query = mapped.keyword; delete mapped.keyword; }
      if (mapped.count !== undefined && mapped.limit === undefined) { mapped.limit = mapped.count; delete mapped.count; }
      break;
    case 'getStockPrice':
      if (!mapped.symbol) {
        const alt = mapped.name || mapped.stock_name || mapped.stock || mapped.stock_code;
        if (alt) { mapped.symbol = alt; delete mapped.name; delete mapped.stock_name; delete mapped.stock; delete mapped.stock_code; }
      }
      break;
  }

  return mapped;
}

/**
 * 执行工具调用（调用 tools 目录下对应的 execute 函数）
 */
async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  switch (name) {
    case 'getStockPrice': {
      const { getStockPrice } = await import('./tools/stockPrice');
      return (getStockPrice as any).execute(args);
    }
    case 'getLatestNews': {
      const { getLatestNews } = await import('./tools/news');
      return (getLatestNews as any).execute({ limit: 3, ...args });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================
// Agent 执行器
// ============================================

export interface ExecuteAgentParams {
  systemPrompt: string;
  userPrompt: string;
  maxSteps?: number;
  temperature?: number;
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, any>;
  result: any;
}

/**
 * 使用原生 OpenAI SDK 执行 agent，支持工具调用和流式输出。
 * 
 * 工作流程：
 * 1. 发送 system + user prompt，开启流式响应
 * 2. 收集流式文本和工具调用
 * 3. 如果有工具调用 → 执行工具 → 将结果追加到消息 → 再次调用 API
 * 4. 重复直到模型不再调用工具或达到 maxSteps
 * 
 * 所有事件通过 SSE 实时推送给前端。
 * 
 * 改进点：
 * - DSML 和 [SENTIMENT] 在源头被剥离，不会泄露到前端
 * - 不再发送 content_replace 事件，只发送干净的增量 chunk
 * - 前端打字机效果平滑无闪烁
 */
export async function executeAgentStream(
  params: ExecuteAgentParams,
  agentId: string,
  agentName: string,
  encoder: TextEncoder,
  safeEnqueue: (data: Uint8Array) => boolean,
): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  const {
    systemPrompt,
    userPrompt,
    maxSteps = 5,
    temperature = 0.7,
  } = params;

  const { default: OpenAI } = await import('openai');
  
  const pool = getApiKeyPool();
  const { keyId, apiKey } = await pool.acquireKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const modelName = process.env.OPENAI_MODEL || 'deepseek-chat';

  const openai = new OpenAI({ apiKey, baseURL });

  logger.info({ model: modelName, agent: agentName, maxSteps }, '[agentExecutor] Starting execution');

  // 封装执行逻辑，确保 Key 始终被释放
  try {
    return await doExecuteAgentStream(
      params, agentId, agentName, encoder, safeEnqueue,
      openai, modelName, pool, keyId,
    );
  } catch (error) {
    pool.reportFailure(keyId, error);
    throw error;
  } finally {
    pool.releaseKey(keyId);
  }
}

/** 内部执行逻辑（Key 生命周期由外层管理） */
async function doExecuteAgentStream(
  params: ExecuteAgentParams,
  agentId: string,
  agentName: string,
  encoder: TextEncoder,
  safeEnqueue: (data: Uint8Array) => boolean,
  openai: any,
  modelName: string,
  pool: ReturnType<typeof getApiKeyPool>,
  keyId: string,
): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  const {
    systemPrompt,
    userPrompt,
    maxSteps = 5,
    temperature = 0.7,
  } = params;

  const messages: Array<any> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let fullText = '';
  const allToolCalls: ToolCallRecord[] = [];
  let stepsRemaining = maxSteps;

  while (stepsRemaining > 0) {
    stepsRemaining--;

    // 最后一轮不传 tools，强制模型生成文本回复
    const offerTools = stepsRemaining > 0;

    const stream = await openai.chat.completions.create({
      model: modelName,
      messages,
      ...(offerTools ? { tools: openaiTools } : {}),
      stream: true,
      temperature,
      max_tokens: 1500,
    });

    let stepContent = '';
    const pendingToolCalls: Map<number, {
      id: string;
      name: string;
      arguments: string;
    }> = new Map();

    // DSML + SENTIMENT 防泄露缓冲
    // 保留末尾内容用于检测 DSML 和 [SENTIMENT] 标签
    const HOLD_BUFFER_SIZE = 40;
    let chunkSendBuffer = '';
    let contentBlocked = false; // DSML 或 SENTIMENT 被检测到后停止发送

    const flushChunk = (text: string): boolean => {
      if (!text) return true;
      return safeEnqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'chunk', agentId, content: text })}\n\n`
      ));
    };

    // DSML 检测正则
    const dsmlPatternRegex = /<[|｜\s]*(?:DSML[|｜\s]*)?(?:function_calls|tool_call)/i;
    // SENTIMENT 检测
    const sentimentPattern = '[SENTIMENT]';

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      // 处理文本内容
      if (delta?.content) {
        stepContent += delta.content;
        fullText += delta.content;

        if (contentBlocked) {
          // 已检测到 DSML 或 SENTIMENT，后续文本不发送到前端
          continue;
        }

        chunkSendBuffer += delta.content;

        // 检查 DSML
        const dsmlMatch = chunkSendBuffer.search(dsmlPatternRegex);
        if (dsmlMatch !== -1) {
          const safeContent = chunkSendBuffer.substring(0, dsmlMatch);
          contentBlocked = true;
          chunkSendBuffer = '';
          if (safeContent && !flushChunk(safeContent)) {
            return { text: fullText, toolCalls: allToolCalls };
          }
          continue;
        }

        // 检查 [SENTIMENT]
        const sentimentIdx = chunkSendBuffer.indexOf(sentimentPattern);
        if (sentimentIdx !== -1) {
          const safeContent = chunkSendBuffer.substring(0, sentimentIdx);
          contentBlocked = true;
          chunkSendBuffer = '';
          if (safeContent && !flushChunk(safeContent)) {
            return { text: fullText, toolCalls: allToolCalls };
          }
          continue;
        }

        // 缓冲区足够大且无特殊标记 — 发送安全部分
        if (chunkSendBuffer.length > HOLD_BUFFER_SIZE) {
          const sendLength = chunkSendBuffer.length - HOLD_BUFFER_SIZE;
          const toSend = chunkSendBuffer.substring(0, sendLength);
          chunkSendBuffer = chunkSendBuffer.substring(sendLength);
          if (!flushChunk(toSend)) {
            return { text: fullText, toolCalls: allToolCalls };
          }
        }
      }

      // 处理工具调用（流式累积参数）
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!pendingToolCalls.has(idx)) {
            pendingToolCalls.set(idx, {
              id: tc.id || '',
              name: tc.function?.name || '',
              arguments: '',
            });
          }
          const pending = pendingToolCalls.get(idx)!;
          if (tc.id) pending.id = tc.id;
          if (tc.function?.name) pending.name = tc.function.name;
          if (tc.function?.arguments) pending.arguments += tc.function.arguments;
        }
      }
    }

    // 流式结束后：刷新缓冲区中剩余的安全内容
    if (!contentBlocked && chunkSendBuffer) {
      // 最终刷新前也要检查是否包含 [SENTIMENT]
      const finalSentimentIdx = chunkSendBuffer.indexOf(sentimentPattern);
      if (finalSentimentIdx !== -1) {
        const safeContent = chunkSendBuffer.substring(0, finalSentimentIdx);
        if (safeContent && !flushChunk(safeContent)) {
          return { text: fullText, toolCalls: allToolCalls };
        }
      } else {
        if (!flushChunk(chunkSendBuffer)) {
          return { text: fullText, toolCalls: allToolCalls };
        }
      }
      chunkSendBuffer = '';
    }

    // 检测 DSML 文本格式的函数调用（DeepSeek 原生格式回退）
    if (pendingToolCalls.size === 0) {
      const dsmlParsed = parseDsmlToolCalls(stepContent);
      if (dsmlParsed && dsmlParsed.toolCalls.length > 0) {
        logger.debug({ agent: agentName, tools: dsmlParsed.toolCalls.map(t => t.name) }, '[agentExecutor] Detected DSML function calls');
        // Strip DSML from fullText
        const dsmlStartInFull = fullText.search(/<[^>]*function_calls[^>]*>/i);
        if (dsmlStartInFull >= 0) {
          fullText = fullText.substring(0, dsmlStartInFull).trim();
        }
        stepContent = dsmlParsed.cleanText;

        // 不再发送 content_replace —— done 事件会提供最终干净内容

        // Convert parsed DSML calls to pendingToolCalls
        for (let i = 0; i < dsmlParsed.toolCalls.length; i++) {
          const tc = dsmlParsed.toolCalls[i];
          pendingToolCalls.set(i, {
            id: `dsml_${Date.now()}_${i}`,
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          });
        }
      }
    }

    // 如果没有工具调用，说明模型直接生成了最终回复
    if (pendingToolCalls.size === 0) {
      break;
    }

    // 有工具调用：构建 assistant 消息
    const assistantToolCalls = Array.from(pendingToolCalls.values()).map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: tc.arguments,
      },
    }));

    messages.push({
      role: 'assistant',
      content: stepContent || null,
      tool_calls: assistantToolCalls,
    });

    // 执行每个工具调用
    for (const tc of assistantToolCalls) {
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      // 发送 tool_call SSE 事件
      if (!safeEnqueue(encoder.encode(
        `data: ${JSON.stringify({
          type: 'tool_call',
          agentId,
          toolName: tc.function.name,
          args,
        })}\n\n`
      ))) {
        return { text: fullText, toolCalls: allToolCalls };
      }

      // 执行工具
      let toolResult: any;
      try {
        toolResult = await executeTool(tc.function.name, args);
      } catch (err) {
        toolResult = { error: err instanceof Error ? err.message : 'Tool execution failed' };
      }

      // 发送 tool_result SSE 事件
      if (!safeEnqueue(encoder.encode(
        `data: ${JSON.stringify({
          type: 'tool_result',
          agentId,
          toolName: tc.function.name,
          result: toolResult,
        })}\n\n`
      ))) {
        return { text: fullText, toolCalls: allToolCalls };
      }

      allToolCalls.push({
        toolName: tc.function.name,
        args,
        result: toolResult,
      });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(toolResult),
      });
    }

    // 如果已无剩余步骤，强制追加一轮无工具调用来生成最终回复
    if (stepsRemaining === 0) {
      logger.info({ agent: agentName }, '[agentExecutor] maxSteps reached, forcing final text generation');
      try {
        const finalStream = await openai.chat.completions.create({
          model: modelName,
          messages,
          stream: true,
          temperature,
          max_tokens: 1500,
        });
        for await (const chunk of finalStream) {
          const choice = chunk.choices[0];
          if (!choice) continue;
          if (choice.delta?.content) {
            fullText += choice.delta.content;
            if (!safeEnqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'chunk', agentId, content: choice.delta.content })}\n\n`
            ))) {
              return { text: fullText, toolCalls: allToolCalls };
            }
          }
        }
      } catch (err) {
        logger.error({ err, agent: agentName }, '[agentExecutor] Final generation error');
      }
    }

    logger.debug({ agent: agentName, toolCount: assistantToolCalls.length }, '[agentExecutor] Tools executed, continuing');
  }

  // 最终防线：无条件清理 fullText 中可能残留的 DSML 标记
  const dsmlFinalClean = fullText.search(/<[|｜\s]*(?:DSML[|｜\s]*)?(?:function_calls|tool_call|invoke)/i);
  if (dsmlFinalClean >= 0) {
    logger.debug({ agent: agentName, stripPosition: dsmlFinalClean }, '[agentExecutor] Stripping residual DSML');
    fullText = fullText.substring(0, dsmlFinalClean).trim();
  }

  logger.info({ agent: agentName, textLength: fullText.length, toolCallCount: allToolCalls.length }, '[agentExecutor] Execution complete');
  pool.reportSuccess(keyId);
  return { text: fullText, toolCalls: allToolCalls };
}
