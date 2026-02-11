export type Agent = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  selected: boolean;
};

export type AgentComment = {
  agentId: string;
  agentName: string;
  agentColor: string;
  content: string;
  expanded: boolean;
  targetAgentId?: string; // 针对回复的agent ID（第二轮及后续轮次使用）
  targetAgentName?: string; // 针对回复的agent名称
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
  }; // 保留用于向后兼容，指向最新一轮的 moderatorAnalysis
  // 保存完整的 session 数据，用于继续讨论时恢复状态
  sessionData?: any; // Session 类型，使用 any 避免循环依赖
};
