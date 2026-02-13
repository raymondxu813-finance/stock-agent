'use client';

import { X, Check } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';
import type { SlotAgent } from './AgentSlot';

interface AgentSelectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  agents: SlotAgent[];
  selectedAgents: SlotAgent[];
  onToggle: (agent: SlotAgent) => void;
  minSlots: number;
  maxSlots: number;
}

export function AgentSelectionSheet({
  isOpen,
  onClose,
  agents,
  selectedAgents,
  onToggle,
  minSlots,
  maxSlots,
}: AgentSelectionSheetProps) {
  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 z-[60] bg-white rounded-t-[28px] max-h-[92vh] flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0 shadow-2xl' : 'translate-y-full shadow-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <h2 className="text-[18px] font-bold text-black">AI 顾问团</h2>
            <p className="text-[12px] text-[#999999] mt-0.5">
              已选 <span className={`font-bold ${selectedAgents.length >= minSlots ? 'text-[#7BC74D]' : 'text-[#F59E0B]'}`}>{selectedAgents.length}</span>/{maxSlots} 位
              <span className="text-[#CCCCCC] ml-1">（至少{minSlots}位）</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5F5F5] hover:bg-[#EEEEEE] flex items-center justify-center active:scale-90 transition-all"
          >
            <X className="w-4 h-4 text-[#888888]" />
          </button>
        </div>

        {/* Agent Cards Grid - 2 Columns */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-10">
          <div className="grid grid-cols-2 gap-3.5 gap-y-4">
            {agents.map((agent) => {
              const isSelected = !!selectedAgents.find(a => a.id === agent.id);
              const isAtMin = isSelected && selectedAgents.length <= minSlots;
              const isDisabled = (!isSelected && selectedAgents.length >= maxSlots) || isAtMin;

              return (
                <div key={agent.id} className="relative">
                  {/* Agent Card */}
                  <button
                    onClick={() => onToggle(agent)}
                    disabled={isDisabled}
                    className={`
                      relative p-4 rounded-2xl bg-white text-left transition-all w-full flex flex-col
                      ${isSelected
                        ? 'border-2 border-[#AAE874] shadow-[0_8px_32px_rgba(170,232,116,0.25)]'
                        : 'border border-[#E8E8E8] shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                      }
                      ${isAtMin ? 'cursor-default' : isDisabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.97] hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)]'}
                    `}
                  >
                    {/* Gradient Aura Background */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${agent.auraColor} opacity-0 transition-opacity ${isSelected ? 'opacity-100' : ''}`} />

                    {/* Content */}
                    <div className="relative flex flex-col h-full">
                      {/* Avatar with Aura */}
                      <div className="flex justify-center mb-3 flex-shrink-0">
                        <div className="relative">
                          {/* Aura Glow */}
                          <div className={`absolute inset-0 -m-2 rounded-full bg-gradient-to-br ${agent.auraColor} blur-xl`} />
                          <div className="relative">
                            <AgentAvatar type={agent.avatar} size={56} />
                          </div>
                        </div>
                      </div>

                      {/* Text Content */}
                      <div className="space-y-1 flex-1 flex flex-col items-center text-center">
                        <h3 className="text-[14px] text-black font-bold">{agent.name}</h3>
                        {agent.description && (
                          <p className="text-[11px] text-[#999999] leading-snug">{agent.description}</p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Single Checkmark Indicator - Top Right */}
                  {isSelected ? (
                    <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md z-10 ${isAtMin ? 'bg-[#AAE874]/60' : 'bg-[#AAE874]'}`}>
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    !isDisabled && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-[#E8E8E8] bg-white flex items-center justify-center z-10" />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
