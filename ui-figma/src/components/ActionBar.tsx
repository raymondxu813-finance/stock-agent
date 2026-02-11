import { SendHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { useChatContext } from '../context/ChatContext';

interface ActionBarProps {
  selectedCount: number;
  disabled?: boolean;
}

export function ActionBar({ selectedCount, disabled }: ActionBarProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const { setUserQuestion } = useChatContext();

  const handleSend = () => {
    if (message.trim() && !disabled) {
      setUserQuestion(message);
      navigate('/nexus');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-4 z-50">
      {/* Glassmorphic Background with Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#AAE874]/10 via-white/95 to-white/90 backdrop-blur-xl" />
      
      {/* Input Bar Container */}
      <div className="relative flex items-center gap-3">
        {/* Input Field */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your question..."
            className="w-full px-5 py-3.5 bg-white border border-[#E8E8E8] rounded-full text-[15px] text-black placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#AAE874] focus:shadow-[0_0_0_3px_rgba(170,232,116,0.1)] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={`
            flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all
            ${message.trim() && !disabled
              ? 'bg-[#AAE874] active:scale-95 shadow-[0_4px_16px_rgba(170,232,116,0.4)] hover:shadow-[0_6px_20px_rgba(170,232,116,0.5)]' 
              : 'bg-[#E8E8E8] cursor-not-allowed opacity-50'
            }
          `}
        >
          <SendHorizontal className="w-5 h-5 text-white" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}