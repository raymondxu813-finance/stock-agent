import { Menu, SquarePen } from 'lucide-react';
import { useNavigate } from 'react-router';

interface DiscussionHeaderProps {
  onHistoryClick: () => void;
}

export function DiscussionHeader({ onHistoryClick }: DiscussionHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-[#F0F0F0]">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between px-5 py-4">
        {/* Hamburger Menu - Left */}
        <button
          onClick={onHistoryClick}
          className="w-10 h-10 rounded-full border border-[#E0E0E0] flex items-center justify-center active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5 text-[#333333]" strokeWidth={1.5} />
        </button>

        {/* Title - Center */}
        <h1 className="text-[16px] font-medium text-black">Leapcat Multi Agent</h1>

        {/* New Chat Icon - Right */}
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-lg border border-[#E0E0E0] flex items-center justify-center active:scale-95 transition-transform"
        >
          <SquarePen className="w-5 h-5 text-[#333333]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}