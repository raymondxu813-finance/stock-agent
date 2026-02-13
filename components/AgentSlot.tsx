'use client';

import { Plus } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';
import type { AvatarType } from '@/types';

export interface SlotAgent {
  id: string;
  name: string;
  description?: string;
  avatar: AvatarType;
  auraColor: string;
}

interface AgentSlotProps {
  agent?: SlotAgent;
  onClick: () => void;
  onDelete?: () => void;
}

export function AgentSlot({ agent, onClick }: AgentSlotProps) {
  return (
    <div className="flex flex-col items-center gap-2 relative">
      {/* Circular Slot */}
      <div
        onClick={onClick}
        className="relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
      >
        {agent ? (
          <div className="relative">
            <AgentAvatar type={agent.avatar} size={80} />
          </div>
        ) : (
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#E0E0E0] flex items-center justify-center bg-[#FAFAFA]">
            <Plus className="w-6 h-6 text-[#CCCCCC]" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Agent Name */}
      {agent && (
        <span className="text-[12px] text-[#333333] font-medium text-center max-w-[90px] truncate">
          {agent.name}
        </span>
      )}
    </div>
  );
}
