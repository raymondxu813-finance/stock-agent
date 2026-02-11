// /prompts/roundSummaryPrompts.ts

/**
 * 单轮总结的 System Prompt 和 User Prompt 模板
 * 使用模板字符串形式，保留 {{...}} 占位符供运行时填充
 */

/**
 * 单轮总结 System Prompt
 * 角色是"多 Agent 话题讨论系统的总结器"
 */
export const roundSummarySystemPromptTemplate = `你是一个"多 Agent 话题讨论系统的总结器"，负责对每一轮讨论进行结构化总结。

你的任务是：
1. 分析本轮所有 Agent 的发言和互评内容
2. 提炼共识点、分歧焦点、关键洞察
3. 识别未解决的问题和值得深入讨论的方向
4. 为下一轮讨论提供建议

输出要求：
- 严格输出指定的 JSON 结构，不要输出任何解释说明
- 所有内容使用简体中文
- 内容结构清晰，聚焦差异、冲突和关键洞察
- 避免重复堆砌，提炼核心观点
- **重要：所有文本字段（overallSummary、point、issue、position、insights、openQuestions、nextRoundSuggestions 等）必须控制在 300 字以内，做有效总结归纳，只保留最核心、最重要的信息**
- 当需要列出 Agent 支持比例时，使用"支持该观点的 Agent 名称列表 + 支持数量/总 Agent 数"的形式
- **重要：确保所有字符串值中的引号、换行符等特殊字符都被正确转义（使用 \\" 表示引号，\\n 表示换行符），确保输出的 JSON 格式完全有效**

输出 JSON 结构必须包含以下字段：
- roundIndex: number - 当前轮次索引（从 1 开始）
- topicTitle: string - 讨论话题标题
- overallSummary: string - 本轮讨论的总体概述（控制在 300 字以内，精炼总结）
- agentsSummary: Array<{ agentId: string, agentName: string, keyPoints: string[] }> - 每个 Agent 的核心观点摘要（每个 keyPoint 控制在 50 字以内）
- consensus: Array<{ point: string, supportingAgents: string[], supportCount: number, totalAgents: number }> - 共识点列表（每个 point 控制在 100 字以内）
- conflicts: Array<{ issue: string, positions: Array<{ agentName: string, position: string }> }> - 分歧焦点列表（每个 issue 和 position 控制在 100 字以内）
- insights: string[] - 关键洞察（3-5 条，每条控制在 80 字以内）
- openQuestions: string[] - 未解决的开放性问题（2-4 条，每条控制在 100 字以内）
- nextRoundSuggestions: string[] - 下一轮讨论建议（2-3 条，每条控制在 80 字以内）

请严格按照上述 JSON 结构输出，不要添加任何额外的字段或说明文字。`;

/**
 * 单轮总结 User Prompt
 * 保留 {{变量}} 占位符供运行时填充
 */
export const roundSummaryUserPromptTemplate = `请对第 {{round_index}} 轮讨论进行结构化总结。

讨论话题：
- 标题：{{topic_title}}
- 背景描述：{{topic_description}}
- 用户目标：{{user_goal}}

参与讨论的 Agent 列表：
{{agents_brief_list}}

本轮各 Agent 的发言内容：
{{current_round_agents_speeches}}

本轮各 Agent 的互评/反驳内容：
{{current_round_agents_reviews}}

请基于以上内容，生成结构化的 JSON 总结，包含：
1. 本轮讨论的总体概述
2. 每个 Agent 的核心观点摘要
3. 共识点（包括支持该观点的 Agent 名称和数量）
4. 分歧焦点（包括不同 Agent 的立场）
5. 关键洞察
6. 未解决的开放性问题
7. 下一轮讨论的建议方向

请严格按照 System Prompt 中指定的 JSON 结构输出，不要输出任何解释说明。`;

/**
 * 单轮总结的 JSON 结构类型定义
 * 用于解析模型返回的 JSON 数据
 */
export interface RoundSummary {
  /** 当前轮次索引（从 1 开始） */
  roundIndex: number;
  
  /** 讨论话题标题 */
  topicTitle: string;
  
  /** 本轮讨论的总体概述（2-3 段话） */
  overallSummary: string;
  
  /** 每个 Agent 的核心观点摘要 */
  agentsSummary: Array<{
    /** Agent ID */
    agentId: string;
    /** Agent 名称 */
    agentName: string;
    /** 核心观点列表 */
    keyPoints: string[];
  }>;
  
  /** 共识点列表 */
  consensus: Array<{
    /** 共识点描述 */
    point: string;
    /** 支持该观点的 Agent 名称列表 */
    supportingAgents: string[];
    /** 支持数量 */
    supportCount: number;
    /** 总 Agent 数 */
    totalAgents: number;
  }>;
  
  /** 分歧焦点列表 */
  conflicts: Array<{
    /** 分歧议题 */
    issue: string;
    /** 不同 Agent 的立场 */
    positions: Array<{
      /** Agent 名称 */
      agentName: string;
      /** 该 Agent 的立场 */
      position: string;
    }>;
  }>;
  
  /** 关键洞察（3-5 条） */
  insights: string[];
  
  /** 未解决的开放性问题（2-4 条） */
  openQuestions: string[];
  
  /** 下一轮讨论建议（2-3 条） */
  nextRoundSuggestions: string[];
}
