import { DiscussionHeader } from './DiscussionHeader';
import { TypingChatBubble } from './TypingChatBubble';
import { ErrorMessage } from './ErrorMessage';
import { ConsensusCard } from './ConsensusCard';
import { DiscussionInput } from './DiscussionInput';
import { HistoryDrawer } from './HistoryDrawer';
import { AnalysisReportEntry } from './AnalysisReportEntry';
import { useState, useEffect, useRef } from 'react';
import { useChatContext } from '../context/ChatContext';
import { ArrowDown } from 'lucide-react';

const agents = {
  buffett: { name: 'AI Buffett', avatar: 'WB', color: '#F59E0B' },
  cathie: { name: 'AI Cathie', avatar: 'CW', color: '#A855F7' },
  munger: { name: 'AI Munger', avatar: 'CM', color: '#06B6D4' },
  dalio: { name: 'AI Dalio', avatar: 'RD', color: '#10B981' },
  musk: { name: 'AI Musk', avatar: 'EM', color: '#3B82F6' },
};

// Mock AI responses based on question
const generateResponses = (question: string) => [
  {
    agent: agents.buffett,
    message: `从价值投资的角度来看，我会首先关注基本面分析。\n\n对于"${question}"这个问题，我们需要考察：\n1. 内在价值评估\n2. 安全边际原则\n3. 长期现金流质量\n\n建议采用保守的估值方法，确保有足够的安全边际。`,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  },
  {
    agent: agents.cathie,
    message: `从创新和颠覆性技术的视角，我有不同的看法。\n\n这个问题涉及到未来趋势的判断。我们应该关注：\n• 技术创新的指数级增长\n• 市场颠覆的可能性\n• 长期价值创造潜力\n\n创新投资需要承担更高风险，但回报潜力也更大。`,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  },
  {
    agent: agents.munger,
    message: `让我用跨学科的思维模型来分析。\n\n单一视角往往是不够的。我们需要：\n1. 心理学：避免认知偏误\n2. 经济学：理解激励机制\n3. 数学：概率思维\n\n建议大家运用"逆向思维"——先想清楚如何失败，然后避免那些错误。`,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  },
];

export function SynergyNexus() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { userQuestion } = useChatContext();
  const [currentTypingIndex, setCurrentTypingIndex] = useState(-1);
  const [aiResponses, setAiResponses] = useState<typeof generateResponses[0][]>([]);
  const [messages, setMessages] = useState<Array<{ type: 'user' | 'ai'; content: any }>>([]);
  const [showConsensus, setShowConsensus] = useState(false);
  const [showBackToBottom, setShowBackToBottom] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize AI responses when component mounts with a question
  useEffect(() => {
    if (userQuestion && messages.length === 0) {
      setMessages([{ type: 'user', content: userQuestion }]);
      const responses = generateResponses(userQuestion);
      setAiResponses(responses);
      // Start typing the first response after a brief delay
      setTimeout(() => {
        setCurrentTypingIndex(0);
      }, 500);
    }
  }, [userQuestion]);

  // Auto-scroll to bottom when new content appears
  useEffect(() => {
    if (chatContainerRef.current) {
      const scrollContainer = chatContainerRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [currentTypingIndex, messages, showConsensus]);

  // Handle scroll to show/hide back to bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowBackToBottom(!isNearBottom && showConsensus);
      }
    };

    const scrollContainer = chatContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [showConsensus]);

  const handleTypingComplete = (index: number) => {
    // Move to next agent after a brief pause
    setTimeout(() => {
      if (index < aiResponses.length - 1) {
        setCurrentTypingIndex(index + 1);
      } else {
        // All agents have finished - show consensus card after a delay
        setTimeout(() => {
          setShowConsensus(true);
        }, 1000);
      }
    }, 800);
  };

  const handleSendMessage = (message: string) => {
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: message }]);
    
    // Generate new AI responses
    const newResponses = generateResponses(message);
    setAiResponses(prev => [...prev, ...newResponses]);
    
    // Start typing from the new responses
    setTimeout(() => {
      setCurrentTypingIndex(aiResponses.length);
    }, 500);
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 flex flex-col">
      {/* Header */}
      <DiscussionHeader onHistoryClick={() => setIsHistoryOpen(true)} />

      {/* Analysis Report Entry - Only visible after first consensus */}
      {showConsensus && <AnalysisReportEntry />}

      {/* History Drawer */}
      <HistoryDrawer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      {/* Chat Container */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
        {/* User Message Bubble */}
        {userQuestion && (
          <div className="flex justify-end px-5 pt-4 pb-2">
            <div className="max-w-[70%] bg-[#AAE874] rounded-2xl rounded-tr-md px-4 py-2.5">
              <p className="text-[14px] text-black leading-relaxed">
                {userQuestion}
              </p>
            </div>
          </div>
        )}

        {/* AI Responses with Sequential Typing */}
        <div className="space-y-0 pb-4">
          {aiResponses.map((item, index) => {
            // Only render if this agent has started or completed typing
            if (index > currentTypingIndex) {
              return null;
            }
            
            return (
              <TypingChatBubble
                key={index}
                agent={item.agent}
                message={item.message}
                timestamp={item.timestamp}
                expandable={true}
                isTyping={index === currentTypingIndex}
                typingSpeed={20}
                onTypingComplete={() => handleTypingComplete(index)}
              />
            );
          })}
        </div>

        {/* Consensus Card - Shown after all agents finish */}
        {showConsensus && (
          <ConsensusCard 
            question={userQuestion || "关于 2024 年比特币走势的分析"}
            consensusPercentage={60}
            round={1}
            version="v3"
          />
        )}
      </div>

      {/* Back to Bottom Button */}
      {showBackToBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed right-5 bottom-28 z-40 w-12 h-12 rounded-full bg-[#AAE874] shadow-[0_4px_20px_rgba(170,232,116,0.4)] flex items-center justify-center active:scale-95 transition-all hover:shadow-[0_6px_24px_rgba(170,232,116,0.5)]"
        >
          <ArrowDown className="w-5 h-5 text-white" strokeWidth={2.5} />
        </button>
      )}

      {/* Input Bar */}
      <DiscussionInput onSendMessage={handleSendMessage} />
    </div>
  );
}