import { useState, useEffect } from 'react';
import { AgentAvatar } from './AgentAvatar';

interface TypingChatBubbleProps {
  agent: {
    name: string;
    avatar: string;
    color: string;
  };
  message: string;
  timestamp?: string;
  expandable?: boolean;
  isTyping: boolean;
  typingSpeed?: number;
  onTypingComplete?: () => void;
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

export function TypingChatBubble({ 
  agent, 
  message, 
  timestamp, 
  expandable = false,
  isTyping,
  typingSpeed = 30,
  onTypingComplete 
}: TypingChatBubbleProps) {
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(isTyping);

  useEffect(() => {
    if (!isTyping || message.length === 0) {
      setDisplayedMessage(message);
      setShowTypingIndicator(false);
      return;
    }

    setShowTypingIndicator(true);
    setDisplayedMessage('');
    
    let currentIndex = 0;
    const timer = setInterval(() => {
      if (currentIndex < message.length) {
        setDisplayedMessage(message.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(timer);
        setShowTypingIndicator(false);
        if (onTypingComplete) {
          onTypingComplete();
        }
      }
    }, typingSpeed);

    return () => clearInterval(timer);
  }, [message, isTyping, typingSpeed, onTypingComplete]);

  const shouldTruncate = expandable && !isExpanded && displayedMessage.length > 200;
  const finalDisplayMessage = shouldTruncate ? displayedMessage.substring(0, 200) + '...' : displayedMessage;

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
          {timestamp && !showTypingIndicator && (
            <span className="text-[11px] text-[#999999]">{timestamp}</span>
          )}
          {showTypingIndicator && (
            <span className="text-[11px] text-[#AAE874] font-medium flex items-center gap-1">
              typing
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-[#AAE874] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </span>
          )}
        </div>

        {(displayedMessage || showTypingIndicator) && (
          <div className="bg-[#F8F8F8] rounded-2xl rounded-tl-sm px-4 py-3 border border-[#EEEEEE]">
            {finalDisplayMessage && (
              <>
                <p className="text-[14px] text-[#333333] leading-relaxed whitespace-pre-wrap">
                  {finalDisplayMessage}
                  {showTypingIndicator && <span className="inline-block w-0.5 h-4 bg-[#AAE874] ml-0.5 animate-pulse" />}
                </p>
                
                {expandable && displayedMessage.length > 200 && !showTypingIndicator && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 text-[13px] text-[#AAE874] font-medium hover:underline"
                  >
                    {isExpanded ? 'Show Less' : 'View All'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
