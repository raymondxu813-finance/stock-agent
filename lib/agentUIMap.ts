/**
 * Agent 前端 UI 属性映射表
 *
 * 后端 Session 只存储 AgentConfig（id / name / bio 等业务字段），
 * 不包含 color / icon / avatarType / auraColor 等纯 UI 字段。
 * 本映射表用于：
 *   - 从服务器历史恢复 Discussion 时，补全前端渲染所需的 UI 属性
 *   - 统一管理 Agent UI 配置，避免在多个组件中重复定义
 */

import type { AvatarType } from '@/types';

export interface AgentUIInfo {
  color: string;
  icon: string;
  avatar: AvatarType;
  auraColor: string;
  description: string;
}

/** Agent ID -> UI 属性 */
export const AGENT_UI_MAP: Record<string, AgentUIInfo> = {
  macro_economist: {
    color: 'bg-red-500',
    icon: '🔥',
    avatar: 'rocket',
    auraColor: 'from-purple-400/20 to-pink-500/10',
    description: '短线打板之王，5万本金十年翻到8000万',
  },
  finance_expert: {
    color: 'bg-emerald-600',
    icon: '🧘',
    avatar: 'safe',
    auraColor: 'from-amber-400/20 to-yellow-600/10',
    description: '巴菲特信徒，重仓优质股十年不动摇',
  },
  senior_stock_practitioner: {
    color: 'bg-indigo-600',
    icon: '📊',
    avatar: 'lightning',
    auraColor: 'from-blue-400/20 to-indigo-600/10',
    description: 'MIT 数学博士，用算法和数据统治市场',
  },
  veteran_stock_tycoon: {
    color: 'bg-amber-600',
    icon: '🎣',
    avatar: 'rings',
    auraColor: 'from-emerald-400/20 to-teal-600/10',
    description: '28年老股民，2万起步身家过三千万',
  },
  policy_analyst: {
    color: 'bg-red-600',
    icon: '🏛️',
    avatar: 'compass',
    auraColor: 'from-red-400/20 to-rose-500/10',
    description: '前智库研究员，从红头文件中嗅到投资机会',
  },
  etf_auntie: {
    color: 'bg-pink-500',
    icon: '🛒',
    avatar: 'piggybank',
    auraColor: 'from-pink-400/20 to-rose-400/10',
    description: '退休老师，定投十年80万变160万',
  },
  cross_border_hunter: {
    color: 'bg-sky-600',
    icon: '🌍',
    avatar: 'globe',
    auraColor: 'from-sky-400/20 to-blue-600/10',
    description: '沃顿MBA，横跨A港美三大市场',
  },
  institutional_trader: {
    color: 'bg-slate-600',
    icon: '🏦',
    avatar: 'shield',
    auraColor: 'from-slate-400/20 to-slate-600/10',
    description: 'TOP10公募交易主管，管着300亿资金',
  },
  finance_kol: {
    color: 'bg-orange-500',
    icon: '🎙️',
    avatar: 'megaphone',
    auraColor: 'from-orange-400/20 to-amber-500/10',
    description: '300万粉丝博主，把股票讲成脱口秀',
  },
  risk_controller: {
    color: 'bg-emerald-700',
    icon: '🛡️',
    avatar: 'radar',
    auraColor: 'from-emerald-500/20 to-green-700/10',
    description: '前券商风控总监，被称"乌鸦嘴"但每次都对',
  },
  industry_researcher: {
    color: 'bg-violet-600',
    icon: '🔬',
    avatar: 'microscope',
    auraColor: 'from-violet-400/20 to-purple-600/10',
    description: '前卖方首席，产业链从头到尾摸透',
  },
  cycle_theorist: {
    color: 'bg-amber-700',
    icon: '⏳',
    avatar: 'hourglass',
    auraColor: 'from-amber-400/20 to-orange-600/10',
    description: '经济学教授，用百年周期理论解读市场',
  },
};

/** 根据 agentId 获取 UI 属性，未知 ID 返回默认值 */
export function getAgentUI(agentId: string): AgentUIInfo {
  return AGENT_UI_MAP[agentId] || {
    color: 'bg-gray-500',
    icon: '🤖',
    avatar: 'sphere' as AvatarType,
    auraColor: 'from-gray-400/20 to-gray-600/10',
    description: '',
  };
}
