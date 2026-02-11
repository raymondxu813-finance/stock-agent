import { X, Check } from 'lucide-react';
import { Agent } from './AgentLobby';
import { AgentAvatar } from './AgentAvatar';

interface AgentSelectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  selectedAgents: Agent[];
  onToggle: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
  maxSlots: number;
}

export function AgentSelectionSheet({
  isOpen,
  onClose,
  agents,
  selectedAgents,
  onToggle,
  onDelete,
  maxSlots,
}: AgentSelectionSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[32px] shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#F0F0F0]">
          <h2 className="text-[18px] font-bold text-black">AI Advisors</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F8F8F8] flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-5 h-5 text-[#666666]" />
          </button>
        </div>

        {/* Agent Cards Grid - 2 Columns */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            {agents.map((agent) => {
              const isSelected = !!selectedAgents.find(a => a.id === agent.id);
              const isDisabled = !isSelected && selectedAgents.length >= maxSlots;

              return (
                <div key={agent.id} className="relative">
                  {/* Agent Card - Responsive Width */}
                  <button
                    onClick={() => onToggle(agent)}
                    disabled={isDisabled}
                    className={`
                      relative p-4 rounded-2xl bg-white text-left transition-all w-full flex flex-col
                      ${isSelected 
                        ? 'border-2 border-[#AAE874] shadow-[0_8px_32px_rgba(170,232,116,0.25)]' 
                        : 'border border-[#E8E8E8] shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
                      }
                      ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]'}
                    `}
                  >
                    {/* Live Pulse Indicator */}
                    <div className="absolute top-3 left-3">
                      <div className="relative w-1.5 h-1.5">
                        <div className="absolute inset-0 bg-[#AAE874] rounded-full animate-ping opacity-75" />
                        <div className="absolute inset-0 bg-[#AAE874] rounded-full" />
                      </div>
                    </div>

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
                            <AgentAvatar type={agent.avatar} size={60} />
                          </div>
                        </div>
                      </div>

                      {/* Text Content */}
                      <div className="space-y-1 flex-1 flex flex-col">
                        <h3 className="text-[14px] text-black font-medium">{agent.name}</h3>
                        <p className="text-[11px] text-[#AAE874]">{agent.title}</p>
                        <p className="text-[12px] text-[#666666] leading-relaxed flex-1 line-clamp-3">
                          {agent.bio}
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Single Checkmark Indicator - Top Right */}
                  {isSelected ? (
                    // Selected State: Filled Green Circle with White Checkmark
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#AAE874] flex items-center justify-center shadow-lg z-10">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    // Unselected State: Empty Circle with Light Stroke
                    !isDisabled && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full border-2 border-[#E8E8E8] bg-white flex items-center justify-center z-10" />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}