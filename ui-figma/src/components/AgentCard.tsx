import { Agent } from './AgentLobby';
import { AgentAvatar } from './AgentAvatar';

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function AgentCard({ agent, isSelected, onToggle, disabled }: AgentCardProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        relative p-5 rounded-2xl bg-white text-left transition-all w-[230px] h-[290px] flex-shrink-0 flex flex-col
        ${isSelected 
          ? 'border-2 border-[#AAE874] shadow-[0_8px_32px_rgba(170,232,116,0.25)]' 
          : 'border border-[#E8E8E8] shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]'}
      `}
    >
      {/* Live Pulse Indicator */}
      <div className="absolute top-4 right-4">
        <div className="relative w-2 h-2">
          <div className="absolute inset-0 bg-[#AAE874] rounded-full animate-ping opacity-75" />
          <div className="absolute inset-0 bg-[#AAE874] rounded-full" />
        </div>
      </div>

      {/* Gradient Aura Background */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${agent.auraColor} opacity-0 transition-opacity ${isSelected ? 'opacity-100' : ''}`} />

      {/* Content */}
      <div className="relative flex flex-col h-full">
        {/* Avatar with Aura */}
        <div className="flex justify-center mb-4 flex-shrink-0">
          <div className="relative">
            {/* Aura Glow */}
            <div className={`absolute inset-0 -m-3 rounded-full bg-gradient-to-br ${agent.auraColor} blur-xl`} />
            <div className="relative">
              <AgentAvatar type={agent.avatar} />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-1.5 flex-1 flex flex-col">
          <h3 className="text-[16px] text-black">{agent.name}</h3>
          <p className="text-[12px] text-[#AAE874]">{agent.title}</p>
          <p className="text-[13px] text-[#666666] leading-relaxed flex-1">
            {agent.bio}
          </p>
        </div>
      </div>
    </button>
  );
}