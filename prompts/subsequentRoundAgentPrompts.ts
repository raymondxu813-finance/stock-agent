// /prompts/subsequentRoundAgentPrompts.ts

/**
 * Agent 针对性回复的 User Prompt 模板
 * 分两套：
 * 1. targetedReplyRequirements — 第一轮的针对性回复（基于本轮其他agent的观点阐述）
 * 2. subsequentRoundReplyRequirements — 第二轮+的针对性回复（基于上一轮的回复内容）
 */

// ==================== 第一轮针对性回复要求 ====================

const targetedReplyRequirements = `【要求】
你已经看到本轮所有Agent的观点阐述，现在请进行针对性回复。

规则：
1. 找出跟你有**明显分歧**或**高度共识**的Agent
2. 用 @Agent名称 提及对方，态度鲜明、语言犀利：
   - 有分歧：直接反驳，指出对方观点的问题，亮出你的不同看法
   - 高度共识：简短表态赞同，补充你的独特角度或延伸观点
3. 不要重复自己的观点阐述，聚焦在对其他Agent的回应上
4. 150字以内，抓重点，别啰嗦

示例（风格参考，别照抄）：
@价值投资苦行僧 你说长期持有就完事了？醒醒吧，2015年那些死拿不卖的，套了两年才回本。好公司也得看买入时机，你这叫信仰不叫投资。
@量化狙击手 你那模型算出来的概率挺好看的，但盘面上主力今天在出货你的模型能告诉你吗？实战和回测是两码事。

请用中文输出，使用"我"的第一人称，像跟同行朋友争论一样自然直接。`;

// ==================== 第二轮+针对性回复要求 ====================

const subsequentRoundReplyRequirements = `【要求】
请仔细阅读上一轮所有Agent的回复，现在进行新一轮的针对性回复。

规则：
1. 只回应跟你有**明确、实质性分歧**的Agent，观点相近或已达成共识的不用回应
2. 用 @Agent名称 提及对方，简短说明你们的分歧在哪，然后亮出你的看法
3. 可以反驳、质疑、补充，也可以部分认同但指出不足，态度鲜明
4. 不要发表对话题的整体观点或笼统总结，聚焦在具体分歧上
5. 150字以内，抓重点，别啰嗦

示例（风格参考，别照抄）：
@涨停敢死队长 兄弟你上轮说的"封板就干"我就不同意，你看看历史数据，追涨停的策略在震荡市胜率才40%出头。你那叫盘感，我这叫统计显著性。
@草根股神老王 王叔你说的"等"我理解，但上轮我就说了，不是所有等待都有价值。关键是你怎么定义"便宜"，靠感觉还是靠估值模型？

请用中文输出，使用"我"的第一人称，像跟同行朋友聊天一样自然。`;


// ==================== 第一轮针对性回复 User Prompt 模板 ====================

export const targetedReplyUserPromptTemplate = `当前讨论话题：{{topic}}

本轮所有Agent的观点阐述：
{{all_agents_speeches}}

【你的观点阐述】
{{my_speech}}

{{previous_replies}}

当前是第 {{reply_round}} 次针对性回复。

${targetedReplyRequirements}`;

// ==================== 第二轮+针对性回复 User Prompt 模板 ====================

export const subsequentRoundReplyUserPromptTemplate = `当前讨论话题：{{topic}}

上一轮所有Agent的回复内容：
{{previous_round_speeches}}

【你在上一轮的发言】
{{my_previous_speech}}

{{previous_replies}}

当前是第 {{round_index}} 轮讨论的第 {{reply_round}} 次针对性回复。

${subsequentRoundReplyRequirements}`;


// ==================== 旧的兼容导出（保留以免导入报错） ====================

/**
 * Agent 第二轮及后续轮次发言 Prompt 映射（向后兼容）
 * @deprecated 使用 targetedReplyUserPromptTemplate 和 subsequentRoundReplyUserPromptTemplate 代替
 */
export const agentSubsequentRoundSpeechPromptById: Record<string, string> = {
  macro_economist: subsequentRoundReplyUserPromptTemplate,
  finance_expert: subsequentRoundReplyUserPromptTemplate,
  senior_stock_practitioner: subsequentRoundReplyUserPromptTemplate,
  veteran_stock_tycoon: subsequentRoundReplyUserPromptTemplate,
};

// 每个agent都使用同一个模板（因为差异化通过 system prompt 实现）
export const macroEconomistSubsequentRoundSpeechUserPromptTemplate = subsequentRoundReplyUserPromptTemplate;
export const financeExpertSubsequentRoundSpeechUserPromptTemplate = subsequentRoundReplyUserPromptTemplate;
export const seniorStockPractitionerSubsequentRoundSpeechUserPromptTemplate = subsequentRoundReplyUserPromptTemplate;
export const veteranStockTycoonSubsequentRoundSpeechUserPromptTemplate = subsequentRoundReplyUserPromptTemplate;
