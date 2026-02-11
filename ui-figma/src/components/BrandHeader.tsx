import leapcatIcon from 'figma:asset/a4626dde4b4a5b7b576e39119f3fa3c9bf52bf8e.png';

export function BrandHeader() {
  return (
    <div className="relative pt-[80px] pb-[60px]">
      {/* Centered Leapcat Icon with Floating Particles */}
      <div className="flex justify-center mb-[60px] relative">
        {/* Floating Particles Around Icon */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-8 left-[35%] w-1 h-1 bg-[#AAE874] rounded-full opacity-40" />
          <div className="absolute top-2 right-[30%] w-1.5 h-1.5 bg-[#AAE874] rounded-full opacity-30" />
          <div className="absolute bottom-4 left-[25%] w-1 h-1 bg-[#AAE874] rounded-full opacity-35" />
          <div className="absolute bottom-0 right-[38%] w-1 h-1 bg-[#AAE874] rounded-full opacity-45" />
        </div>

        {/* Leapcat Icon - 100px × 100px */}
        <img 
          src={leapcatIcon} 
          alt="Leapcat AI" 
          className="w-[100px] h-[100px] drop-shadow-2xl relative z-10"
        />
      </div>

      {/* Left-Aligned Text Content */}
      <div className="px-5 text-left space-y-2">
        <h1 className="text-[22px] text-black font-medium">Leapcat Multi Agent</h1>
        <p className="text-[14px] text-[#999999] leading-relaxed">
          Choose your AI adviser to help with your investment decisions.
        </p>
      </div>
    </div>
  );
}