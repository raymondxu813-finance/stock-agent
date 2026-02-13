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

// ==================== 主持人总结文本解析 ====================

/**
 * 主持人总结段落名称类型
 * v2: 新增 '话题维度对比' | '共识与共识程度' | '分歧与对立观点' | '亮眼观点'
 * 保留旧段落名用于向后兼容
 */
export type ModeratorSection =
  | '总体概述'
  | '核心观点'           // 旧版，保留兼容
  | '已达成共识'         // 旧版，保留兼容
  | '分歧焦点'           // 旧版，保留兼容
  | '话题维度对比'       // v2 新增
  | '共识与共识程度'     // v2 新增（替代已达成共识）
  | '分歧与对立观点'     // v2 新增（替代分歧焦点）
  | '亮眼观点'           // v2 新增
  | '共识度'
  | '情绪汇总';

/** 所有可识别的段落名列表（新旧都包含） */
const ALL_SECTION_NAMES = [
  '总体概述', '核心观点', '已达成共识', '分歧焦点',
  '话题维度对比', '共识与共识程度', '分歧与对立观点', '亮眼观点',
  '共识度', '情绪汇总',
];
const SECTION_REGEX = new RegExp(`【(${ALL_SECTION_NAMES.join('|')})】`, 'g');

/**
 * 从主持人流式输出中解析【段落】标记，返回段落映射
 */
export function parseModeratorSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  
  const regex = new RegExp(SECTION_REGEX.source, 'g');
  const matches: Array<{ name: string; index: number }> = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ name: match[1], index: match.index });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].name.length + 2; // skip 【name】
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.substring(start, end).trim();
    sections.set(matches[i].name, content);
  }
  
  return sections;
}

/**
 * 检测当前正在流式输出的段落名称
 */
export function getCurrentStreamingSection(text: string): ModeratorSection | null {
  const regex = new RegExp(SECTION_REGEX.source, 'g');
  let lastMatch: ModeratorSection | null = null;
  let match;
  while ((match = regex.exec(text)) !== null) {
    lastMatch = match[1] as ModeratorSection;
  }
  return lastMatch;
}

import type { TopicComparisonItem, HighlightInsight, ConsensusItem, DisagreementItem } from '@/types';

/**
 * 将主持人结构化文本输出转换为 ModeratorAnalysis 类型
 * 用于流式输出完成后生成最终的结构化数据
 * 
 * v2: 支持新段落（话题维度对比、共识与共识程度、分歧与对立观点、亮眼观点），
 *     同时 fallback 兼容旧段落名。
 */
export function convertModeratorTextToAnalysis(
  text: string,
  roundIndex: number,
  totalAgents: number,
): {
  round: number;
  consensusLevel: number;
  summary: string;
  newPoints: string[];
  topicComparisons?: TopicComparisonItem[];
  consensus: ConsensusItem[];
  disagreements: DisagreementItem[];
  highlights?: HighlightInsight[];
  sentimentSummary?: Array<{ stock: string; bullishAgents: string[]; bearishAgents: string[]; neutralAgents: string[]; overallSentiment: 'bullish' | 'bearish' | 'neutral' }>;
} {
  const sections = parseModeratorSections(text);
  
  // 总体概述
  const summary = sections.get('总体概述') || '本轮讨论已完成';
  
  // 共识度
  const consensusText = sections.get('共识度') || '50';
  const consensusLevel = Math.min(100, Math.max(0, parseInt(consensusText.trim()) || 50));
  
  // === 话题维度对比（v2 新增） ===
  const topicComparisonText = sections.get('话题维度对比') || '';
  const topicComparisons = parseTopicComparisonSection(topicComparisonText);
  
  // === newPoints: 从话题维度对比的维度名称降级生成，fallback 到旧【核心观点】 ===
  let newPoints: string[] = [];
  if (topicComparisons.length > 0) {
    newPoints = topicComparisons.map(tc => tc.topic);
  } else {
    const corePoints = sections.get('核心观点') || '';
    newPoints = corePoints
      .split('\n')
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 5);
  }
  
  // === 共识: 优先用 v2【共识与共识程度】, fallback【已达成共识】 ===
  const enhancedConsensusText = sections.get('共识与共识程度') || '';
  const legacyConsensusText = sections.get('已达成共识') || '';
  const consensus = enhancedConsensusText
    ? parseEnhancedConsensusSection(enhancedConsensusText, totalAgents)
    : parseLegacyConsensusSection(legacyConsensusText, totalAgents);
  
  // === 分歧: 优先用 v2【分歧与对立观点】, fallback【分歧焦点】 ===
  const enhancedDisagreementsText = sections.get('分歧与对立观点') || '';
  const legacyDisagreementsText = sections.get('分歧焦点') || '';
  const disagreements = enhancedDisagreementsText
    ? parseEnhancedDisagreementsSection(enhancedDisagreementsText)
    : parseLegacyDisagreementsSection(legacyDisagreementsText);
  
  // === 亮眼观点（v2 新增） ===
  const highlightsText = sections.get('亮眼观点') || '';
  const highlights = parseHighlightsSection(highlightsText);
  
  // 情绪汇总
  const sentimentText = sections.get('情绪汇总') || '';
  const sentimentSummary = parseSentimentSummarySection(sentimentText);
  
  return {
    round: roundIndex,
    consensusLevel,
    summary,
    newPoints: newPoints.length > 0 ? newPoints : ['暂无新观点'],
    topicComparisons: topicComparisons.length > 0 ? topicComparisons : undefined,
    consensus,
    disagreements,
    highlights: highlights.length > 0 ? highlights : undefined,
    sentimentSummary: sentimentSummary.length > 0 ? sentimentSummary : undefined,
  };
}

// ==================== v2 新增解析函数 ====================

/**
 * 解析【话题维度对比】段落
 * 
 * 格式:
 * 维度1：{议题名称}
 * - AgentA：{观点摘要}
 * - AgentB：{观点摘要}
 * → 趋同度：高/中/低
 */
function parseTopicComparisonSection(text: string): TopicComparisonItem[] {
  if (!text || text.trim().length === 0) return [];
  
  const result: TopicComparisonItem[] = [];
  
  // 按"维度N："分割
  const dimensionBlocks = text.split(/(?=维度\d+[：:])/);
  
  for (const block of dimensionBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;
    
    // 第一行: "维度N：{议题名称}" 或直接是议题名称
    const topicLine = lines[0];
    const topicMatch = topicLine.match(/^维度\d+[：:]\s*(.+)/);
    const topic = topicMatch ? topicMatch[1].trim() : topicLine.trim();
    if (!topic) continue;
    
    const agentPositions: Array<{ agentName: string; position: string }> = [];
    let convergenceLevel: 'high' | 'medium' | 'low' = 'medium';
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      // 趋同度行: "→ 趋同度：高/中/低"
      const convergenceMatch = line.match(/→?\s*趋同度[：:]\s*(高|中|低)/);
      if (convergenceMatch) {
        const level = convergenceMatch[1];
        convergenceLevel = level === '高' ? 'high' : level === '低' ? 'low' : 'medium';
        continue;
      }
      
      // Agent 立场行: "- AgentName：{观点}" 或 "- AgentName: {观点}"
      const agentMatch = line.match(/^[-•]\s*(.+?)[：:]\s*(.+)/);
      if (agentMatch) {
        agentPositions.push({
          agentName: agentMatch[1].trim(),
          position: agentMatch[2].trim(),
        });
      }
    }
    
    if (agentPositions.length > 0) {
      result.push({ topic, agentPositions, convergenceLevel });
    }
  }
  
  return result;
}

/**
 * 解析 v2【共识与共识程度】段落
 * 
 * 格式:
 * 1. {共识内容}
 *    - 共识程度：强共识/中等共识/弱共识
 *    - 支持Agent：AgentA、AgentB
 *    - 依据概述：{...}
 */
export function parseEnhancedConsensusSection(text: string, totalAgents: number): ConsensusItem[] {
  if (!text || text.includes('暂无明确共识')) return [];
  
  const result: ConsensusItem[] = [];
  
  // 按编号分割多条共识
  const items = text.split(/(?=^\d+\.\s)/m).filter(s => s.trim().length > 0);
  
  for (const item of items) {
    const lines = item.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;
    
    // 第一行: "1. {共识内容}"
    const content = lines[0].replace(/^\d+\.\s*/, '').trim();
    if (!content) continue;
    
    let strength: 'strong' | 'medium' | 'weak' = 'medium';
    let agents: string[] = [];
    let reasoning = '';
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/^[-•]\s*/, '');
      
      // 共识程度
      const strengthMatch = line.match(/共识程度[：:]\s*(强共识|中等共识|弱共识)/);
      if (strengthMatch) {
        const s = strengthMatch[1];
        strength = s === '强共识' ? 'strong' : s === '弱共识' ? 'weak' : 'medium';
        continue;
      }
      
      // 支持Agent
      const agentMatch = line.match(/支持\s*Agent[：:]\s*(.+)/);
      if (agentMatch) {
        agents = agentMatch[1].split(/[、,，]/).map(a => a.trim()).filter(a => a.length > 0);
        continue;
      }
      
      // 依据概述
      const reasonMatch = line.match(/依据概述[：:]\s*(.+)/);
      if (reasonMatch) {
        reasoning = reasonMatch[1].trim();
        continue;
      }
    }
    
    result.push({
      content,
      agents,
      percentage: totalAgents > 0 ? Math.round((agents.length / totalAgents) * 100) : 0,
      strength,
      reasoning: reasoning || undefined,
    });
  }
  
  return result;
}

/**
 * 解析 v2【分歧与对立观点】段落
 * 
 * 格式:
 * 1. {分歧议题}
 *    - 分歧性质：根本性分歧/策略性分歧/程度性分歧
 *    - 立场A：{观点}（AgentX、AgentY）
 *    - 立场B：{观点}（AgentZ）
 *    - 分歧根源：{...}
 */
export function parseEnhancedDisagreementsSection(text: string): DisagreementItem[] {
  if (!text || text.includes('暂无明显分歧')) return [];
  
  const result: DisagreementItem[] = [];
  
  // 按编号分割多条分歧
  const items = text.split(/(?=^\d+\.\s)/m).filter(s => s.trim().length > 0);
  
  for (const item of items) {
    const lines = item.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;
    
    // 第一行: "1. {分歧议题}"
    const topic = lines[0].replace(/^\d+\.\s*/, '').trim();
    if (!topic) continue;
    
    let nature: 'fundamental' | 'strategic' | 'degree' | undefined;
    const sides: Array<{ position: string; agents: Array<{ name: string; color: string }> }> = [];
    let rootCause = '';
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/^[-•]\s*/, '');
      
      // 分歧性质
      const natureMatch = line.match(/分歧性质[：:]\s*(根本性分歧|策略性分歧|程度性分歧)/);
      if (natureMatch) {
        const n = natureMatch[1];
        nature = n === '根本性分歧' ? 'fundamental' : n === '策略性分歧' ? 'strategic' : 'degree';
        continue;
      }
      
      // 立场行: "立场A：{观点}（AgentX、AgentY）"
      const sideMatch = line.match(/立场[A-Za-z][：:]\s*(.+)/);
      if (sideMatch) {
        const sideText = sideMatch[1];
        // 提取括号中的 Agent 名称
        const agentBracketMatch = sideText.match(/[（(]([^）)]+)[）)]/);
        const position = agentBracketMatch
          ? sideText.substring(0, sideText.indexOf(agentBracketMatch[0])).trim()
          : sideText.trim();
        const agentNames = agentBracketMatch
          ? agentBracketMatch[1].split(/[、,，]/).map(a => a.trim()).filter(a => a.length > 0)
          : [];
        
        sides.push({
          position,
          agents: agentNames.map(name => ({ name, color: 'bg-gray-500' })),
        });
        continue;
      }
      
      // 分歧根源
      const rootMatch = line.match(/分歧根源[：:]\s*(.+)/);
      if (rootMatch) {
        rootCause = rootMatch[1].trim();
        continue;
      }
    }
    
    // 构建向后兼容的 supportAgents / opposeAgents
    const supportAgents = sides.length > 0 ? sides[0].agents : [];
    const opposeAgents = sides.length > 1 ? sides[1].agents : [];
    const description = sides.map(s => {
      const agentStr = s.agents.map(a => a.name).join('、');
      return `${s.position}（${agentStr}）`;
    }).join(' vs ');
    
    result.push({
      topic,
      description,
      nature,
      supportAgents,
      opposeAgents,
      sides: sides.length > 0 ? sides : undefined,
      rootCause: rootCause || undefined,
    });
  }
  
  return result;
}

/**
 * 解析【亮眼观点】段落
 * 
 * 格式:
 * 1. {观点描述}
 *    - 提出者：AgentX
 *    - 认同Agent：AgentY、AgentZ
 *    - 亮点说明：{...}
 */
function parseHighlightsSection(text: string): HighlightInsight[] {
  if (!text || text.includes('暂无特别亮眼') || text.includes('暂无亮眼')) return [];
  
  const result: HighlightInsight[] = [];
  
  // 按编号分割
  const items = text.split(/(?=^\d+\.\s)/m).filter(s => s.trim().length > 0);
  
  for (const item of items) {
    const lines = item.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;
    
    // 第一行: "1. {观点描述}"
    const content = lines[0].replace(/^\d+\.\s*/, '').trim();
    if (!content) continue;
    
    let agentName = '';
    let supportingAgents: string[] = [];
    let reason = '';
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/^[-•]\s*/, '');
      
      const proposerMatch = line.match(/提出者[：:]\s*(.+)/);
      if (proposerMatch) {
        agentName = proposerMatch[1].trim();
        continue;
      }
      
      const supportMatch = line.match(/认同\s*Agent[：:]\s*(.+)/);
      if (supportMatch) {
        const supportText = supportMatch[1].trim();
        if (supportText !== '无' && supportText !== '暂无') {
          supportingAgents = supportText.split(/[、,，]/).map(a => a.trim()).filter(a => a.length > 0);
        }
        continue;
      }
      
      const reasonMatch = line.match(/亮点说明[：:]\s*(.+)/);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
        continue;
      }
    }
    
    if (content && agentName) {
      result.push({ content, agentName, supportingAgents, reason });
    }
  }
  
  return result;
}

// ==================== 旧版解析函数（向后兼容） ====================

/**
 * 解析旧版【已达成共识】段落
 */
export function parseLegacyConsensusSection(text: string, totalAgents: number): ConsensusItem[] {
  if (!text || text.includes('暂无明确共识')) return [];
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const result: ConsensusItem[] = [];
  
  for (const line of lines) {
    const cleaned = line.replace(/^\d+\.\s*/, '').trim();
    if (!cleaned) continue;
    
    const agentMatch = cleaned.match(/[（(](?:支持(?:的Agent)?[：:]?\s*)?([^）)]+)[）)]/);
    const agents: string[] = [];
    let content = cleaned;
    
    if (agentMatch) {
      content = cleaned.substring(0, cleaned.indexOf(agentMatch[0])).trim();
      const agentStr = agentMatch[1];
      agents.push(...agentStr.split(/[、,，]/).map(a => a.trim()).filter(a => a.length > 0));
    }
    
    if (content) {
      result.push({
        content,
        agents,
        percentage: totalAgents > 0 ? Math.round((agents.length / totalAgents) * 100) : 0,
      });
    }
  }
  
  return result;
}

/**
 * 解析旧版【分歧焦点】段落
 */
export function parseLegacyDisagreementsSection(text: string): DisagreementItem[] {
  if (!text || text.includes('暂无明显分歧')) return [];
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const result: DisagreementItem[] = [];
  
  for (const line of lines) {
    const cleaned = line.replace(/^\d+\.\s*/, '').trim();
    if (!cleaned) continue;
    
    const vsSplit = cleaned.split(/\s+vs\.?\s+/i);
    
    if (vsSplit.length >= 2) {
      const colonIdx = vsSplit[0].indexOf('：');
      const topic = colonIdx !== -1 ? vsSplit[0].substring(0, colonIdx).trim() : vsSplit[0].trim();
      const supportText = colonIdx !== -1 ? vsSplit[0].substring(colonIdx + 1).trim() : '';
      const opposeText = vsSplit.slice(1).join(' vs ').trim();
      
      const supportAgentNames = extractAgentNames(supportText);
      const opposeAgentNames = extractAgentNames(opposeText);
      
      result.push({
        topic,
        description: `${supportText} vs ${opposeText}`,
        supportAgents: supportAgentNames.map(name => ({ name, color: 'bg-gray-500' })),
        opposeAgents: opposeAgentNames.map(name => ({ name, color: 'bg-gray-500' })),
      });
    } else {
      const colonIdx = cleaned.indexOf('：');
      const topic = colonIdx !== -1 ? cleaned.substring(0, colonIdx).trim() : cleaned;
      const description = colonIdx !== -1 ? cleaned.substring(colonIdx + 1).trim() : '';
      
      result.push({
        topic,
        description,
        supportAgents: [],
        opposeAgents: [],
      });
    }
  }
  
  return result;
}

/**
 * 从文本中提取Agent名称（括号内的名称）
 */
function extractAgentNames(text: string): string[] {
  const match = text.match(/[（(]([^）)]+)[）)]/);
  if (match) {
    return match[1].split(/[、,，]/).map(a => a.trim()).filter(a => a.length > 0);
  }
  return [];
}

/**
 * 解析【情绪汇总】段落
 */
export function parseSentimentSummarySection(text: string): Array<{ stock: string; bullishAgents: string[]; bearishAgents: string[]; neutralAgents: string[]; overallSentiment: 'bullish' | 'bearish' | 'neutral' }> {
  if (!text || text.includes('不涉及具体标的')) return [];
  
  const lines = text.split('\n').filter(line => line.trim().length > 0 && line.trim().startsWith('-'));
  const result: Array<{ stock: string; bullishAgents: string[]; bearishAgents: string[]; neutralAgents: string[]; overallSentiment: 'bullish' | 'bearish' | 'neutral' }> = [];
  
  for (const line of lines) {
    const cleaned = line.replace(/^[-•]\s*/, '').trim();
    // 格式: "标的名称：看涨(A, B) / 看跌(C) / 中性(D) → 整体偏看涨"
    const colonIdx = cleaned.indexOf('：');
    if (colonIdx === -1) continue;
    
    // 保留 "中文简称(股票代码)" 格式，仅清理常见后缀
    const rawStock = cleaned.substring(0, colonIdx).trim();
    // 提取括号中的股票代码（如果有）
    const tickerMatch = rawStock.match(/[（(]([A-Za-z0-9.]+)[）)]/);
    const ticker = tickerMatch?.[1];
    // 提取中文核心名
    let cnName = rawStock.replace(/[（(][^）)]*[）)]/g, '').trim();
    cnName = cnName.replace(/(公司|集团|控股|股份有限|有限|股份)$/g, '').trim();
    // 组合为统一格式
    const stock = cnName && ticker ? `${cnName}(${ticker.toUpperCase()})` : cnName || rawStock;
    const rest = cleaned.substring(colonIdx + 1);
    
    const bullishAgents: string[] = [];
    const bearishAgents: string[] = [];
    const neutralAgents: string[] = [];
    
    // 提取看涨
    const bullishMatch = rest.match(/看涨\s*[（(]([^）)]+)[）)]/);
    if (bullishMatch) {
      bullishAgents.push(...bullishMatch[1].split(/[、,，\s]+/).map(a => a.trim()).filter(a => a.length > 0));
    }
    
    // 提取看跌
    const bearishMatch = rest.match(/看跌\s*[（(]([^）)]+)[）)]/);
    if (bearishMatch) {
      bearishAgents.push(...bearishMatch[1].split(/[、,，\s]+/).map(a => a.trim()).filter(a => a.length > 0));
    }
    
    // 提取中性/中立
    const neutralMatch = rest.match(/(?:中性|中立)\s*[（(]([^）)]+)[）)]/);
    if (neutralMatch) {
      neutralAgents.push(...neutralMatch[1].split(/[、,，\s]+/).map(a => a.trim()).filter(a => a.length > 0));
    }
    
    // 判断整体情绪（统一为 3 种：看涨/中性/看跌）
    let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (rest.includes('偏看涨') || rest.includes('整体看涨')) overallSentiment = 'bullish';
    else if (rest.includes('偏看跌') || rest.includes('整体看跌')) overallSentiment = 'bearish';
    else if (bullishAgents.length > bearishAgents.length) overallSentiment = 'bullish';
    else if (bearishAgents.length > bullishAgents.length) overallSentiment = 'bearish';
    // 分歧/平局归中性
    
    result.push({ stock, bullishAgents, bearishAgents, neutralAgents, overallSentiment });
  }
  
  return result;
}
