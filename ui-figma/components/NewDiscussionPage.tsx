import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { Agent, Discussion, AgentComment } from '../App';

type NewDiscussionPageProps = {
  onBack: () => void;
  onCreateDiscussion: (discussion: Discussion) => void;
};

const PRESET_AGENTS: Agent[] = [
  {
    id: 'gpt',
    name: 'GPT',
    description: '从宏观经济周期和政策环境评估大势和板块机会',
    color: 'bg-emerald-500',
    icon: '✨',
    selected: false,
  },
  {
    id: 'claude',
    name: 'Claude',
    description: '从资产配置和风险管理角度评估策略合理性',
    color: 'bg-orange-500',
    icon: '👂',
    selected: false,
  },
  {
    id: 'grok',
    name: 'Grok',
    description: '从一线市场实战角度判断能不能真正赚到钱',
    color: 'bg-gray-800',
    icon: '⚡',
    selected: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: '从长期投资和人性角度给出大方向策略',
    color: 'bg-blue-500',
    icon: '◆',
    selected: false,
  },
];

export function NewDiscussionPage({ onBack, onCreateDiscussion }: NewDiscussionPageProps) {
  const [title, setTitle] = useState('');
  const [background, setBackground] = useState('');
  const [agents, setAgents] = useState<Agent[]>(PRESET_AGENTS);

  const toggleAgent = (id: string) => {
    setAgents(agents.map(agent => 
      agent.id === id ? { ...agent, selected: !agent.selected } : agent
    ));
  };

  const selectedCount = agents.filter(a => a.selected).length;
  const canStart = title.trim() !== '' && selectedCount >= 3;

  const handleStart = () => {
    if (!canStart) return;

    const selectedAgents = agents.filter(a => a.selected);
    
    // 生成模拟讨论数据
    const mockComments: AgentComment[] = selectedAgents.map(agent => ({
      agentId: agent.id,
      agentName: agent.name,
      agentColor: agent.color,
      content: agent.id === 'gpt' 
        ? '我认为今年的 BTC 走势总体上是看涨的。主要原因是今年全球经济的不确定性增加，投资者往往会将比特币视作一种"数字黄金"，来对冲通货膨胀和其他宏观经济风险。\n\n首先，通胀压力仍然存在。尽管各国央行都在努力控制通胀，但政策效果往往滞后，因此投资者可能会选择比特币作为一种抗通胀的工具。\n\n其次，今年以来，不少大型金融机构和公司开始增加对比特币的配置。例如，MicroStrategy 和特斯拉等公司继续持有大量比特币，显示出对其长期价值的信心。\n\n此外，比特币减半事件历史上都伴随着价格的大幅上涨。2024 年 4 月的减半预计会减少新增供应，从供需角度看，这应该会支撑价格。\n\n最后，越来越多的国家和地区开始接受比特币作为合法支付手段，这进一步增强了其作为价值存储工具的地位。整体来看，多重利好因素叠加，BTC 今年的走势值得期待。'
        : agent.id === 'claude'
        ? '我对今年 BTC 走势持谨慎乐观态度。\n\n我认为 2024 年 BTC 有望测试并突破前高，但波动性会显著增加。\n\n核心逻辑链\n\n因为：4月份 BTC 减半事件历史上都伴随着供应冲击 → 所以：新增供应从 900 枚/天降至 450 枚/天，而 ETF 需求持续 → 因此：供需失衡可能推动价格上行\n\n支撑证据\n\n1. 机构需求实质性改变：美国现货 BTC ETF（1月批准）前两个月净流入超过 100 亿美元，这是 2017 年同期完全不存在的变量\n\n2. 宏观环境转向：美联储可能在 Q2-Q3 开始降息，历史上宽松周期对风险资产有利\n\n3. 供应侧变化：4 月减半后，BTC 年通胀率降至约 0.85%，低于黄金的 1.5-2%\n\n然而需要警惕的风险\n\n• 地缘政治不确定性可能引发避险情绪逆转\n• ETF 资金流入的持续性存疑，特别是价格快速上涨后\n• 监管政策变化，尤其是美国大选年的政策不确定性\n\n因此我的建议是：如果你风险承受能力较高，可以考虑配置 10-20% 的仓位，但要做好应对 30-40% 回撤的心理准备。'
        : agent.id === 'gemini'
        ? '我认为今年 BTC 的走势整体向上，但过程中会有多次震荡。\n\n首先，减半效应是推动 BTC 价格上涨的重要因素。历史数据显示，每次减半后的一年左右，BTC 都会迎来一波显著的上涨。从"因为减半减少了 BTC 的供应量 → 所以长期来看会推高价格 → 因此今年大概率会延续历史规律"这个逻辑链来看，减半效应构成了一个上涨基础。\n\n其次，机构资金的持续流入是支撑 BTC 价格的重要力量。例如，贝莱德、富达等机构的 BTC ETF 持续吸引资金流入，仅前两个月就净流入超过 100 亿美元。这种机构级别的需求在历史上是前所未有的，显示出传统金融对加密资产态度的根本性转变。\n\n第三，从技术指标来看，BTC 目前处于一个相对健康的上升通道中。虽然短期会有回调，但整体趋势向上的概率较大。市场情绪指数也显示，当前并未进入过度贪婪区域，还有上涨空间。\n\n不过，我也要提醒几个需要关注的风险点：\n\n1. 宏观经济环境变化：如果美联储降息不及预期，或者全球经济出现衰退迹象，可能会影响 BTC 的表现\n\n2. 监管政策风险：各国对加密货币的监管政策仍在演变，重大监管事件可能引发短期波动\n\n3. 市场操纵风险：加密货币���场相对较小，容易受到大户操纵\n\n综合来看，我建议投资者采取分批建仓的策略，不要一次性重仓，同时设置好止损位。如果你是长期投资者（3-5年维度），当前价位可以考虑开始布局。'
        : '我认为今年 BTC 将呈现震荡上行的格局，年度涨幅有望达到 50%-80%，但需要注意波动性和阶段性回调风险。\n\n从我多年的投资经验来看，成功的关键不在于预测短期涨跌，而在于理解长期趋势和控制风险。对于 BTC 而言，它已经从一个小众的极客玩具，发展成为一个被主流金融机构认可的资产类别。\n\n为什么我看好 BTC 的长期价值？\n\n1. 稀缺性：BTC 总量恒定在 2100 万枚，这种绝对稀缺性是任何法币都无法比拟的\n\n2. 去中心化：不受任何单一政府或机构控制，这在当前地缘政治不确定性增加的背景下尤为重要\n\n3. 网络效应：随着越来越多的人接受和使用 BTC，其价值会自我强化\n\n4. 机构采纳：从 PayPal 到特斯拉，从 MicroStrategy 到贝莱德，越来越多的主流机构正在拥抱 BTC\n\n关于投资策略，我的建议是：\n\n• 长期持有：不要试图做短线交易，时间是 BTC 投资者最好的朋友\n• 定期定额：采用 DCA（Dollar Cost Averaging）策略，分散买入时机\n• 仓位控制：BTC 配置不应超过你投资组合的 5-10%，除非你风险承受能力极高\n• 冷静应对波动：BTC 的波动性很大，30-50% 的回调是常态，要有心理准备\n\n最后，我想强调的是：投资 BTC 就是投资未来。但请记住，永远不要投入你输不起的钱，也不要被短期的价格波动影响你的判断。真正的财富是在长期的坚持中积累的。',
      expanded: false,
    }));

    const newDiscussion: Discussion = {
      title,
      background,
      agents: selectedAgents,
      comments: mockComments,
      moderatorAnalysis: {
        round: 1,
        consensusLevel: 60,
        summary: '本轮讨论中，参与者普遍认为 BTC 今年将呈现上涨趋势，主要受到减半事件、机构投资增加和宏观经济环境的推动。然而，对于具体的风险因素，如宏观经济变化、新技术发展等，还需要进一步讨论。',
        newPoints: [
          'ETF 资金流入是可持续性是个关键问题',
          '宏观经济政策的不确定性对 BTC 价格影响显著需警惕',
        ],
        consensus: [
          {
            content: '比特币的减半效应和机构投资将推动价格上涨。',
            agents: ['GPT', 'Claude', 'Gemini'],
            percentage: 60,
          },
        ],
        disagreements: [
          {
            topic: 'ETF 资金流入的可��续性',
            description: '讨论集中于 ETF 资金流入是否能够持续，特别是减半后价格上涨时机构仓位的反应。',
            supportAgents: [
              { name: '减半效应未被完全消化，ETF...', color: 'bg-orange-500' },
            ],
            opposeAgents: [
              { name: '减半期望已 price in，短...', color: 'bg-emerald-500' },
              { name: 'ETF 流入价在持续，未来全面...', color: 'bg-blue-500' },
              { name: 'ETF 资金流入未被全面纳入...', color: 'bg-gray-800' },
            ],
          },
          {
            topic: '宏观经济对 BTC 价格的影响',
            description: '关于美联储政策变动，尤其是美联储政策对 BTC 价格的影响存在分歧，尤其是整个宏观不确定性。',
            supportAgents: [
              { name: '降息预期利好 BTC，但随...', color: 'bg-orange-500' },
              { name: '降息将低利率环境，未来全...', color: 'bg-blue-500' },
            ],
            opposeAgents: [
              { name: '降息预期已被市场 price in...', color: 'bg-emerald-500' },
              { name: '降息将释放流动性，未...', color: 'bg-gray-800' },
            ],
          },
        ],
      },
    };

    onCreateDiscussion(newDiscussion);
  };

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="flex-1 text-center text-lg text-gray-900">新建讨论</h1>
        <div className="w-9"></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Topic Input */}
          <div className="bg-white rounded-2xl p-4">
            <label className="block text-sm text-gray-700 mb-2">讨论话题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：腾讯股票接下来走势如何"
              className="w-full px-0 py-2 text-base text-gray-900 placeholder-gray-400 border-0 border-b border-gray-200 focus:outline-none focus:border-blue-500"
            />

            <label className="block text-sm text-gray-700 mb-2 mt-6">背景说明（可选）</label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="你的持仓情况、关注点等..."
              rows={3}
              className="w-full px-0 py-2 text-sm text-gray-900 placeholder-gray-400 border-0 border-b border-gray-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Agent Selection */}
          <div className="bg-white rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-gray-900">选择参与的 AI（至少3个）</h2>
              <span className="text-xs text-gray-500">{selectedCount}/4</span>
            </div>

            <div className="space-y-3">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    agent.selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 ${agent.color} rounded-full flex items-center justify-center text-xl flex-shrink-0`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base text-gray-900">{agent.name}</span>
                        {agent.selected && (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-24"></div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full py-4 rounded-full transition-all text-base ${
            canStart
              ? 'bg-indigo-500 text-white shadow-lg active:scale-95'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          开始讨论
        </button>
      </div>
    </div>
  );
}