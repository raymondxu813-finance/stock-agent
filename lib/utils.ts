import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 股票情绪分析结果
 */
export interface ParsedSentiment {
  stock: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence?: 'high' | 'medium' | 'low';
}

// ==================== [SENTIMENT] 标记解析 ====================

/**
 * 从 agent 发言内容中解析 [SENTIMENT]...[/SENTIMENT] 结构
 * 
 * Agent 会在发言正文结束后输出：
 * [SENTIMENT]
 * [{"stock":"腾讯","sentiment":"bullish","confidence":"high"}]
 * [/SENTIMENT]
 * 
 * 此函数提取 JSON 并返回结构化数据，同时返回去掉标记后的纯正文。
 * 
 * @param rawContent agent 的完整输出（正文 + [SENTIMENT] 块）
 * @returns { cleanContent: 去掉标记的正文, sentiments: 解析出的情绪数组 }
 */
export function parseSentimentBlock(rawContent: string): {
  cleanContent: string;
  sentiments: ParsedSentiment[];
} {
  // 匹配 [SENTIMENT]...[/SENTIMENT] 块
  const sentimentRegex = /\[SENTIMENT\]\s*([\s\S]*?)\s*\[\/SENTIMENT\]/i;
  const match = rawContent.match(sentimentRegex);

  if (!match) {
    // 没有 SENTIMENT 块 → 原样返回
    return { cleanContent: rawContent.trim(), sentiments: [] };
  }

  // 提取正文（SENTIMENT 标记之前的部分）
  const sentimentStartIdx = rawContent.indexOf(match[0]);
  const cleanContent = rawContent.substring(0, sentimentStartIdx).trim();

  // 解析 JSON
  const jsonStr = match[1].trim();
  try {
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { cleanContent, sentiments: [] };

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return { cleanContent, sentiments: [] };

    const sentiments: ParsedSentiment[] = parsed
      .filter((item: any) => item && item.stock && item.sentiment)
      .map((item: any) => ({
        stock: String(item.stock),
        sentiment: (['bullish', 'bearish', 'neutral'].includes(item.sentiment)
          ? item.sentiment
          : 'neutral') as 'bullish' | 'bearish' | 'neutral',
        confidence: (['high', 'medium', 'low'].includes(item.confidence)
          ? item.confidence
          : undefined) as 'high' | 'medium' | 'low' | undefined,
      }));

    return { cleanContent, sentiments };
  } catch (error) {
    console.error('[parseSentimentBlock] JSON parse error:', error);
    return { cleanContent, sentiments: [] };
  }
}

/**
 * 从流式内容中剥离 [SENTIMENT] 标记及之后的内容
 * 用于前端实时显示时隐藏情绪 JSON 部分
 * 
 * @param streamContent 当前累积的流式内容
 * @returns 去掉 [SENTIMENT] 及之后内容的纯正文
 */
export function stripSentimentFromStream(streamContent: string): string {
  // 检测 [SENTIMENT] 开始标记（可能还没输出完整）
  const idx = streamContent.indexOf('[SENTIMENT]');
  if (idx !== -1) {
    return streamContent.substring(0, idx).trim();
  }
  // 部分匹配：如果末尾正在输出 "[SENTIMEN" 等不完整标记，也截断
  // 检查末尾是否有 "[" 开头的可能是标记的部分
  const possibleStart = streamContent.lastIndexOf('\n[');
  if (possibleStart !== -1) {
    const tail = streamContent.substring(possibleStart + 1);
    if ('[SENTIMENT]'.startsWith(tail)) {
      return streamContent.substring(0, possibleStart).trim();
    }
  }
  return streamContent;
}
