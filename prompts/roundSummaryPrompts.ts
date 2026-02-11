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
1. 分析本轮所有 Agent 的发言内容
2. 对于第一轮：提炼共识点、分歧焦点、关键洞察
3. 对于第二轮及后续轮次：重点关注 Agent 之间的分歧回应和@mention情况，判断分歧是否缩小或扩大
4. 综合评估所有 Agent 之间的整体共识程度（consensusLevel）
5. 识别未解决的问题和值得深入讨论的方向
6. 为下一轮讨论提供建议

**关于 consensusLevel（共识度）的评估标准：**
- 这是一个 0-100 的整数，表示所有 Agent 在本轮讨论中观点的整体一致程度
- 评估时必须**同时考虑共识点和分歧点**，不能只看共识
- 参考标准：
  - 90-100：几乎所有核心观点一致，仅有极小的细节分歧
  - 70-89：大方向一致，但在具体策略或判断上有明显分歧
  - 50-69：有一些共识，但也有较多实质性分歧未解决
  - 30-49：分歧较大，共识较少，各方立场差异明显
  - 0-29：严重分歧，几乎没有共识
- 第一轮通常在40-70之间（初始观点交换，分歧较多）
- 后续轮次如果分歧在缩小，共识度应上升；如果争论激化，应下降
- **请根据实际内容客观评估，不要默认给高分**

输出要求：
- 严格输出指定的 JSON 结构，不要输出任何解释说明
- 所有内容使用简体中文
- 内容结构清晰，聚焦差异、冲突和关键洞察
- 避免重复堆砌，提炼核心观点
- **重要：所有文本字段必须控制在 200 字以内，做有效总结归纳**
- 当需要列出 Agent 支持比例时，使用"支持该观点的 Agent 名称列表 + 支持数量/总 Agent 数"的形式
- **重要：确保所有字符串值中的引号、换行符等特殊字符都被正确转义（使用 \\" 表示引号，\\n 表示换行符），确保输出的 JSON 格式完全有效**

输出 JSON 结构必须包含以下字段：
- roundIndex: number - 当前轮次索引（从 1 开始）
- topicTitle: string - 讨论话题标题
- consensusLevel: number - 整体共识度（0-100整数，综合考虑共识和分歧后的客观评估）
- overallSummary: string - 本轮讨论的总体概述（控制在 200 字以内，精炼总结）
- agentsSummary: Array<{ agentId: string, agentName: string, keyPoints: string[] }> - 每个 Agent 的核心观点摘要（每个 keyPoint 控制在 200 字以内）
- consensus: Array<{ point: string, supportingAgents: string[], supportCount: number, totalAgents: number }> - 共识点列表（每个 point 控制在 200 字以内）
- conflicts: Array<{ issue: string, positions: Array<{ agentName: string, position: string }> }> - 分歧焦点列表（每个 issue 和 position 控制在 200 字以内）
- insights: string[] - 关键洞察（3-5 条，每条控制在 200 字以内）
- openQuestions: string[] - 未解决的开放性问题（2-4 条，每条控制在 200 字以内）
- nextRoundSuggestions: string[] - 下一轮讨论建议（2-3 条，每条控制在 200 字以内）
- sentimentSummary: Array<{ stock: string, bullishAgents: string[], bearishAgents: string[], neutralAgents: string[], overallSentiment: "bullish"|"bearish"|"neutral"|"divided" }> - 如果话题涉及具体股票/公司标的，汇总每个 Agent 对该标的的看涨/看跌/中性情绪判断。overallSentiment 根据多数 Agent 的情绪倾向综合判断：bullish=多数看涨，bearish=多数看跌，neutral=多数中性，divided=分歧明显。如果话题不涉及具体标的，则为空数组 []。

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

{{current_round_agents_reviews}}

请基于以上内容，生成结构化的 JSON 总结，包含：
1. 本轮讨论的总体概述
2. 每个 Agent 的核心观点摘要
3. 共识点（包括支持该观点的 Agent 名称和数量）
4. 分歧焦点（包括不同 Agent 的立场）
5. 关键洞察
6. 未解决的开放性问题
7. 下一轮讨论的建议方向
8. **情绪汇总**：如果话题涉及具体的股票/公司标的，请汇总每个 Agent 对该标的是看涨、看跌还是中性，并给出整体情绪判断

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

  /** 整体共识度（0-100），由主持人综合评估共识点和分歧点后给出 */
  consensusLevel: number;
  
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

  /** 各标的情绪汇总（如果话题涉及具体股票/公司） */
  sentimentSummary?: Array<{
    /** 股票/公司名称 */
    stock: string;
    /** 看涨的 Agent 名称列表 */
    bullishAgents: string[];
    /** 看跌的 Agent 名称列表 */
    bearishAgents: string[];
    /** 中性的 Agent 名称列表 */
    neutralAgents: string[];
    /** 整体情绪判断 */
    overallSentiment: 'bullish' | 'bearish' | 'neutral' | 'divided';
  }>;
}
