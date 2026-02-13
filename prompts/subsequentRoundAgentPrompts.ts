// /prompts/subsequentRoundAgentPrompts.ts

/**
 * Agent 第2轮及后续轮次的 User Prompt 模板
 * 
 * 新架构：每轮每个Agent只发言1次。
 * 分三种场景：
 * 1. subsequentRoundSpeechTemplate — 无用户发言时，仅回应上一轮分歧
 * 2. subsequentRoundWithUserQuestionTemplate — 有用户发言时，回应用户 + 回应上一轮分歧
 * 3. targetedReplyUserPromptTemplate — 保留兼容，第一轮内部回复（不再在主流程中使用）
 */

// ==================== 第2轮+ 无用户发言：回应上一轮分歧 ====================

const subsequentRoundDisagreementRequirements = `【要求】
请仔细阅读上一轮所有Agent的发言，现在进行新一轮的发言。

规则：
1. 只回应跟你有**明确、实质性分歧**的Agent，观点相近或已达成共识的不用回应
2. 用 @Agent名称 提及对方，简短说明你们的分歧在哪，然后亮出你的看法
3. 可以反驳、质疑、补充，也可以部分认同但指出不足，态度鲜明
4. 不要发表对话题的整体观点或笼统总结，聚焦在具体分歧上
5. 150字以内，抓重点，说人话

示例（风格参考，别照抄）：
@涨停敢死队长 兄弟你上轮说的"封板就干"我就不同意，你看看历史数据，追涨停的策略在震荡市胜率才40%出头。你那叫盘感，我这叫统计显著性。
@草根股神老王 王叔你说的"等"我理解，但上轮我就说了，不是所有等待都有价值。关键是你怎么定义"便宜"，靠感觉还是靠估值模型？

请用中文输出，使用"我"的第一人称，像跟同行朋友聊天一样自然。`;

export const subsequentRoundSpeechTemplate = `当前讨论话题：{{topic}}

上一轮所有Agent的发言内容：
{{previous_round_speeches}}

【你在上一轮的发言】
{{my_previous_speech}}

当前是第 {{round_index}} 轮讨论。

${subsequentRoundDisagreementRequirements}`;

// ==================== 第2轮+ 有用户发言：回应用户 + 回应上一轮分歧 ====================

const subsequentRoundWithUserRequirements = `【要求】
用户（投资者）向讨论群提出了问题，同时你还需要回应上一轮的分歧。

规则：
1. 先回应用户的提问（用 @你 提及用户），结合你的专业视角给出回答
2. 再回应上一轮跟你有明确分歧的Agent（用 @Agent名称），说清分歧、亮出看法
3. 如果需要实时数据支持，主动使用工具查询
4. 150字以内，简洁有力

请用中文输出，使用"我"的第一人称，像跟同行朋友聊天一样自然。`;

export const subsequentRoundWithUserQuestionTemplate = `当前讨论话题：{{topic}}

【用户提问】
@你：{{user_question}}

【上一轮各Agent的发言】
{{previous_round_speeches}}

【你在上一轮的发言】
{{my_previous_speech}}

当前是第 {{round_index}} 轮讨论。

${subsequentRoundWithUserRequirements}`;


// ==================== 保留的兼容导出 ====================

// 第一轮内部针对性回复模板（保留兼容，不在新主流程中使用）
const targetedReplyRequirements = `【要求】
你已经看到本轮所有Agent的观点阐述，现在请进行针对性回复。

规则：
1. 找出跟你有**明显分歧**或**高度共识**的Agent
2. 用 @Agent名称 提及对方，态度鲜明、语言犀利：
   - 有分歧：直接反驳，指出对方观点的问题，亮出你的不同看法
   - 高度共识：简短表态赞同，补充你的独特角度或延伸观点
3. 不要重复自己的观点阐述，聚焦在对其他Agent的回应上
4. 150字以内，精炼表达

请用中文输出，使用"我"的第一人称，像跟同行朋友争论一样自然直接。`;

export const targetedReplyUserPromptTemplate = `当前讨论话题：{{topic}}

本轮所有Agent的观点阐述：
{{all_agents_speeches}}

【你的观点阐述】
{{my_speech}}

{{previous_replies}}

当前是第 {{reply_round}} 次针对性回复。

${targetedReplyRequirements}`;

// 第二轮+针对性回复模板（保留兼容）
export const subsequentRoundReplyUserPromptTemplate = subsequentRoundSpeechTemplate;

/**
 * Agent 第二轮及后续轮次发言 Prompt 映射（向后兼容）
 * @deprecated 使用 subsequentRoundSpeechTemplate 和 subsequentRoundWithUserQuestionTemplate 代替
 */
export const agentSubsequentRoundSpeechPromptById: Record<string, string> = {
  macro_economist: subsequentRoundSpeechTemplate,
  finance_expert: subsequentRoundSpeechTemplate,
  senior_stock_practitioner: subsequentRoundSpeechTemplate,
  veteran_stock_tycoon: subsequentRoundSpeechTemplate,
  policy_analyst: subsequentRoundSpeechTemplate,
  etf_auntie: subsequentRoundSpeechTemplate,
  cross_border_hunter: subsequentRoundSpeechTemplate,
  institutional_trader: subsequentRoundSpeechTemplate,
  finance_kol: subsequentRoundSpeechTemplate,
  risk_controller: subsequentRoundSpeechTemplate,
  industry_researcher: subsequentRoundSpeechTemplate,
  cycle_theorist: subsequentRoundSpeechTemplate,
};
