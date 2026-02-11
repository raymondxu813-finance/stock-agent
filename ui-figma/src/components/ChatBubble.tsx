import { useState } from 'react';
import { AgentAvatar } from './AgentAvatar';

interface ChatBubbleProps {
  agent: {
    name: string;
    avatar: string;
    color: string;
  };
  message: string;
  timestamp?: string;
  expandable?: boolean;
}

// Map agent names to avatar types
const getAvatarType = (agentName: string): 'sphere' | 'safe' | 'crystal' | 'rocket' | 'lightning' | 'rings' => {
  if (agentName.includes('Buffett')) return 'safe';
  if (agentName.includes('Cathie')) return 'rocket';
  if (agentName.includes('Munger')) return 'crystal';
  if (agentName.includes('Dalio')) return 'rings';
  if (agentName.includes('Musk')) return 'lightning';
  return 'sphere';
};

export function ChatBubble({ agent, message, timestamp, expandable = false }: ChatBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const shouldTruncate = expandable && !isExpanded && message.length > 200;
  const displayMessage = shouldTruncate ? message.substring(0, 200) + '...' : message;

  return (
    <div className="flex gap-3 px-5 py-4">
      {/* Avatar - Using 3D AgentAvatar */}
      <div className="flex-shrink-0">
        <AgentAvatar type={getAvatarType(agent.name)} size={36} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <h4 className="text-[14px] font-bold text-black">{agent.name}</h4>
          {timestamp && (
            <span className="text-[11px] text-[#999999]">{timestamp}</span>
          )}
        </div>

        <div className="bg-[#F8F8F8] rounded-2xl rounded-tl-sm px-4 py-3 border border-[#EEEEEE]">
          <p className="text-[14px] text-[#333333] leading-relaxed whitespace-pre-wrap">
            {displayMessage}
          </p>
          
          {expandable && message.length > 200 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-[13px] text-[#AAE874] font-medium hover:underline"
            >
              {isExpanded ? 'Show Less' : 'View All'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}