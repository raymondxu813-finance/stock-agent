'use client';

import { Plus, X } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';
import type { AvatarType } from '@/types';

export interface SlotAgent {
  id: string;
  name: string;
  avatar: AvatarType;
  auraColor: string;
}

interface AgentSlotProps {
  agent?: SlotAgent;
  onClick: () => void;
  onDelete?: () => void;
}

export function AgentSlot({ agent, onClick, onDelete }: AgentSlotProps) {
  return (
    <div className="flex flex-col items-center gap-3 relative">
      {/* Circular Slot */}
      <div
        onClick={onClick}
        className="relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
      >
        {agent ? (
          <>
            {/* Filled Slot with Agent Avatar */}
            <div className="relative">
              <AgentAvatar type={agent.avatar} size={80} />
            </div>

            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#AAE874] flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
              >
                <X className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </button>
            )}
          </>
        ) : (
          <>
            {/* Empty Slot */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#AAE874] flex items-center justify-center">
              <Plus className="w-8 h-8 text-[#AAE874]" strokeWidth={2} />
            </div>
          </>
        )}
      </div>

      {/* Agent Name */}
      <span className="text-[13px] text-black font-medium text-center max-w-[90px] truncate">
        {agent?.name || '添加'}
      </span>
    </div>
  );
}
