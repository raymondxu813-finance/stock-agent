/**
 * 从服务器 Session 数据重建前端 Discussion 对象
 *
 * 服务器 Session 包含：
 *   - agents: AgentConfig[]（后端业务字段）
 *   - rounds: RoundSummary[]（各轮总结）
 *
 * 前端 Discussion 需要：
 *   - agents: Agent[]（含 UI 字段 color / icon / avatarType）
 *   - rounds: RoundData[]（含 comments / moderatorAnalysis）
 *   - sessionData: 完整 session（用于继续讨论）
 */

import type { Discussion, Agent, RoundData, AgentComment } from '@/types';
import { getAgentUI } from '@/lib/agentUIMap';

/** 提取股票的中文核心名（去括号、去公司后缀） */
function extractChineseName(name: string): string {
  return name
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/(公司|集团|控股|股份有限|有限|股份)$/g, '')
    .trim();
}

/** 提取股票代码（去前导零） */
function extractTicker(name: string): string {
  const raw = name.match(/[（(]([A-Za-z0-9.]+)[）)]/)?.[1]?.toUpperCase() || '';
  return raw.replace(/^0+(?=\d)/, '');
}

/**
 * 判断两个股票名是否指同一标的
 * 和 DiscussionPage.tsx 的 isSameStock 逻辑一致：
 * - 中文名完全匹配（百度 == 百度）
 * - 中文名包含关系（苹果 ⊂ 苹果公司）
 * - 代码相同（去前导零后 9888.HK == 9888.HK）
 */
function isSameStock(a: string, b: string): boolean {
  if (a === b) return true;
  // 比较代码（去前导零）
  const tickerA = extractTicker(a);
  const tickerB = extractTicker(b);
  if (tickerA && tickerB && tickerA === tickerB) return true;
  // 比较中文核心名
  const cnA = extractChineseName(a);
  const cnB = extractChineseName(b);
  if (cnA && cnB && (cnA === cnB || cnA.includes(cnB) || cnB.includes(cnA))) return true;
  // 纯中文字符比较
  const pureA = cnA.replace(/[A-Za-z0-9.\s\-]/g, '');
  const pureB = cnB.replace(/[A-Za-z0-9.\s\-]/g, '');
  if (pureA && pureB && (pureA === pureB || pureA.includes(pureB) || pureB.includes(pureA))) return true;
  return false;
}

/**
 * 从 rawSpeeches 的 sentiments 构建情绪汇总（和实时讨论的 buildSentimentSummaryFromAgentData 逻辑一致）
 */
function buildSentimentFromRawSpeeches(rawSpeeches: any[] | undefined): Array<{
  stock: string; bullishAgents: string[]; bearishAgents: string[]; neutralAgents: string[];
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
}> {
  if (!rawSpeeches || rawSpeeches.length === 0) return [];

  // 按标的分组（归一化名称匹配）
  type Group = { names: string[]; bullish: string[]; bearish: string[]; neutral: string[] };
  const groups: Group[] = [];

  const findGroup = (stock: string): Group | undefined =>
    groups.find(g => g.names.some(n => isSameStock(n, stock)));

  for (const speech of rawSpeeches) {
    if (!speech.sentiments || speech.sentiments.length === 0) continue;
    const agentName = speech.agentName || speech.agentId || '';
    for (const s of speech.sentiments) {
      const stock = s.stock?.trim();
      if (!stock) continue;
      let group = findGroup(stock);
      if (!group) {
        group = { names: [stock], bullish: [], bearish: [], neutral: [] };
        groups.push(group);
      } else if (!group.names.includes(stock)) {
        group.names.push(stock);
      }
      // 每个 agent 对同一标的只计一次
      if (!group.bullish.includes(agentName) && !group.bearish.includes(agentName) && !group.neutral.includes(agentName)) {
        if (s.sentiment === 'bullish') group.bullish.push(agentName);
        else if (s.sentiment === 'bearish') group.bearish.push(agentName);
        else group.neutral.push(agentName);
      }
    }
  }

  return groups.map(g => {
    // 选最佳展示名：优先 "中文(代码)" 格式
    const withTicker = g.names.filter(n => /[\u4e00-\u9fff]/.test(n) && /[（(][A-Za-z0-9.]+[）)]/.test(n));
    const stock = withTicker.length > 0
      ? withTicker.sort((a, b) => a.length - b.length)[0]
      : g.names[0];
    const overallSentiment: 'bullish' | 'bearish' | 'neutral' =
      g.bullish.length > g.bearish.length ? 'bullish'
      : g.bearish.length > g.bullish.length ? 'bearish'
      : 'neutral';
    return { stock, bullishAgents: g.bullish, bearishAgents: g.bearish, neutralAgents: g.neutral, overallSentiment };
  });
}

/**
 * 从服务器返回的完整 Session 对象重建 Discussion
 */
export function rebuildDiscussionFromSession(session: any): Discussion {
  // 1. 重建 agents（补全 UI 字段）
  const agents: Agent[] = (session.agents || []).map((ac: any) => {
    const ui = getAgentUI(ac.id);
    return {
      id: ac.id,
      name: ac.name,
      description: ui.description,
      color: ui.color,
      icon: ui.icon,
      selected: true,
      avatarType: ui.avatar,
      auraColor: ui.auraColor,
    };
  });

  // 2. 重建 rounds（RoundSummary -> RoundData）
  const rounds: RoundData[] = (session.rounds || []).map((rs: any) => {
    // 优先使用 rawSpeeches（完整原始发言，含 toolCalls / sentiments / completedAt）
    // 降级到 agentsSummary（仅关键观点摘要）
    const comments: AgentComment[] = rs.rawSpeeches && rs.rawSpeeches.length > 0
      ? rs.rawSpeeches.map((s: any) => {
          const agent = agents.find(a => a.id === s.agentId);
          return {
            agentId: s.agentId,
            agentName: s.agentName || agent?.name || s.agentId,
            agentColor: agent?.color || 'bg-gray-500',
            content: s.content,
            expanded: false,
            type: 'speech' as const,
            sentiments: s.sentiments,
            toolCalls: s.toolCalls,
            completedAt: s.completedAt,
          };
        })
      : (rs.agentsSummary || []).map((as: any) => {
          const agent = agents.find(a => a.id === as.agentId);
          const keyPointsText = (as.keyPoints || []).join('\n\n');
          return {
            agentId: as.agentId,
            agentName: as.agentName || agent?.name || as.agentId,
            agentColor: agent?.color || 'bg-gray-500',
            content: keyPointsText || '（观点摘要不可用）',
            expanded: false,
            type: 'speech' as const,
          };
        });

    // 构建 moderatorAnalysis
    const moderatorAnalysis = {
      round: rs.roundIndex,
      consensusLevel: rs.consensusLevel || 0,
      summary: rs.overallSummary || '',
      newPoints: rs.insights || [],
      topicComparisons: rs.topicComparisons?.map((tc: any) => ({
        topic: tc.topic,
        agentPositions: tc.agentPositions || [],
        convergenceLevel: tc.convergenceLevel || 'medium',
      })),
      consensus: (rs.consensus || []).map((c: any) => ({
        content: c.point,
        agents: c.supportingAgents || [],
        percentage: c.totalAgents
          ? Math.round((c.supportCount / c.totalAgents) * 100)
          : 0,
        strength: c.strength || undefined,
        reasoning: c.reasoning || undefined,
      })),
      disagreements: (rs.conflicts || []).map((c: any) => {
        // 将 flat positions 按 position 文本分组成 sides（和实时讨论一致）
        const sidesMap = new Map<string, Array<{ name: string; color: string }>>();
        for (const p of (c.positions || [])) {
          const key = p.position || '';
          if (!sidesMap.has(key)) sidesMap.set(key, []);
          sidesMap.get(key)!.push({
            name: p.agentName,
            color: agents.find(a => a.name === p.agentName)?.color || 'bg-gray-500',
          });
        }
        return {
          topic: c.issue,
          description: c.issue,
          sides: Array.from(sidesMap.entries()).map(([position, agentList]) => ({
            position,
            agents: agentList,
          })),
          supportAgents: [],
          opposeAgents: [],
          nature: c.nature || undefined,
          rootCause: c.rootCause || undefined,
        };
      }),
      highlights: rs.highlights?.map((h: any) => ({
        content: h.content,
        agentName: h.agentName,
        supportingAgents: h.supportingAgents || [],
        reason: h.reason,
      })),
      sentimentSummary: (() => {
        // 和实时讨论一致：以 rawSpeeches 中 agent 的结构化 sentiments 为基准，LLM sentimentSummary 为补充
        const agentBased = buildSentimentFromRawSpeeches(rs.rawSpeeches);
        const llmBased = (rs.sentimentSummary || []).map((s: any) => ({
          stock: (s.stock || '') as string,
          bullishAgents: (s.bullishAgents || []) as string[],
          bearishAgents: (s.bearishAgents || []) as string[],
          neutralAgents: (s.neutralAgents || []) as string[],
          overallSentiment: (s.overallSentiment || 'neutral') as 'bullish' | 'bearish' | 'neutral',
        }));
        // 合并：agent 数据为主，LLM 数据补充缺失的标的
        const merged = [...agentBased];
        for (const llmItem of llmBased) {
          if (!llmItem.stock) continue;
          const exists = merged.some(m => isSameStock(m.stock, llmItem.stock));
          if (!exists) merged.push(llmItem);
        }
        return merged.length > 0 ? merged : undefined;
      })(),
    };

    return {
      roundIndex: rs.roundIndex,
      comments,
      moderatorAnalysis,
      // 恢复用户提问数据
      ...(rs.userQuestion ? {
        userQuestion: rs.userQuestion,
        userMentionedAgentIds: rs.userMentionedAgentIds,
        userQuestionTime: rs.userQuestionTime,
      } : {}),
    } as RoundData;
  });

  // 3. 构建完整 Discussion
  const lastRound = rounds[rounds.length - 1];
  const defaultAnalysis = {
    round: 0,
    consensusLevel: 0,
    summary: '',
    newPoints: [],
    consensus: [],
    disagreements: [],
  };

  return {
    id: session.id,
    title: session.topicTitle || '未命名讨论',
    background: session.topicDescription || '',
    agents,
    rounds,
    comments: lastRound?.comments || [],
    moderatorAnalysis: lastRound?.moderatorAnalysis || defaultAnalysis,
    sessionData: session,
  };
}
