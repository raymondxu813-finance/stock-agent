// /prompts/builder.ts

/**
 * Prompt 模板填充工具函数
 * 用于将模板字符串中的 {{变量}} 替换为实际值
 */

import type { AgentId } from './roundAgentPrompts';
import { agentSpeechPromptById, agentReviewPromptById } from './roundAgentPrompts';
import { agentSubsequentRoundSpeechPromptById } from './subsequentRoundAgentPrompts';
import { roundSummaryUserPromptTemplate } from './roundSummaryPrompts';
import { sessionSummaryUserPromptTemplate } from './sessionSummaryPrompts';
import { agentDisagreementAnalysisUserPromptTemplate } from './agentDisagreementPrompts';

/**
 * 通用模板填充函数
 * 将模板字符串中的 {{变量名}} 替换为实际值
 * 
 * @param template 模板字符串，包含 {{变量名}} 占位符
 * @param vars 变量映射对象，key 为变量名（不含花括号），value 为要替换的值
 * @returns 填充后的字符串
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number | undefined>
): string {
  let result = template;
  
  // 遍历所有变量，替换模板中的占位符
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = `{{${key}}}`;
    // 如果值为 undefined，使用空字符串（但保留占位符位置）
    const replacement = value !== undefined ? String(value) : '';
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
  }
  
  return result;
}

/**
 * Agent 单轮发言 User Prompt 构建函数参数类型
 */
export interface AgentSpeechPromptVars {
  /** 讨论话题 */
  topic: string;
  /** 话题背景与补充 */
  description: string;
  /** 历史讨论记录 */
  history: string;
  /** 当前轮次索引（从 1 开始） */
  round_index: number;
  /** 上一轮讨论内容（第二轮及后续轮次使用） */
  previous_round_context?: string;
  /** 辩论指令（第二轮及后续轮次使用） */
  debate_instruction?: string;
}

/**
 * Agent 第二轮及后续轮次发言 User Prompt 构建函数参数类型
 */
export interface AgentSubsequentRoundSpeechPromptVars {
  /** 讨论话题 */
  topic: string;
  /** 话题背景与补充 */
  description: string;
  /** 历史讨论记录 */
  history: string;
  /** 当前轮次索引（从 1 开始） */
  round_index: number;
  /** 上一轮轮次索引 */
  previous_round_index: number;
  /** 上一轮所有Agent的发言 */
  previous_round_speeches: string;
  /** 当前Agent在上一轮的发言 */
  my_previous_speech: string;
}

/**
 * 构建 Agent 单轮发言 User Prompt
 * 
 * @param agentId Agent ID
 * @param vars 变量对象，包含 topic, description, history, round_index
 * @returns 填充后的 User Prompt 字符串
 */
export function buildAgentSpeechUserPrompt(
  agentId: AgentId,
  vars: AgentSpeechPromptVars
): string {
  const template = agentSpeechPromptById[agentId];
  return fillTemplate(template, vars as unknown as Record<string, string | number>);
}

/**
 * 构建 Agent 第二轮及后续轮次发言 User Prompt
 * 
 * @param agentId Agent ID
 * @param vars 变量对象，包含 topic, description, history, round_index, previous_round_index, previous_round_speeches, my_previous_speech
 * @returns 填充后的 User Prompt 字符串
 */
export function buildAgentSubsequentRoundSpeechUserPrompt(
  agentId: AgentId,
  vars: AgentSubsequentRoundSpeechPromptVars
): string {
  const template = agentSubsequentRoundSpeechPromptById[agentId];
  if (!template) {
    // 如果没有找到模板，回退到第一轮的模板
    return buildAgentSpeechUserPrompt(agentId, {
      topic: vars.topic,
      description: vars.description,
      history: vars.history,
      round_index: vars.round_index,
    });
  }
  return fillTemplate(template, vars as unknown as Record<string, string | number>);
}

/**
 * Agent 互评/反驳 User Prompt 构建函数参数类型
 */
export interface AgentReviewPromptVars {
  /** 讨论话题 */
  topic: string;
  /** 话题背景与补充 */
  description: string;
  /** 历史讨论记录 */
  history: string;
  /** 当前轮次索引（从 1 开始） */
  round_index: number;
  /** 其他 Agent 的本轮发言 */
  other_agents_speeches: string;
}

/**
 * 构建 Agent 互评/反驳 User Prompt
 * 
 * @param agentId Agent ID
 * @param vars 变量对象，包含 topic, description, history, round_index, other_agents_speeches
 * @returns 填充后的 User Prompt 字符串
 */
export function buildAgentReviewUserPrompt(
  agentId: AgentId,
  vars: AgentReviewPromptVars
): string {
  const template = agentReviewPromptById[agentId];
  return fillTemplate(template, vars as unknown as Record<string, string | number>);
}

/**
 * 单轮总结 User Prompt 构建函数参数类型
 */
export interface RoundSummaryPromptVars {
  /** 当前轮次索引（从 1 开始） */
  round_index: number;
  /** 讨论话题标题 */
  topic_title: string;
  /** 话题背景描述 */
  topic_description: string;
  /** 用户目标 */
  user_goal: string;
  /** 参与讨论的 Agent 列表（简要信息） */
  agents_brief_list: string;
  /** 本轮各 Agent 的发言内容 */
  current_round_agents_speeches: string;
  /** 本轮各 Agent 的互评/反驳内容 */
  current_round_agents_reviews: string;
}

/**
 * 构建单轮总结 User Prompt
 * 
 * @param vars 变量对象，包含 round_index, topic_title, topic_description, user_goal, 
 *             agents_brief_list, current_round_agents_speeches, current_round_agents_reviews
 * @returns 填充后的 User Prompt 字符串
 */
export function buildRoundSummaryUserPrompt(vars: RoundSummaryPromptVars): string {
  return fillTemplate(roundSummaryUserPromptTemplate, vars as unknown as Record<string, string | number>);
}

/**
 * 全会话总结 User Prompt 构建函数参数类型
 */
export interface SessionSummaryPromptVars {
  /** 讨论话题标题 */
  topic_title: string;
  /** 话题背景描述 */
  topic_description: string;
  /** 用户目标 */
  user_goal: string;
  /** 所有轮次的总结数据（JSON 格式字符串） */
  all_round_summaries_json: string;
}

/**
 * 构建全会话总结 User Prompt
 * 
 * @param vars 变量对象，包含 topic_title, topic_description, user_goal, all_round_summaries_json
 * @returns 填充后的 User Prompt 字符串
 */
export function buildSessionSummaryUserPrompt(vars: SessionSummaryPromptVars): string {
  return fillTemplate(sessionSummaryUserPromptTemplate, vars as unknown as Record<string, string | number>);
}

/**
 * Agent 分歧分析 User Prompt 构建函数参数类型
 */
export interface AgentDisagreementAnalysisPromptVars {
  /** 讨论话题 */
  topic: string;
  /** 所有 Agent 的发言内容 */
  all_agents_speeches: string;
  /** 当前 Agent 的发言 */
  my_speech: string;
}

/**
 * 构建 Agent 分歧分析 User Prompt
 * 
 * @param vars 变量对象，包含 topic, all_agents_speeches, my_speech
 * @returns 填充后的 User Prompt 字符串
 */
export function buildAgentDisagreementAnalysisUserPrompt(vars: AgentDisagreementAnalysisPromptVars): string {
  return fillTemplate(agentDisagreementAnalysisUserPromptTemplate, vars as unknown as Record<string, string | number>);
}
