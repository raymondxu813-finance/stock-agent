import { Agent } from './AgentLobby';
import { AgentAvatar } from './AgentAvatar';
import { X, Plus } from 'lucide-react';

interface ActiveMatrixProps {
  selectedAgents: Agent[];
  onRemove: (agentId: string) => void;
}

export function ActiveMatrix({ selectedAgents, onRemove }: ActiveMatrixProps) {
  const slots = Array(5).fill(null).map((_, i) => selectedAgents[i] || null);

  return (
    <div className="space-y-6">
      {/* Header - Left Aligned */}
      <div className="text-left">
        <h2 className="text-[22px] text-black font-bold mb-1 font-normal">AI Advisors</h2>
        <p className="text-[14px] text-[#888888]">
          Selected {selectedAgents.length}/5
        </p>
      </div>

      {/* Slots - Left Aligned */}
      <div className="relative flex justify-start gap-4 py-8">
        {/* Connecting Energy Lines */}
        {selectedAgents.length > 0 && (
          <div className="absolute inset-0 flex items-start justify-start pointer-events-none">
            <svg className="absolute w-full h-full" style={{ top: '-60px' }}>
              {selectedAgents.map((agent, index) => {
                const slotX = 8 + (index * 17); // Adjusted for left alignment
                return (
                  <line
                    key={agent.id}
                    x1="15%"
                    y1="0"
                    x2={`${slotX}%`}
                    y2="100"
                    stroke="#AAE874"
                    strokeWidth="1"
                    opacity="0.3"
                    strokeDasharray="4 4"
                  />
                );
              })}
            </svg>
          </div>
        )}

        {slots.map((agent, index) => (
          <div key={index} className="relative">
            {agent ? (
              <>
                {/* Occupied Slot with Glow */}
                <div className="relative w-[64px] h-[64px]">
                  {/* Glow Effect */}
                  <div className="absolute inset-0 rounded-full bg-[#AAE874] opacity-20 blur-xl animate-pulse" />
                  
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="w-[60px] h-[60px]">
                      <AgentAvatar type={agent.avatar} size={60} />
                    </div>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => onRemove(agent.id)}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#AAE874] flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  <X className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </button>
              </>
            ) : (
              /* Empty Slot */
              <div className="w-[64px] h-[64px] rounded-full border-2 border-dashed border-[#AAE874]/50 flex items-center justify-center bg-[#AAE874]/5">
                <Plus className="w-6 h-6 text-[#AAE874]/50" strokeWidth={2} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}