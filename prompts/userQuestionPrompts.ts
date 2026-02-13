// /prompts/userQuestionPrompts.ts

/**
 * 用户提问场景的 Prompt 模板
 * 
 * 用于 agent 讨论完毕后，用户向 agents 提问时的 prompt 构建
 * 配合 Vercel AI SDK 的 tool-calling 使用
 */

/**
 * 用户提问场景的 System Prompt 后缀
 * 追加到 agent 原有 systemPrompt 之后
 */
export const userQuestionSystemSuffix = `

【用户提问模式】
一位投资者用户正在向你提问。请以你的专业角色直接回答。

额外规则：
1. 如果需要查询实时数据（股价、新闻、K线技术指标等），请主动使用提供的工具
2. 引用工具返回的数据时，请标注数据时间
3. 不要编造实时数据，如果没有工具可查或工具返回异常，请如实说明
4. 回答要简洁有力，150字以内`;

/**
 * 用户提问场景的 User Prompt 模板
 * 
 * 变量：
 * - {{topic}}: 讨论话题标题
 * - {{history_context}}: 之前讨论的要点摘要
 * - {{user_message}}: 用户的提问内容
 * - {{other_agents_context}}: 其他 agent 对同一问题的回复（可选，用于后续 agent 参考前面 agent 的回答）
 */
export const userQuestionUserPromptTemplate = `你正在参与一场关于"{{topic}}"的多人投资讨论。之前的讨论已经完成，现在用户（投资者）向你提出了问题。

【之前讨论的要点】
{{history_context}}

{{other_agents_context}}

【用户提问】
{{user_message}}

请从你的专业角度回答用户的问题。规则：
1. 直接回答用户的问题，不要回避
2. 如果需要实时数据（股价、新闻、K线等），使用工具查询后再回答
3. 如果涉及其他专家的观点，可以 @对方名字 进行引用或评论
4. 保持你的角色特点和专业视角
5. 150字以内，简洁有力`;
