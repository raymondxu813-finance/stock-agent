// /lib/agentExecutor.ts

/**
 * Agent Executor - 使用原生 OpenAI SDK 实现带工具调用的 Agent 执行器
 * 
 * 使用与 llmClient.ts 相同的原生 openai SDK，确保与 DeepSeek 兼容。
 * 支持流式输出 + 工具调用（function calling）+ 多步对话。
 */

/**
 * API Key 轮询管理（复用 llmClient 的多 key 负载均衡逻辑）
 */
let currentKeyIndex = 0;

function getApiKeys(): string[] {
  const envApiKeys = process.env.OPENAI_API_KEYS || '';
  const envApiKey = process.env.OPENAI_API_KEY || '';

  if (envApiKeys) {
    return envApiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  if (envApiKey) {
    return [envApiKey];
  }
  return [];
}

function getNextApiKey(): string {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error('[agentExecutor] No API keys configured. Set OPENAI_API_KEY or OPENAI_API_KEYS in .env.local');
  }
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
}

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
  {
    type: 'function',
    function: {
      name: 'getKlineData',
      description: '获取股票的K线数据和技术指标分析，包括均线(MA)、MACD、RSI、KDJ等常用技术指标',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: '股票代码或名称，如 "比亚迪"、"600519"',
          },
          period: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description: 'K线周期：日线/周线/月线',
          },
          indicators: {
            type: 'array',
            items: { type: 'string' },
            description: '需要的技术指标，如 ["MA5","MA20","MACD","RSI","KDJ"]',
          },
        },
        required: ['symbol'],
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
    // (DeepSeek's native format may use different names than our definitions)
    const mappedName = mapDsmlToolName(name);
    const mappedArgs = mapDsmlToolArgs(mappedName, args);
    toolCalls.push({ name: mappedName, args: mappedArgs });
  }

  return toolCalls.length > 0 ? { cleanText, toolCalls } : null;
}

/**
 * Map DSML tool names to our actual tool names.
 * DeepSeek may hallucinate different tool names in its DSML output.
 */
function mapDsmlToolName(name: string): string {
  const nameMap: Record<string, string> = {
    // K线/技术分析相关的别名 → getKlineData
    'analyzeKLineData': 'getKlineData',
    'analyzeKline': 'getKlineData',
    'getKLine': 'getKlineData',
    'getKLineData': 'getKlineData',
    'klineData': 'getKlineData',
    'get_kline_data': 'getKlineData',
    'analyze_kline_data': 'getKlineData',
    // 股价查询别名 → getStockPrice
    'queryStockPrice': 'getStockPrice',
    'get_stock_price': 'getStockPrice',
    'stockPrice': 'getStockPrice',
    // 新闻查询别名 → getLatestNews
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
      // DSML: keyword → query, count → limit
      if (mapped.keyword && !mapped.query) { mapped.query = mapped.keyword; delete mapped.keyword; }
      if (mapped.count !== undefined && mapped.limit === undefined) { mapped.limit = mapped.count; delete mapped.count; }
      break;
    case 'getStockPrice':
      // DSML might use: name, stock_name, stock, stock_code → symbol
      if (!mapped.symbol) {
        const alt = mapped.name || mapped.stock_name || mapped.stock || mapped.stock_code;
        if (alt) { mapped.symbol = alt; delete mapped.name; delete mapped.stock_name; delete mapped.stock; delete mapped.stock_code; }
      }
      break;
    case 'getKlineData':
      // DSML might use: name, stock, stock_name → symbol
      if (!mapped.symbol) {
        const alt = mapped.name || mapped.stock || mapped.stock_name;
        if (alt) { mapped.symbol = alt; delete mapped.name; delete mapped.stock; delete mapped.stock_name; }
      }
      break;
  }

  return mapped;
}

/**
 * 执行工具调用（调用 tools 目录下对应的 execute 函数）
 */
async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  // 动态导入工具模块（保持服务端专用）
  switch (name) {
    case 'getStockPrice': {
      const { getStockPrice } = await import('./tools/stockPrice');
      return getStockPrice.execute(args as any);
    }
    case 'getLatestNews': {
      const { getLatestNews } = await import('./tools/news');
      return getLatestNews.execute({ limit: 3, ...args } as any);
    }
    case 'getKlineData': {
      const { getKlineData } = await import('./tools/kline');
      return getKlineData.execute({ period: 'daily', ...args } as any);
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

  // 动态导入 OpenAI SDK
  const { default: OpenAI } = await import('openai');
  
  const apiKey = getNextApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const modelName = process.env.OPENAI_MODEL || 'deepseek-chat';

  const openai = new OpenAI({ apiKey, baseURL });

  console.log(`[agentExecutor] Starting: model=${modelName}, agent=${agentName}, maxSteps=${maxSteps}`);

  // 构建消息历史（多步工具调用时会追加）
  const messages: Array<any> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let fullText = '';
  const allToolCalls: ToolCallRecord[] = [];
  let stepsRemaining = maxSteps;

  while (stepsRemaining > 0) {
    stepsRemaining--;

    // 最后一轮不传 tools，强制模型生成文本回复（避免无限工具调用循环）
    const offerTools = stepsRemaining > 0;

    // 调用 OpenAI API（流式）
    const stream = await openai.chat.completions.create({
      model: modelName,
      messages,
      ...(offerTools ? { tools: openaiTools } : {}),
      stream: true,
      temperature,
      max_tokens: 1500,
    });

    // 收集本轮的文本和工具调用
    let stepContent = '';
    const pendingToolCalls: Map<number, {
      id: string;
      name: string;
      arguments: string;
    }> = new Map();

    // DSML 防泄露：缓冲末尾内容，确保 DSML 标签不会被发送到前端
    const HOLD_BUFFER_SIZE = 30;
    let chunkSendBuffer = '';
    let dsmlBlocked = false;

    // 安全地发送一段文本作为 chunk 事件
    const flushChunk = (text: string): boolean => {
      if (!text) return true;
      return safeEnqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'chunk', agentId, content: text })}\n\n`
      ));
    };

    // DSML 检测正则：匹配 <|DSML|function_calls> 或类似变体
    const dsmlPatternRegex = /<[|｜\s]*(?:DSML[|｜\s]*)?(?:function_calls|tool_call)/i;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      // 处理文本内容（带 DSML 缓冲）
      if (delta?.content) {
        stepContent += delta.content;
        fullText += delta.content;

        if (dsmlBlocked) {
          // 已检测到 DSML，后续文本不再发送到前端
          continue;
        }

        chunkSendBuffer += delta.content;

        // 检查缓冲区是否包含 DSML 模式
        const dsmlMatch = chunkSendBuffer.search(dsmlPatternRegex);
        if (dsmlMatch !== -1) {
          // 确认检测到 DSML — 只发送 DSML 之前的安全内容
          const safeContent = chunkSendBuffer.substring(0, dsmlMatch);
          dsmlBlocked = true;
          chunkSendBuffer = '';
          if (safeContent && !flushChunk(safeContent)) {
            return { text: fullText, toolCalls: allToolCalls };
          }
        } else if (chunkSendBuffer.length > HOLD_BUFFER_SIZE) {
          // 缓冲区足够大且无 DSML — 发送安全部分，保留末尾用于检测
          const sendLength = chunkSendBuffer.length - HOLD_BUFFER_SIZE;
          const toSend = chunkSendBuffer.substring(0, sendLength);
          chunkSendBuffer = chunkSendBuffer.substring(sendLength);
          if (!flushChunk(toSend)) {
            return { text: fullText, toolCalls: allToolCalls };
          }
        }
        // 否则缓冲区太小，继续持有
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
    if (!dsmlBlocked && chunkSendBuffer) {
      if (!flushChunk(chunkSendBuffer)) {
        return { text: fullText, toolCalls: allToolCalls };
      }
      chunkSendBuffer = '';
    }

    // 检测 DSML 文本格式的函数调用（DeepSeek 原生格式回退）
    // 当模型输出 <|DSML|function_calls>...</|DSML|function_calls> 作为文本而非 tool_calls 时
    if (pendingToolCalls.size === 0) {
      const dsmlParsed = parseDsmlToolCalls(stepContent);
      if (dsmlParsed && dsmlParsed.toolCalls.length > 0) {
        console.log(`[agentExecutor] Agent ${agentName}: detected DSML text-based function calls: ${dsmlParsed.toolCalls.map(t => t.name).join(', ')}`);
        // Strip DSML from fullText
        const dsmlStartInFull = fullText.search(/<[^>]*function_calls[^>]*>/i);
        if (dsmlStartInFull >= 0) {
          fullText = fullText.substring(0, dsmlStartInFull).trim();
        }
        // Also clean stepContent for the assistant message
        stepContent = dsmlParsed.cleanText;

        // 发送 content_replace 事件，让前端修正已显示的内容（防止残留 DSML 文本）
        safeEnqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'content_replace', agentId, content: fullText })}\n\n`
        ));

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

    // 有工具调用：构建 assistant 消息（包含工具调用信息）
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

      // 记录工具调用
      allToolCalls.push({
        toolName: tc.function.name,
        args,
        result: toolResult,
      });

      // 追加 tool 响应到消息历史
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(toolResult),
      });
    }

    // 如果已无剩余步骤，强制追加一轮无工具调用来生成最终回复
    if (stepsRemaining === 0) {
      console.log(`[agentExecutor] Agent ${agentName}: maxSteps reached after tools, forcing final text generation...`);
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
        console.error(`[agentExecutor] Agent ${agentName}: final generation error:`, err);
      }
    }

    // 继续循环，让模型基于工具结果生成下一步回复
    console.log(`[agentExecutor] Agent ${agentName}: ${assistantToolCalls.length} tool(s) executed, continuing...`);
  }

  console.log(`[agentExecutor] Agent ${agentName}: done, text=${fullText.length} chars, tools=${allToolCalls.length}`);
  return { text: fullText, toolCalls: allToolCalls };
}
