import { ChevronDown, Check, AlertCircle, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface ConsensusCardProps {
  question?: string;
  consensusPercentage?: number;
  round?: number;
  version?: string;
}

export function ConsensusCard({ 
  question = "关于 2024 年比特币走势的分析",
  consensusPercentage = 60,
  round = 1,
  version = "v3"
}: ConsensusCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPendingDetails, setShowPendingDetails] = useState(false);

  return (
    <div className="mx-5 mb-6">
      {/* Main Consensus Card */}
      <div className="relative">
        {/* Outer Glow */}
        <div className="absolute inset-0 bg-[#AAE874] opacity-8 blur-3xl rounded-[32px]" />
        
        {/* Card Container */}
        <div className="relative bg-white rounded-[28px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden border border-[#F0F0F0]">
          {/* Card Header */}
          <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#AAE874]/15 flex items-center justify-center">
                <span className="text-[14px]">🤖</span>
              </div>
              <h2 className="text-[15px] font-bold text-black">主持人分析</h2>
              <span className="px-2 py-0.5 bg-[#AAE874]/15 text-[11px] text-[#AAE874] font-bold rounded-full">
                第 {round} 轮
              </span>
            </div>
            <button className="px-3 py-1.5 bg-[#AAE874] text-white text-[12px] font-medium rounded-full shadow-sm active:scale-95 transition-transform">
              查看摘要
            </button>
          </div>

          {/* Consensus Meter */}
          <div className="px-5 py-4 bg-gradient-to-br from-[#FEFEFE] to-[#FAFAFA]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-[#666666] font-medium">共识度</span>
              <span className="text-[28px] font-bold text-[#F59E0B]">{consensusPercentage}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${consensusPercentage}%`,
                  background: `linear-gradient(90deg, #F59E0B 0%, ${consensusPercentage >= 70 ? '#AAE874' : '#FFD93D'} 100%)`
                }}
              />
            </div>
          </div>

          {/* Summary Section */}
          <div className="px-5 py-4 space-y-4">
            {/* Main Summary Text */}
            <div className="bg-[#F8F8F8] rounded-2xl p-4 border border-[#EEEEEE]">
              <p className="text-[13px] text-[#333333] leading-relaxed">
                本轮讨论中，参与者普遍认为 BTC 今年将呈上涨趋势，主要受到机构观经济环境影响。建议关注并机构投资的推动，然而，对于具体的风险因素，如宏观经济冲击等...
              </p>
            </div>

            {/* New Viewpoints */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="text-[14px] font-bold text-black">本轮新观点</h3>
              </div>
              <ul className="space-y-2 pl-6">
                <li className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                  <span className="text-[#F59E0B] font-bold">•</span>
                  <span>ETF 资金流入的可持续性是个关键问题</span>
                </li>
                <li className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                  <span className="text-[#F59E0B] font-bold">•</span>
                  <span>宏观经济政策的不确定性会 BTC 价格影响重大</span>
                </li>
              </ul>
            </div>

            {/* Consensus Achieved */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#AAE874]" strokeWidth={2.5} />
                <h3 className="text-[14px] font-bold text-black">已达成共识</h3>
              </div>
              <ul className="space-y-2 pl-6">
                <li className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                  <span className="text-[#AAE874] font-bold">•</span>
                  <span>BTC 今年总体趋势看涨</span>
                </li>
                <li className="flex gap-2 text-[13px] text-[#333333] leading-relaxed">
                  <span className="text-[#AAE874] font-bold">•</span>
                  <span>减半应该会提升 BTC 价格上涨</span>
                </li>
              </ul>
            </div>

            {/* Pending Discussion */}
            <div className="space-y-2">
              <button 
                onClick={() => setShowPendingDetails(!showPendingDetails)}
                className="flex items-center gap-2 w-full"
              >
                <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="text-[14px] font-bold text-black flex-1 text-left">仍在讨论</h3>
                <ChevronDown 
                  className={`w-4 h-4 text-[#999999] transition-transform ${showPendingDetails ? 'rotate-180' : ''}`} 
                />
              </button>
              
              {showPendingDetails && (
                <div className="space-y-3 pl-6">
                  {/* ETF Discussion */}
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#EEEEEE]">
                    <h4 className="text-[13px] font-bold text-black mb-2">ETF 资金流入的可持续性</h4>
                    <p className="text-[12px] text-[#666666] mb-2">
                      参与者就 ETF 资金流入是否已经接近峰值存在分歧...
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white rounded-lg px-2 py-1.5 text-[11px] text-[#666666] border border-[#E8E8E8]">
                        ETF 资金流入已触 price in...
                      </div>
                      <div className="flex-1 bg-white rounded-lg px-2 py-1.5 text-[11px] text-[#666666] border border-[#E8E8E8] flex items-center justify-end">
                        ETF 资金流入未来会反扑...
                        <div className="flex ml-1">
                          <div className="w-4 h-4 rounded-full bg-[#F59E0B] border-2 border-white" />
                          <div className="w-4 h-4 rounded-full bg-[#A855F7] border-2 border-white -ml-1.5" />
                          <div className="w-4 h-4 rounded-full bg-[#06B6D4] border-2 border-white -ml-1.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BTC Price Discussion */}
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#EEEEEE]">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-bold text-black">宏观经济对 BTC 价格的影响</h4>
                      <ChevronDown className="w-4 h-4 text-[#999999]" />
                    </div>
                    <p className="text-[12px] text-[#666666] mt-2">
                      关于宏观经济变动、尤其美联储货币政策对 BTC 价格的影响...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}