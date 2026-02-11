// /prompts/subsequentRoundAgentPrompts.ts

/**
 * Agent 第二轮及后续轮次发言的 User Prompt 模板
 * 专门用于第二轮及后续轮次，要求agent直接针对其他agent的分歧观点进行回应
 */

// 通用的后续轮次要求部分（所有agent共用）
const subsequentRoundRequirements = `【要求】
请仔细阅读上一轮所有Agent的发言，判断哪些观点跟你有明确分歧。

规则：
1. 只回应跟你有**明确、实质性分歧**的Agent，观点相近或已达成共识的不用回应
2. 用 @Agent名称 提及对方，简短说明你们的分歧在哪，然后亮出你的看法
3. 可以反驳、质疑、补充，也可以部分认同但指出不足，态度鲜明
4. 不要发表对话题的整体观点或笼统总结，聚焦在具体分歧上
5. 全部发言控制在200字以内，抓重点，别啰嗦

示例（风格参考，别照抄）：
@宏观经济学家 老兄你说利率压制估值，这点我不太同意。市场早就消化了加息预期，真正该关注的是盈利拐点什么时候来。现在这个位置，与其担心利率不如看看基本面有没有边际改善。
@资深股票从业人员 你讲的短线情绪面我理解，但你也太悲观了吧？历史上看这种极端缩量反而是底部特征，光看情绪不看筹码结构容易误判。

请用中文输出，使用"我"的第一人称，像跟同行朋友聊天一样自然。`;

// ==================== 宏观经济学家 ====================

/**
 * 「宏观经济学家」第二轮及后续轮次发言 User Prompt
 */
export const macroEconomistSubsequentRoundSpeechUserPromptTemplate = `当前讨论话题：{{topic}}

上一轮（第 {{previous_round_index}} 轮）所有Agent的发言内容：
{{previous_round_speeches}}

【你的上一轮发言】
{{my_previous_speech}}

${subsequentRoundRequirements}`;

// ==================== 金融领域专家 ====================

/**
 * 「金融领域专家」第二轮及后续轮次发言 User Prompt
 */
export const financeExpertSubsequentRoundSpeechUserPromptTemplate = `当前讨论话题：{{topic}}

上一轮（第 {{previous_round_index}} 轮）所有Agent的发言内容：
{{previous_round_speeches}}

【你的上一轮发言】
{{my_previous_speech}}

${subsequentRoundRequirements}`;

// ==================== 资深股票从业人员 ====================

/**
 * 「资深股票从业人员」第二轮及后续轮次发言 User Prompt
 */
export const seniorStockPractitionerSubsequentRoundSpeechUserPromptTemplate = `当前讨论话题：{{topic}}

上一轮（第 {{previous_round_index}} 轮）所有Agent的发言内容：
{{previous_round_speeches}}

【你的上一轮发言】
{{my_previous_speech}}

${subsequentRoundRequirements}`;

// ==================== 成功多年的股票大亨 ====================

/**
 * 「成功多年的股票大亨」第二轮及后续轮次发言 User Prompt
 */
export const veteranStockTycoonSubsequentRoundSpeechUserPromptTemplate = `当前讨论话题：{{topic}}

上一轮（第 {{previous_round_index}} 轮）所有Agent的发言内容：
{{previous_round_speeches}}

【你的上一轮发言】
{{my_previous_speech}}

${subsequentRoundRequirements}`;

// ==================== 类型定义和映射 ====================

/**
 * Agent 第二轮及后续轮次发言 Prompt 映射
 * 根据 AgentId 返回对应的模板字符串
 */
export const agentSubsequentRoundSpeechPromptById: Record<string, string> = {
  macro_economist: macroEconomistSubsequentRoundSpeechUserPromptTemplate,
  finance_expert: financeExpertSubsequentRoundSpeechUserPromptTemplate,
  senior_stock_practitioner: seniorStockPractitionerSubsequentRoundSpeechUserPromptTemplate,
  veteran_stock_tycoon: veteranStockTycoonSubsequentRoundSpeechUserPromptTemplate,
};
