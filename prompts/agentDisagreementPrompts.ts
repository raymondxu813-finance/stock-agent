// /prompts/agentDisagreementPrompts.ts

/**
 * Agent 分歧分析 Prompt 模板
 * 用于让每个 Agent 分析与其他 Agent 的分歧并@对方
 */

/**
 * Agent 分歧分析 User Prompt 模板
 */
export const agentDisagreementAnalysisUserPromptTemplate = `当前讨论话题：{{topic}}

本轮所有 Agent 的发言内容：
{{all_agents_speeches}}

【你的发言】
{{my_speech}}

请仔细阅读上述所有 Agent 的发言，找出与你观点有分歧的其他 Agent。

要求：
1. **必须找出至少一个与你观点有分歧的 Agent**
2. **必须明确@该 Agent，格式为：@Agent名称**
3. **总结该 Agent 的观点与你的分歧点**
4. **控制在 100 字以内**

输出格式（必须严格遵守）：
@Agent名称，我认为你的观点在[具体分歧点]方面与我有分歧。我的观点是[你的观点]，而你提到[对方的观点]。我认为[你的理由]。

如果没有明显分歧，也要选择一个观点最不同的 Agent 进行对比分析。

请用中文输出。`;
