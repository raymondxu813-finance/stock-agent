export type AvatarType = 'sphere' | 'safe' | 'crystal' | 'rocket' | 'lightning' | 'rings';

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

export type AgentComment = {
  agentId: string;
  agentName: string;
  agentColor: string;
  content: string;
  expanded: boolean;
  targetAgentId?: string; // 针对回复的agent ID
  targetAgentName?: string; // 针对回复的agent名称
  type?: 'speech' | 'reply'; // 发言类型：观点阐述 or 针对性回复
  replyRound?: number; // 第几次针对性回复（1, 2, 3）
  sentiments?: StockSentiment[]; // 对具体股票标的的情绪判断
  streamStatus?: 'thinking' | 'typing'; // 流式状态：思考中/打字中（仅在流式过程中使用）
};

export type ConsensusItem = {
  content: string;
  agents: string[];
  percentage: number;
};

export type DisagreementItem = {
  topic: string;
  description: string;
  supportAgents: Array<{ name: string; color: string }>;
  opposeAgents: Array<{ name: string; color: string }>;
};

export type SentimentSummaryItem = {
  stock: string;          // 股票名称
  bullishAgents: string[];  // 看涨的agent名称
  bearishAgents: string[];  // 看跌的agent名称
  neutralAgents: string[];  // 中性的agent名称
  overallSentiment: 'bullish' | 'bearish' | 'neutral' | 'divided'; // 整体情绪
};

export type RoundData = {
  roundIndex: number;
  comments: AgentComment[];
  moderatorAnalysis: {
    round: number;
    consensusLevel: number;
    summary: string;
    newPoints: string[];
    consensus: ConsensusItem[];
    disagreements: DisagreementItem[];
    sentimentSummary?: SentimentSummaryItem[]; // 各标的情绪汇总
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
};

export type Discussion = {
  id?: string;
  title: string;
  background: string;
  agents: Agent[];
  rounds: RoundData[]; // 多轮讨论数据
  comments: AgentComment[]; // 保留用于向后兼容，指向最新一轮的 comments
  moderatorAnalysis: {
    round: number;
    consensusLevel: number;
    summary: string;
    newPoints: string[];
    consensus: ConsensusItem[];
    disagreements: DisagreementItem[];
    sentimentSummary?: SentimentSummaryItem[]; // 各标的情绪汇总
  }; // 保留用于向后兼容，指向最新一轮的 moderatorAnalysis
  // 保存完整的 session 数据，用于继续讨论时恢复状态
  sessionData?: any; // Session 类型，使用 any 避免循环依赖
};
