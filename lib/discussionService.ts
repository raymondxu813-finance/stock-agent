// /lib/discussionService.ts

/**
 * 多 Agent 多轮讨论的核心服务逻辑
 */

import type { AgentConfig } from '../prompts/agents';
import { defaultStockAgents } from '../prompts/agents';
import {
  buildAgentSpeechUserPrompt,
  buildAgentReviewUserPrompt,
  buildRoundSummaryUserPrompt,
  buildSessionSummaryUserPrompt,
} from '../prompts/builder';
import type { RoundSummary } from '../prompts/roundSummaryPrompts';
import { roundSummarySystemPromptTemplate } from '../prompts/roundSummaryPrompts';
import type { SessionSummary } from '../prompts/sessionSummaryPrompts';
import { sessionSummarySystemPromptTemplate } from '../prompts/sessionSummaryPrompts';
import type { AgentId } from '../prompts/roundAgentPrompts';
import { llmClient } from './llmClient';

/**
 * Session 类型定义
 * 表示一个完整的讨论会话
 */
export interface Session {
  /** 会话 ID */
  id: string;
  /** 讨论话题标题 */
  topicTitle: string;
  /** 话题背景描述 */
  topicDescription: string;
  /** 用户目标 */
  userGoal: string;
  /** 参与讨论的 Agent 配置列表 */
  agents: AgentConfig[];
  /** 各轮次的总结列表 */
  rounds: RoundSummary[];
  /** 主持人 prompts 记录（按轮次索引） */
  moderatorPrompts?: Record<number, { systemPrompt: string; userPrompt: string }>;
}

/**
 * 内存存储：Session ID 到 Session 的映射
 * 注意：在 Next.js 开发模式下，模块可能会重新加载，导致内存状态丢失
 * 生产环境建议使用数据库或 Redis 等持久化存储
 */
const sessions = new Map<string, Session>();

// 导出 sessions Map 用于调试
export function getAllSessions(): Map<string, Session> {
  return sessions;
}

/**
 * 生成唯一的 Session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 从历史轮次中构造共识文本
 */
function buildHistoryConsensusText(rounds: RoundSummary[]): string {
  if (rounds.length === 0) {
    return '暂无历史讨论记录。';
  }

  const consensusList: string[] = [];
  rounds.forEach((round, index) => {
    if (round.consensus.length > 0) {
      consensusList.push(`第 ${round.roundIndex} 轮共识：`);
      round.consensus.forEach((c) => {
        consensusList.push(`- ${c.point}（支持：${c.supportingAgents.join('、')}，${c.supportCount}/${c.totalAgents}）`);
      });
    }
  });

  return consensusList.length > 0 ? consensusList.join('\n') : '暂无明确的共识点。';
}

/**
 * 从历史轮次中构造分歧文本
 */
function buildHistoryConflictText(rounds: RoundSummary[]): string {
  if (rounds.length === 0) {
    return '暂无历史讨论记录。';
  }

  const conflictList: string[] = [];
  rounds.forEach((round) => {
    if (round.conflicts.length > 0) {
      conflictList.push(`第 ${round.roundIndex} 轮分歧：`);
      round.conflicts.forEach((c) => {
        conflictList.push(`- ${c.issue}`);
        c.positions.forEach((p) => {
          conflictList.push(`  - ${p.agentName}：${p.position}`);
        });
      });
    }
  });

  return conflictList.length > 0 ? conflictList.join('\n') : '暂无明显的分歧点。';
}

/**
 * 构造历史讨论记录文本
 */
export function buildHistoryText(rounds: RoundSummary[]): string {
  if (rounds.length === 0) {
    return '这是第一轮讨论，暂无历史记录。';
  }

  const consensusText = buildHistoryConsensusText(rounds);
  const conflictText = buildHistoryConflictText(rounds);

  return `历史讨论记录：

共识点：
${consensusText}

分歧点：
${conflictText}`;
}

/**
 * 构造 Agent 简要列表文本
 */
export function buildAgentsBriefList(agents: AgentConfig[]): string {
  return agents
    .map((agent, index) => {
      return `${index + 1}. ${agent.name}（${agent.id}）：${agent.bio}`;
    })
    .join('\n');
}

/**
 * 解析 JSON 字符串为 RoundSummary
 */
export function parseRoundSummary(jsonStr: string): RoundSummary {
  try {
    // 尝试提取 JSON 部分（可能包含 markdown 代码块）
    let jsonText = jsonStr.trim();
    
    // 如果包含 markdown 代码块，提取其中的 JSON
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // 尝试直接解析
    try {
      const parsed = JSON.parse(jsonText) as RoundSummary;
      return parsed;
    } catch (parseError) {
      // 如果解析失败，尝试修复常见的 JSON 问题
      console.warn('[parseRoundSummary] Initial parse failed, attempting to fix JSON...');
      
      // 尝试提取第一个完整的 JSON 对象（从 { 到匹配的 }）
      let braceCount = 0;
      let startIndex = -1;
      let endIndex = -1;
      
      for (let i = 0; i < jsonText.length; i++) {
        if (jsonText[i] === '{') {
          if (startIndex === -1) startIndex = i;
          braceCount++;
        } else if (jsonText[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      if (startIndex !== -1 && endIndex !== -1) {
        const extractedJson = jsonText.substring(startIndex, endIndex);
        console.log('[parseRoundSummary] Extracted JSON substring, length:', extractedJson.length);
        
        try {
          // 尝试修复未转义的换行符和引号
          let fixedJson = extractedJson
            .replace(/\n/g, '\\n')  // 转义换行符
            .replace(/\r/g, '\\r')  // 转义回车符
            .replace(/\t/g, '\\t'); // 转义制表符
          
          // 尝试修复字符串中的未转义引号（在字符串值中）
          // 这是一个简单的启发式方法：在 : 和 , 或 } 之间的引号应该被转义
          fixedJson = fixedJson.replace(/("(?:[^"\\]|\\.)*")\s*:\s*"([^"]*?)"/g, (match, key, value) => {
            // 如果值中包含未转义的引号，尝试修复
            if (value.includes('"') && !value.includes('\\"')) {
              const fixedValue = value.replace(/"/g, '\\"');
              return `${key}: "${fixedValue}"`;
            }
            return match;
          });
          
          const parsed = JSON.parse(fixedJson) as RoundSummary;
          console.log('[parseRoundSummary] Successfully parsed after fixing');
          return parsed;
        } catch (fixError) {
          console.error('[parseRoundSummary] Fix attempt failed:', fixError);
          // 如果修复也失败，尝试使用原始提取的 JSON
          try {
            const parsed = JSON.parse(extractedJson) as RoundSummary;
            return parsed;
          } catch (finalError) {
            console.error('[parseRoundSummary] Final parse attempt failed');
            throw parseError; // 抛出原始错误
          }
        }
      } else {
        // 如果无法找到完整的 JSON 对象，尝试补全截断的 JSON
        console.warn('[parseRoundSummary] JSON appears to be truncated, attempting to complete...');
        let completedJson = jsonText;
        
        // 检查并补全未闭合的字符串
        // 从后往前查找，找到最后一个未闭合的字符串
        let inString = false;
        let escapeNext = false;
        let lastUnclosedQuoteIndex = -1;
        
        // 从后往前扫描，找到最后一个未闭合的引号
        for (let i = completedJson.length - 1; i >= 0; i--) {
          const char = completedJson[i];
          if (i < completedJson.length - 1 && completedJson[i + 1] === '\\') {
            continue; // 跳过转义字符
          }
          if (char === '"') {
            // 检查这个引号是否是字符串的开始（前面应该是 : 或 , 或 [）
            const beforeChar = i > 0 ? completedJson[i - 1] : ' ';
            if (beforeChar.match(/[\s:,[]/)) {
              // 这可能是字符串的开始，检查后面是否有闭合引号
              let foundClose = false;
              for (let j = i + 1; j < completedJson.length; j++) {
                if (completedJson[j] === '\\') {
                  j++; // 跳过转义字符
                  continue;
                }
                if (completedJson[j] === '"') {
                  foundClose = true;
                  break;
                }
                if (completedJson[j].match(/[,\]}]/)) {
                  break; // 遇到结构字符，说明字符串未闭合
                }
              }
              if (!foundClose) {
                lastUnclosedQuoteIndex = i;
                break;
              }
            }
          }
        }
        
        // 如果找到未闭合的字符串，补全它
        if (lastUnclosedQuoteIndex !== -1) {
          // 找到这个字符串的开始位置（最后一个未闭合的引号）
          // 补全字符串：添加闭合引号
          completedJson = completedJson.substring(0, completedJson.length) + '"';
          console.log('[parseRoundSummary] Completed unclosed string');
        }
        
        // 检查并补全未闭合的数组和对象
        let braceCount = 0;
        let bracketCount = 0;
        let inString2 = false;
        let escapeNext2 = false;
        
        for (let i = 0; i < completedJson.length; i++) {
          const char = completedJson[i];
          if (escapeNext2) {
            escapeNext2 = false;
            continue;
          }
          if (char === '\\') {
            escapeNext2 = true;
            continue;
          }
          if (char === '"') {
            inString2 = !inString2;
            continue;
          }
          if (!inString2) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            else if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
          }
        }
        
        // 在补全之前，清理末尾的 trailing commas 和不完整的 key-value 对
        // 去除末尾空白
        completedJson = completedJson.trimEnd();
        // 去除末尾的 trailing comma（如 ",]" 或 ",}" 会导致 JSON 解析失败）
        completedJson = completedJson.replace(/,\s*$/, '');
        // 如果末尾是一个不完整的 key（如 "someKey":），移除它
        completedJson = completedJson.replace(/,?\s*"[^"]*"\s*:\s*$/, '');

        // 补全未闭合的数组（先补数组，再补对象）
        while (bracketCount > 0) {
          completedJson += ']';
          bracketCount--;
        }
        
        // 补全未闭合的对象
        while (braceCount > 0) {
          completedJson += '}';
          braceCount--;
        }
        
        console.log('[parseRoundSummary] Completed JSON structure, attempting to parse...');
        
        // 尝试解析补全后的 JSON
        try {
          const parsed = JSON.parse(completedJson) as RoundSummary;
          console.log('[parseRoundSummary] Successfully parsed after completing truncated JSON');
          return parsed;
        } catch (completeError) {
          console.error('[parseRoundSummary] Failed to parse completed JSON:', completeError);
          // 如果补全后仍然失败，尝试更激进的方法：移除最后一个未完成的字段
          try {
            // 找到最后一个完整的字段（以 } 或 ] 结尾的）
            const lastCompleteBrace = completedJson.lastIndexOf('}');
            const lastCompleteBracket = completedJson.lastIndexOf(']');
            const lastComplete = Math.max(lastCompleteBrace, lastCompleteBracket);
            
            if (lastComplete > completedJson.length * 0.8) {
              // 如果最后一个完整结构在 80% 之后，尝试截取到那里
              let truncatedJson = completedJson.substring(0, lastComplete + 1);
              // 清理 trailing commas
              truncatedJson = truncatedJson.replace(/,\s*([}\]])/g, '$1');
              // 补全对象
              let braceCount2 = 0;
              let bracketCount2 = 0;
              for (let i = 0; i < truncatedJson.length; i++) {
                if (truncatedJson[i] === '{') braceCount2++;
                else if (truncatedJson[i] === '}') braceCount2--;
                else if (truncatedJson[i] === '[') bracketCount2++;
                else if (truncatedJson[i] === ']') bracketCount2--;
              }
              while (bracketCount2 > 0) {
                truncatedJson += ']';
                bracketCount2--;
              }
              while (braceCount2 > 0) {
                truncatedJson += '}';
                braceCount2--;
              }
              const parsed = JSON.parse(truncatedJson) as RoundSummary;
              console.log('[parseRoundSummary] Successfully parsed after truncating incomplete fields');
              return parsed;
            }
          } catch (truncateError) {
            console.error('[parseRoundSummary] Truncation attempt also failed');
          }
          throw parseError; // 抛出原始错误
        }
      }
      
      throw parseError; // 如果无法提取 JSON，抛出原始错误
    }
  } catch (error) {
    console.error('[parseRoundSummary] Failed to parse RoundSummary:', error);
    console.error('[parseRoundSummary] Raw response length:', jsonStr.length);
    console.error('[parseRoundSummary] Raw response (first 500 chars):', jsonStr.substring(0, 500));
    console.error('[parseRoundSummary] Raw response (last 500 chars):', jsonStr.substring(Math.max(0, jsonStr.length - 500)));

    // 最后的兜底：尝试从原始文本中提取关键字段，构建最低限度的 RoundSummary
    console.warn('[parseRoundSummary] Returning fallback minimal RoundSummary');
    const fallbackSummary: RoundSummary = {
      roundIndex: 1,
      topicTitle: '',
      consensusLevel: 50,
      overallSummary: '主持人分析生成异常，请继续讨论。',
      agentsSummary: [],
      insights: [],
      consensus: [],
      conflicts: [],
      openQuestions: [],
      nextRoundSuggestions: [],
    };
    // 尝试从原始 JSON 文本中提取部分有效字段
    try {
      const roundIndexMatch = jsonStr.match(/"roundIndex"\s*:\s*(\d+)/);
      if (roundIndexMatch) fallbackSummary.roundIndex = parseInt(roundIndexMatch[1]);
      const topicMatch = jsonStr.match(/"topicTitle"\s*:\s*"([^"]+)"/);
      if (topicMatch) fallbackSummary.topicTitle = topicMatch[1];
      const consensusMatch = jsonStr.match(/"consensusLevel"\s*:\s*(\d+)/);
      if (consensusMatch) fallbackSummary.consensusLevel = parseInt(consensusMatch[1]);
      const summaryMatch = jsonStr.match(/"overallSummary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (summaryMatch) fallbackSummary.overallSummary = summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } catch (extractErr) {
      // ignore extraction errors
    }
    return fallbackSummary;
  }
}

/**
 * 解析 JSON 字符串为 SessionSummary
 */
function parseSessionSummary(jsonStr: string): SessionSummary {
  try {
    // 尝试提取 JSON 部分（可能包含 markdown 代码块）
    let jsonText = jsonStr.trim();
    
    // 如果包含 markdown 代码块，提取其中的 JSON
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText) as SessionSummary;
    return parsed;
  } catch (error) {
    console.error('Failed to parse SessionSummary:', error);
    console.error('Raw response:', jsonStr);
    throw new Error(`Failed to parse SessionSummary: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 启动一个新的讨论会话
 * 
 * @param params 会话参数
 * @returns Promise<Session> 创建的会话对象
 */
export async function startSession(params: {
  topicTitle: string;
  topicDescription: string;
  userGoal: string;
  agentIds: AgentId[];
}): Promise<Session> {
  // 从 defaultStockAgents 中根据 agentIds 选出 AgentConfig
  const agents = defaultStockAgents.filter((agent) =>
    params.agentIds.includes(agent.id as AgentId)
  );

  if (agents.length === 0) {
    throw new Error('No valid agents found for the provided agentIds');
  }

  // 创建 Session 对象
  const session: Session = {
    id: generateSessionId(),
    topicTitle: params.topicTitle,
    topicDescription: params.topicDescription,
    userGoal: params.userGoal,
    agents,
    rounds: [],
  };

  // 保存到 Map 中
  sessions.set(session.id, session);
  
  console.log(`[discussionService] Session created: ${session.id}, total sessions: ${sessions.size}`);

  return session;
}

/**
 * 恢复 Session 到内存中（如果不存在）
 */
export function restoreSession(session: Session): void {
  sessions.set(session.id, session);
  console.log(`[discussionService] Session restored: ${session.id}, total sessions: ${sessions.size}`);
}

/**
 * 进度更新回调类型
 */
export type ProgressCallback = (progress: {
  stage: 'speech' | 'review' | 'summary';
  agentIndex?: number;
  agentName?: string;
  totalAgents?: number;
  message: string;
  data?: any;
}) => void;

/**
 * 运行一轮讨论（带进度回调）
 * 
 * @param sessionId 会话 ID
 * @param onProgress 进度回调函数
 * @param sessionData 可选的 Session 数据，如果内存中不存在则使用此数据恢复
 * @returns Promise<Session> 更新后的会话对象
 */
export async function runRoundWithProgress(
  sessionId: string,
  onProgress: ProgressCallback,
  sessionData?: Session
): Promise<Session> {
  // 读取 Session
  console.log(`[discussionService] Looking for session: ${sessionId}, available sessions:`, Array.from(sessions.keys()));
  let session = sessions.get(sessionId);
  
  // 如果内存中不存在，尝试从 sessionData 恢复
  if (!session && sessionData) {
    console.log(`[discussionService] Session not in memory, restoring from provided data`);
    restoreSession(sessionData);
    session = sessionData;
  }
  
  if (!session) {
    console.error(`[discussionService] Session not found: ${sessionId}, total sessions: ${sessions.size}`);
    throw new Error(`Session not found: ${sessionId}`);
  }
  console.log(`[discussionService] Session found: ${sessionId}, starting round ${session.rounds.length + 1}`);

  // 确定 roundIndex
  const roundIndex = session.rounds.length + 1;

  // 基于历史 rounds，构造历史记录文本
  const historyText = buildHistoryText(session.rounds);

  // 步骤 a: 并行为每个 Agent 生成 mainSpeech
  onProgress({
    stage: 'speech',
    message: `开始生成 ${session.agents.length} 个 Agent 的发言...`,
    totalAgents: session.agents.length,
  });

  console.log(`[discussionService] Step a: Generating main speeches for ${session.agents.length} agents...`);
  const mainSpeeches = await Promise.all(
    session.agents.map(async (agent, index) => {
      onProgress({
        stage: 'speech',
        agentIndex: index + 1,
        agentName: agent.name,
        totalAgents: session.agents.length,
        message: `${agent.name} 正在发言...`,
      });

      console.log(`[discussionService] Generating speech for agent ${index + 1}/${session.agents.length}: ${agent.name}`);
      const systemPrompt = agent.systemPrompt;
      const userPrompt = buildAgentSpeechUserPrompt(agent.id as AgentId, {
        topic: session.topicTitle,
        description: session.topicDescription,
        history: historyText,
        round_index: roundIndex,
      });

      const startTime = Date.now();
      const mainSpeech = await llmClient.generate(systemPrompt, userPrompt);
      const duration = Date.now() - startTime;
      console.log(`[discussionService] Agent ${agent.name} speech generated in ${duration}ms`);

      onProgress({
        stage: 'speech',
        agentIndex: index + 1,
        agentName: agent.name,
        totalAgents: session.agents.length,
        message: `${agent.name} 发言完成`,
        data: { speech: mainSpeech },
      });
      
      return {
        agentId: agent.id,
        agentName: agent.name,
        speech: mainSpeech,
      };
    })
  );
  console.log(`[discussionService] Step a completed: All ${mainSpeeches.length} speeches generated`);

  // 步骤 b: 构造其他 Agent 的发言摘要（用于互评）
  const otherAgentsSpeechesText = mainSpeeches
    .map((s) => `【${s.agentName}】\n${s.speech}`)
    .join('\n\n');

  // 步骤 c: 并行为每个 Agent 生成 review
  onProgress({
    stage: 'review',
    message: `开始生成 ${session.agents.length} 个 Agent 的互评...`,
    totalAgents: session.agents.length,
  });

  console.log(`[discussionService] Step c: Generating reviews for ${session.agents.length} agents...`);
  const reviews = await Promise.all(
    session.agents.map(async (agent, index) => {
      onProgress({
        stage: 'review',
        agentIndex: index + 1,
        agentName: agent.name,
        totalAgents: session.agents.length,
        message: `${agent.name} 正在互评...`,
      });

      console.log(`[discussionService] Generating review for agent ${index + 1}/${session.agents.length}: ${agent.name}`);
      const systemPrompt = agent.systemPrompt;
      const userPrompt = buildAgentReviewUserPrompt(agent.id as AgentId, {
        topic: session.topicTitle,
        description: session.topicDescription,
        history: historyText,
        round_index: roundIndex,
        other_agents_speeches: otherAgentsSpeechesText,
      });

      const startTime = Date.now();
      const review = await llmClient.generate(systemPrompt, userPrompt);
      const duration = Date.now() - startTime;
      console.log(`[discussionService] Agent ${agent.name} review generated in ${duration}ms`);

      onProgress({
        stage: 'review',
        agentIndex: index + 1,
        agentName: agent.name,
        totalAgents: session.agents.length,
        message: `${agent.name} 互评完成`,
        data: { review },
      });
      
      return {
        agentId: agent.id,
        agentName: agent.name,
        review,
      };
    })
  );
  console.log(`[discussionService] Step c completed: All ${reviews.length} reviews generated`);

  // 步骤 d: 构造本轮发言和互评的文本
  // 优化：截断过长的内容，避免 prompt 过长导致 API 响应变慢
  const truncateText = (text: string, maxLength: number = 2000): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '\n\n[内容已截断，保留前2000字符]';
  };

  const currentRoundAgentsSpeeches = mainSpeeches
    .map((s) => {
      // 每个 Agent 的发言限制在 800 字符以内
      const truncatedSpeech = truncateText(s.speech, 800);
      return `【${s.agentName}（${s.agentId}）】\n${truncatedSpeech}`;
    })
    .join('\n\n');

  const currentRoundAgentsReviews = reviews
    .map((r) => {
      // 每个 Agent 的互评限制在 600 字符以内
      const truncatedReview = truncateText(r.review, 600);
      return `【${r.agentName}（${r.agentId}）的互评】\n${truncatedReview}`;
    })
    .join('\n\n');

  // 步骤 e: 调用轮次总结
  onProgress({
    stage: 'summary',
    message: '正在生成讨论总结...',
  });

  console.log(`[discussionService] Step e: Generating round summary...`);
  console.log(`[discussionService] Summary prompt length: speeches=${currentRoundAgentsSpeeches.length}, reviews=${currentRoundAgentsReviews.length}`);
  
  const agentsBriefList = buildAgentsBriefList(session.agents);
  const systemPrompt = roundSummarySystemPromptTemplate;
  const userPrompt = buildRoundSummaryUserPrompt({
    round_index: roundIndex,
    topic_title: session.topicTitle,
    topic_description: session.topicDescription,
    user_goal: session.userGoal,
    agents_brief_list: agentsBriefList,
    current_round_agents_speeches: currentRoundAgentsSpeeches,
    current_round_agents_reviews: currentRoundAgentsReviews,
  });
  
  console.log(`[discussionService] Total summary prompt length: ${userPrompt.length} characters`);

  const summaryStartTime = Date.now();
  const summaryResponse = await llmClient.generate(systemPrompt, userPrompt);
  const summaryDuration = Date.now() - summaryStartTime;
  console.log(`[discussionService] Round summary generated in ${summaryDuration}ms`);
  
  const roundSummary = parseRoundSummary(summaryResponse);
  console.log(`[discussionService] Round summary parsed successfully`);

  onProgress({
    stage: 'summary',
    message: '讨论总结完成',
    data: { roundSummary },
  });

  // 步骤 f: 把 RoundSummary push 进 session.rounds
  session.rounds.push(roundSummary);

  // 更新 Map 中的 Session
  sessions.set(sessionId, session);

  return session;
}

/**
 * 运行一轮讨论
 * 
 * @param sessionId 会话 ID
 * @param sessionData 可选的 Session 数据，如果内存中不存在则使用此数据恢复
 * @returns Promise<Session> 更新后的会话对象
 */
export async function runRound(sessionId: string, sessionData?: Session): Promise<Session> {
  return runRoundWithProgress(sessionId, () => {}, sessionData);
}

/**
 * 总结整个会话
 * 
 * @param sessionId 会话 ID
 * @returns Promise<SessionSummary> 会话总结
 */
export async function summarizeSession(sessionId: string): Promise<SessionSummary> {
  // 读取 Session
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.rounds.length === 0) {
    throw new Error('Cannot summarize session with no rounds');
  }

  // 构造所有轮次总结的 JSON 字符串
  const allRoundSummariesJson = JSON.stringify(session.rounds, null, 2);

  // 调用会话总结
  const systemPrompt = sessionSummarySystemPromptTemplate;
  const userPrompt = buildSessionSummaryUserPrompt({
    topic_title: session.topicTitle,
    topic_description: session.topicDescription,
    user_goal: session.userGoal,
    all_round_summaries_json: allRoundSummariesJson,
  });

  const summaryResponse = await llmClient.generate(systemPrompt, userPrompt);
  const sessionSummary = parseSessionSummary(summaryResponse);

  return sessionSummary;
}

/**
 * 获取会话（用于调试或查询）
 */
export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

/**
 * 获取所有会话 ID（用于调试）
 */
export function getAllSessionIds(): string[] {
  return Array.from(sessions.keys());
}
