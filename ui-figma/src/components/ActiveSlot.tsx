import { X, Plus } from 'lucide-react';
import { Agent } from '../types';
import { AgentAvatar } from './AgentAvatar';

interface ActiveSlotProps {
  agent?: Agent;
  onRemove?: () => void;
}

export function ActiveSlot({ agent, onRemove }: ActiveSlotProps) {
  if (agent) {
    return (
      <div className="relative">
        <AgentAvatar type={agent.avatarType} size={60} />
        
        {/* Remove button */}
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-6 h-6 bg-[#AAE874] rounded-full flex items-center justify-center shadow-md hover:bg-[#9AD764] transition-colors"
        >
          <X size={14} className="text-white" strokeWidth={3} />
        </button>
      </div>
    );
  }

  // Empty slot
  return (
    <div className="w-[60px] h-[60px] rounded-full border-2 border-dashed border-[#AAE874] flex items-center justify-center bg-[#AAE874]/5">
      <Plus size={24} className="text-[#AAE874]" strokeWidth={2.5} />
    </div>
  );
}
