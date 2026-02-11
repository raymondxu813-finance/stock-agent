'use client';

import type { AvatarType } from '@/types';

interface AgentAvatarProps {
  type: AvatarType;
  size?: number;
}

export function AgentAvatar({ type, size = 80 }: AgentAvatarProps) {
  switch (type) {
    case 'sphere':
      return <GreenSphere size={size} />;
    case 'safe':
      return <GoldenSafe size={size} />;
    case 'crystal':
      return <CrystalComplex size={size} />;
    case 'rocket':
      return <NeonRocket size={size} />;
    case 'lightning':
      return <LightningOrb size={size} />;
    case 'rings':
      return <ConcentricRings size={size} />;
    default:
      return <GreenSphere size={size} />;
  }
}

function GreenSphere({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#AAE874] to-[#7BC74D] opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#AAE874] to-[#7BC74D] shadow-xl">
        <div className="absolute top-[20%] left-[25%] w-[30%] h-[30%] rounded-full bg-white opacity-50 blur-md" />
        <div className="absolute top-[30%] right-[30%] w-[12%] h-[12%] bg-white opacity-80 blur-[1px] rounded-full" />
      </div>
    </div>
  );
}

function GoldenSafe({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-600 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-xl flex items-center justify-center">
        {/* Safe Door */}
        <div className="w-[70%] h-[70%] rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 border-4 border-amber-600/40 flex items-center justify-center">
          {/* Lock Circle */}
          <div className="w-[40%] h-[40%] rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 border-2 border-amber-700/30 shadow-inner">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-500/50 to-transparent" />
          </div>
        </div>
        {/* Metallic Highlights */}
        <div className="absolute top-[15%] left-[20%] w-[25%] h-[15%] bg-white/40 blur-sm rounded-full" />
      </div>
    </div>
  );
}

function CrystalComplex({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 opacity-20 blur-lg" />
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Geometric Crystal Structure */}
        <div className="relative w-[85%] h-[85%]">
          {/* Center Diamond */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[50%] h-[50%] bg-gradient-to-br from-cyan-400 to-blue-600 transform rotate-45 shadow-xl" />
          </div>
          {/* Outer Crystals */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[30%] h-[30%] bg-gradient-to-br from-cyan-300 to-blue-400 transform rotate-45 shadow-lg opacity-80" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[30%] h-[30%] bg-gradient-to-br from-cyan-300 to-blue-400 transform rotate-45 shadow-lg opacity-80" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-gradient-to-br from-cyan-300 to-blue-400 transform rotate-45 shadow-lg opacity-80" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-gradient-to-br from-cyan-300 to-blue-400 transform rotate-45 shadow-lg opacity-80" />
          {/* Light Reflection */}
          <div className="absolute top-[20%] right-[20%] w-[20%] h-[20%] bg-white/60 blur-md rounded-full" />
        </div>
      </div>
    </div>
  );
}

function NeonRocket({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 opacity-20 blur-lg" />
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Rocket Body */}
        <div className="relative w-[45%] h-[75%]">
          {/* Main Body */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#AAE874] to-[#7BC74D] rounded-t-full shadow-xl" />
          {/* Nose Cone */}
          <div className="absolute -top-[20%] left-0 right-0 h-[30%] bg-gradient-to-b from-purple-400 to-[#AAE874] rounded-t-full" />
          {/* Window */}
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[40%] h-[20%] rounded-full bg-cyan-300/80 shadow-inner" />
          {/* Energy Trail */}
          <div className="absolute -bottom-[30%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] bg-gradient-to-b from-pink-400/60 to-transparent blur-md rounded-b-full" />
          {/* Fins */}
          <div className="absolute bottom-0 -left-[25%] w-[35%] h-[30%] bg-gradient-to-br from-purple-500 to-pink-600 transform skew-y-12 opacity-80" />
          <div className="absolute bottom-0 -right-[25%] w-[35%] h-[30%] bg-gradient-to-bl from-purple-500 to-pink-600 transform -skew-y-12 opacity-80" />
        </div>
      </div>
    </div>
  );
}

function LightningOrb({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-100/40 to-indigo-200/30 border-4 border-blue-300/50 shadow-xl flex items-center justify-center backdrop-blur-sm">
        {/* Lightning Bolt */}
        <svg viewBox="0 0 24 24" className="w-[55%] h-[55%] text-[#AAE874] drop-shadow-[0_0_8px_rgba(170,232,116,0.8)]">
          <path
            fill="currentColor"
            d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
          />
        </svg>
        {/* Inner Glow */}
        <div className="absolute inset-[20%] rounded-full bg-[#AAE874]/20 blur-md" />
        {/* Glass Highlight */}
        <div className="absolute top-[15%] right-[25%] w-[30%] h-[30%] rounded-full bg-white/40 blur-sm" />
      </div>
    </div>
  );
}

function ConcentricRings({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 opacity-20 blur-lg" />
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Outer Ring */}
        <div className="absolute w-[90%] h-[90%] rounded-full border-[6px] border-emerald-400/60 shadow-lg" />
        {/* Middle Ring */}
        <div className="absolute w-[65%] h-[65%] rounded-full border-[5px] border-[#AAE874]/70 shadow-md" />
        {/* Inner Ring */}
        <div className="absolute w-[40%] h-[40%] rounded-full border-[4px] border-teal-500/80 shadow-sm" />
        {/* Center Core */}
        <div className="absolute w-[20%] h-[20%] rounded-full bg-gradient-to-br from-[#AAE874] to-teal-600 shadow-xl">
          <div className="absolute inset-[20%] rounded-full bg-white/50 blur-sm" />
        </div>
        {/* Orbital Indicators */}
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-md" />
        <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-teal-500 shadow-md" />
      </div>
    </div>
  );
}
