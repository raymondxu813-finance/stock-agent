import { FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';

export function AnalysisReportEntry() {
  const navigate = useNavigate();

  const handleClick = () => {
    // Navigate to analysis page (to be implemented)
    console.log('Navigate to Analysis Report');
    // navigate('/analysis');
  };

  return (
    <div className="sticky top-[60px] z-30 px-5 py-3 bg-white">
      <button
        onClick={handleClick}
        className="w-full bg-white rounded-[18px] p-5 border border-[#AAE874]/30 shadow-[0_4px_20px_rgba(170,232,116,0.15),0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(170,232,116,0.25),0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.98] transition-all duration-200 flex items-center justify-between group"
      >
        {/* Left: Icon + Label */}
        <div className="flex items-center gap-4">
          {/* Premium Icon Container with Gradient */}
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#AAE874] to-[#8FD055] flex items-center justify-center shadow-[0_4px_12px_rgba(170,232,116,0.3)]">
            <FileText className="w-6 h-6 text-white" strokeWidth={2.5} />
            {/* Subtle inner glow */}
            <div className="absolute inset-0 rounded-2xl bg-white/10"></div>
          </div>
          
          {/* Text Content */}
          <div className="flex flex-col items-start">
            <span className="text-[16px] font-bold text-black tracking-tight">
              分析报告
            </span>
            <span className="text-[12px] text-[#666666] font-medium mt-0.5">
              AI Council Summary Report
            </span>
          </div>
        </div>

        {/* Right: Chevron with subtle animation */}
        <div className="flex items-center">
          <ChevronRight className="w-5 h-5 text-[#BBBBBB] group-hover:text-[#AAE874] group-hover:translate-x-0.5 transition-all duration-200" strokeWidth={2.5} />
        </div>
      </button>
    </div>
  );
}