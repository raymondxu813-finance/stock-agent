// /prompts/sessionSummaryPrompts.ts

/**
 * 全会话总结的 System Prompt 和 User Prompt 模板
 * 使用模板字符串形式，保留 {{...}} 占位符供运行时填充
 */

/**
 * 全会话总结 System Prompt
 * 角色是"多 Agent 话题讨论系统的总结器"
 */
export const sessionSummarySystemPromptTemplate = `你是一个"多 Agent 话题讨论系统的总结器"，负责对整个会话（包含多轮讨论）进行全局性总结。

你的任务是：
1. 分析所有轮次的讨论内容，提炼观点演化过程
2. 识别贯穿多轮的最终共识和持续存在的分歧
3. 总结影响决策的关键因素
4. 识别潜在风险和需要注意的问题
5. 提供可执行的行动建议
6. 生成一份结构化的文本报告

输出要求：
- 严格输出指定的 JSON 结构，不要输出任何解释说明
- 所有内容使用简体中文
- 内容结构清晰，聚焦核心结论、分歧、风险和行动项
- 避免重复堆砌，提炼多轮讨论的核心价值
- **重要：所有文本字段必须控制在 200 字以内，做有效总结归纳，只保留最核心、最重要的信息**
- 文本报告应该是一份完整的、可直接呈现给用户的总结文档（控制在 200 字以内）

输出 JSON 结构必须包含以下字段：
- topicTitle: string - 讨论话题标题
- roundCount: number - 总轮次数
- finalConsensus: Array<{ point: string, supportingAgents: string[], supportCount: number, totalAgents: number }> - 最终共识点列表（贯穿多轮的共识）
- persistentConflicts: Array<{ issue: string, positions: Array<{ agentName: string, position: string }>, evolution: string }> - 持续存在的分歧（包括观点演化过程）
- keyFactors: Array<{ factor: string, impact: string, evidence: string }> - 影响决策的关键因素（3-5 条）
- risks: Array<{ risk: string, severity: string, mitigation: string }> - 潜在风险列表（3-5 条）
- actionableSuggestions: Array<{ suggestion: string, priority: string, rationale: string }> - 可执行的行动建议（3-5 条）
- textReport: string - 结构化的文本报告（完整的总结文档，包含标题、章节、结论等，适合直接呈现给用户）

请严格按照上述 JSON 结构输出，不要添加任何额外的字段或说明文字。`;

/**
 * 全会话总结 User Prompt
 * 保留 {{变量}} 占位符供运行时填充
 */
export const sessionSummaryUserPromptTemplate = `请对整个会话（包含多轮讨论）进行全局性总结。

讨论话题：
- 标题：{{topic_title}}
- 背景描述：{{topic_description}}
- 用户目标：{{user_goal}}

所有轮次的总结数据（JSON 格式）：
{{all_round_summaries_json}}

请基于以上所有轮次的讨论内容，生成结构化的 JSON 总结，包含：
1. 话题标题和总轮次数
2. 最终共识点（贯穿多轮的共识，包括支持该观点的 Agent 名称和数量）
3. 持续存在的分歧（包括不同 Agent 的立场和观点演化过程）
4. 影响决策的关键因素（包括影响程度和证据）
5. 潜在风险（包括严重程度和缓解措施）
6. 可执行的行动建议（包括优先级和理由）
7. 结构化的文本报告（完整的总结文档，包含标题、章节、结论等，适合直接呈现给用户）

请严格按照 System Prompt 中指定的 JSON 结构输出，不要输出任何解释说明。`;

/**
 * 全会话总结的 JSON 结构类型定义
 * 用于解析模型返回的 JSON 数据
 */
export interface SessionSummary {
  /** 讨论话题标题 */
  topicTitle: string;
  
  /** 总轮次数 */
  roundCount: number;
  
  /** 最终共识点列表（贯穿多轮的共识） */
  finalConsensus: Array<{
    /** 共识点描述 */
    point: string;
    /** 支持该观点的 Agent 名称列表 */
    supportingAgents: string[];
    /** 支持数量 */
    supportCount: number;
    /** 总 Agent 数 */
    totalAgents: number;
  }>;
  
  /** 持续存在的分歧（包括观点演化过程） */
  persistentConflicts: Array<{
    /** 分歧议题 */
    issue: string;
    /** 不同 Agent 的立场 */
    positions: Array<{
      /** Agent 名称 */
      agentName: string;
      /** 该 Agent 的立场 */
      position: string;
    }>;
    /** 观点演化过程描述 */
    evolution: string;
  }>;
  
  /** 影响决策的关键因素（3-5 条） */
  keyFactors: Array<{
    /** 关键因素描述 */
    factor: string;
    /** 影响程度和方式 */
    impact: string;
    /** 支持证据 */
    evidence: string;
  }>;
  
  /** 潜在风险列表（3-5 条） */
  risks: Array<{
    /** 风险描述 */
    risk: string;
    /** 严重程度（如：高/中/低） */
    severity: string;
    /** 缓解措施 */
    mitigation: string;
  }>;
  
  /** 可执行的行动建议（3-5 条） */
  actionableSuggestions: Array<{
    /** 建议内容 */
    suggestion: string;
    /** 优先级（如：高/中/低） */
    priority: string;
    /** 理由说明 */
    rationale: string;
  }>;
  
  /** 结构化的文本报告（完整的总结文档，包含标题、章节、结论等，适合直接呈现给用户） */
  textReport: string;
}
