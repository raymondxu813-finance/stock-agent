export type AvatarType = 'sphere' | 'safe' | 'crystal' | 'rocket' | 'lightning' | 'rings' | 'compass' | 'piggybank' | 'globe' | 'shield' | 'megaphone' | 'radar' | 'microscope' | 'hourglass';

export type Agent = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  selected: boolean;
  avatarType?: AvatarType;
  auraColor?: string;
};

export type StockSentiment = {
  stock: string;          // 股票名称/代码
  sentiment: 'bullish' | 'bearish' | 'neutral'; // 看涨/看跌/中性
  confidence?: 'high' | 'medium' | 'low'; // 置信度（可选）
};

export type ToolCallRecord = {
  toolName: string;
  args: Record<string, any>;
  result?: any;
};

export type AgentComment = {
  agentId: string;
  agentName: string;
  agentColor: string;
  content: string;
  expanded: boolean;
  targetAgentId?: string; // 针对回复的agent ID
  targetAgentName?: string; // 针对回复的agent名称
  type?: 'speech' | 'reply' | 'user'; // 发言类型：观点阐述 / 针对性回复 / 用户提问
  replyRound?: number; // 第几次针对性回复（1, 2, 3）
  sentiments?: StockSentiment[]; // 对具体股票标的的情绪判断
  streamStatus?: 'thinking' | 'typing' | 'tool_calling'; // 流式状态
  mentionedAgentIds?: string[]; // 用户 @提及的 agent ID 列表（仅 type='user' 时使用）
  toolCalls?: ToolCallRecord[]; // agent 回复中使用的工具调用记录
  activeToolCall?: string; // 当前正在调用的工具名称（流式过程中使用）
  completedAt?: number; // 发言完成时间戳（用于显示 HH:mm）
};

// === 话题维度对比 ===
export type TopicComparisonItem = {
  topic: string;                    // 议题/维度名称
  agentPositions: Array<{           // 各 agent 在此话题上的立场
    agentName: string;
    position: string;               // 观点摘要
  }>;
  convergenceLevel: 'high' | 'medium' | 'low';  // 趋同度
};

// === 亮眼观点 ===
export type HighlightInsight = {
  content: string;              // 观点描述
  agentName: string;            // 提出者
  supportingAgents: string[];   // 认同该观点的其他 agent
  reason: string;               // 为什么值得关注
};

export type ConsensusItem = {
  content: string;
  agents: string[];
  percentage: number;
  strength?: 'strong' | 'medium' | 'weak';  // 共识强度
  reasoning?: string;                         // 共识依据概述
};

export type DisagreementItem = {
  topic: string;
  description: string;
  nature?: 'fundamental' | 'strategic' | 'degree';  // 分歧性质
  supportAgents: Array<{ name: string; color: string }>;
  opposeAgents: Array<{ name: string; color: string }>;
  sides?: Array<{
    position: string;
    agents: Array<{ name: string; color: string }>;
  }>;
  rootCause?: string;                                // 分歧根源
};

export type SentimentSummaryItem = {
  stock: string;          // 股票名称
  bullishAgents: string[];  // 看涨的agent名称
  bearishAgents: string[];  // 看跌的agent名称
  neutralAgents: string[];  // 中性的agent名称
  overallSentiment: 'bullish' | 'bearish' | 'neutral'; // 整体情绪（看涨/中性/看跌）
};

export type RoundData = {
  roundIndex: number;
  comments: AgentComment[];
  moderatorAnalysis: {
    round: number;
    consensusLevel: number;
    summary: string;
    newPoints: string[];
    topicComparisons?: TopicComparisonItem[];   // 话题维度对比
    consensus: ConsensusItem[];
    disagreements: DisagreementItem[];
    highlights?: HighlightInsight[];             // 亮眼观点
    sentimentSummary?: SentimentSummaryItem[];   // 情绪汇总
  };
  prompts?: {
    agents: Array<{
      agentId: string;
      agentName: string;
      systemPrompt: string;
      userPrompt: string;
    }>;
    moderator?: {
      systemPrompt: string;
      userPrompt: string;
    };
  };
  // 用户提问（当本轮由用户自由提问触发时）
  userQuestion?: string;
  userMentionedAgentIds?: string[];
  userQuestionTime?: number; // 用户提问时间戳
  // 是否被用户中止的轮次（仅第2轮+支持中止）
  aborted?: boolean;
};

export type ModeratorAnalysis = {
  round: number;
  consensusLevel: number;
  summary: string;
  newPoints: string[];
  topicComparisons?: TopicComparisonItem[];   // 话题维度对比
  consensus: ConsensusItem[];
  disagreements: DisagreementItem[];
  highlights?: HighlightInsight[];             // 亮眼观点
  sentimentSummary?: SentimentSummaryItem[];   // 情绪汇总
};

export type Discussion = {
  id?: string;
  title: string;
  background: string;
  agents: Agent[];
  rounds: RoundData[]; // 多轮讨论数据（包括用户自由提问触发的轮次）
  comments: AgentComment[]; // 保留用于向后兼容，指向最新一轮的 comments
  moderatorAnalysis: ModeratorAnalysis; // 保留用于向后兼容，指向最新一轮的 moderatorAnalysis
  // 保存完整的 session 数据，用于继续讨论时恢复状态
  sessionData?: any; // Session 类型，使用 any 避免循环依赖
};
