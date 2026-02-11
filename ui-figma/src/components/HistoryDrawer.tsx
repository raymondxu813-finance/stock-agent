import { X, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const historyData = {
  today: [
    { id: 1, title: '对标巴菲特2025年持股组合分析', time: '下午 3:24' }
  ],
  last7Days: [
    { id: 2, title: '近代欧美、欧陆发展比较及与中国的平行关系解读', time: '2月5日' },
    { id: 3, title: '核心金融知识对新手资方整理笔记之一', time: '2月4日' }
  ],
  earlier: [
    { id: 4, title: '近代欧美、欧陆发展比较及与中国的平行关系解读', time: '1月28日' },
    { id: 5, title: '核心金融知识对新手资方整理笔记之一', time: '1月26日' }
  ]
};

export function HistoryDrawer({ isOpen, onClose }: HistoryDrawerProps) {
  const navigate = useNavigate();

  const handleNewChat = () => {
    navigate('/');
    onClose();
  };

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 bottom-0 w-[280px] bg-white z-[70] shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F0]">
          <h2 className="text-[19px] font-bold text-black">历史消息</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] active:scale-95 transition-all"
          >
            <X className="w-5 h-5 text-[#666666]" strokeWidth={2} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-5 pt-5 pb-4">
          <button
            onClick={handleNewChat}
            className="w-full h-11 rounded-full border-2 border-[#AAE874] bg-white text-[15px] font-bold text-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-[#AAE874]/5"
          >
            <span className="text-[20px] text-[#AAE874]">+</span>
            新建对话
          </button>
        </div>

        {/* Scrollable History */}
        <div className="flex-1 overflow-y-auto pb-20" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {/* Today Section */}
          <div className="px-5 pb-4">
            <h3 className="text-[12px] font-bold text-[#999999] mb-3">今天</h3>
            <div className="space-y-2">
              {historyData.today.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors"
                >
                  <p className="text-[14px] text-[#333333] line-clamp-2 leading-relaxed">
                    {item.title}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Last 7 Days Section */}
          <div className="px-5 pb-4">
            <h3 className="text-[12px] font-bold text-[#999999] mb-3">7天内</h3>
            <div className="space-y-2">
              {historyData.last7Days.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors"
                >
                  <p className="text-[14px] text-[#333333] line-clamp-2 leading-relaxed">
                    {item.title}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Earlier Section */}
          <div className="px-5 pb-4">
            <h3 className="text-[12px] font-bold text-[#999999] mb-3">更早</h3>
            <div className="space-y-2">
              {historyData.earlier.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors"
                >
                  <p className="text-[14px] text-[#333333] line-clamp-2 leading-relaxed">
                    {item.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer - User Guide */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#F0F0F0] px-5 py-4">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors">
            <BookOpen className="w-5 h-5 text-[#666666]" strokeWidth={2} />
            <span className="text-[14px] text-[#333333] font-medium">使用指南</span>
          </button>
        </div>
      </div>
    </>
  );
}
