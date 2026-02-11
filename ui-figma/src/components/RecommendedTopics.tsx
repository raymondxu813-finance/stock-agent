import { useNavigate } from 'react-router';
import { useChatContext } from '../context/ChatContext';
import { useRef, useState, useEffect } from 'react';

const topics = [
  "Analyze the impact of BTC halving in 2024",
  "AI industry growth trends for the next decade",
  "Comparison of value investing vs. growth investing",
  "How will Fed rate cuts affect tech stocks?",
];

export function RecommendedTopics() {
  const navigate = useNavigate();
  const { setUserQuestion } = useChatContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleTopicClick = (topic: string) => {
    setUserQuestion(topic);
    navigate('/nexus');
  };

  // Update active index based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const scrollLeft = scrollRef.current.scrollLeft;
        const cardWidth = 280; // approximate card width + gap
        const newIndex = Math.round(scrollLeft / cardWidth);
        setActiveIndex(newIndex);
      }
    };

    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="px-5 mb-3">
      {/* Scrollable Cards */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth"
      >
        {topics.map((topic, index) => (
          <button
            key={index}
            onClick={() => handleTopicClick(topic)}
            className="flex-shrink-0 w-[calc(100%-40px)] snap-start bg-white rounded-full px-4 py-2.5 border border-[#E8E8E8] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-[#AAE874] hover:shadow-[0_4px_12px_rgba(170,232,116,0.2)] active:scale-[0.98] transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#AAE874]/10 flex items-center justify-center group-hover:bg-[#AAE874]/20 transition-colors">
                <span className="text-[14px]">💡</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#333333] font-medium truncate">
                  {topic}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}