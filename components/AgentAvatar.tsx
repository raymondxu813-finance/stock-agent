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
    case 'compass':
      return <PolicyCompass size={size} />;
    case 'piggybank':
      return <PiggyBank size={size} />;
    case 'globe':
      return <GlobeOrb size={size} />;
    case 'shield':
      return <InstitutionalShield size={size} />;
    case 'megaphone':
      return <MegaphoneOrb size={size} />;
    case 'radar':
      return <RadarDisc size={size} />;
    case 'microscope':
      return <MicroscopeOrb size={size} />;
    case 'hourglass':
      return <HourglassOrb size={size} />;
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

// ═══════════════════════════════════════════════════
// 新增 8 个头像组件
// ═══════════════════════════════════════════════════

function PolicyCompass({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400 to-rose-600 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-rose-50 to-red-100 border-[3px] border-red-400/50 shadow-xl flex items-center justify-center">
        {/* Compass Needle */}
        <div className="absolute w-[60%] h-[8%] bg-gradient-to-r from-red-500 to-red-300 rounded-full transform -rotate-45" />
        <div className="absolute w-[60%] h-[8%] bg-gradient-to-r from-gray-300 to-gray-400 rounded-full transform rotate-[135deg]" />
        {/* Center Pin */}
        <div className="absolute w-[18%] h-[18%] rounded-full bg-gradient-to-br from-red-500 to-rose-700 shadow-lg">
          <div className="absolute inset-[25%] rounded-full bg-white/60 blur-[1px]" />
        </div>
        {/* Cardinal Marks */}
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[8%] h-[8%] rounded-full bg-red-500/80" />
        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[6%] h-[6%] rounded-full bg-gray-400/60" />
        {/* Highlight */}
        <div className="absolute top-[15%] right-[20%] w-[20%] h-[20%] bg-white/50 blur-md rounded-full" />
      </div>
    </div>
  );
}

function PiggyBank({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-pink-300 via-pink-400 to-rose-500 shadow-xl flex items-center justify-center">
        {/* Body highlight */}
        <div className="absolute top-[15%] left-[20%] w-[35%] h-[30%] rounded-full bg-white/40 blur-md" />
        {/* Coin slot */}
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[30%] h-[8%] bg-rose-600/50 rounded-full" />
        {/* Snout */}
        <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-[35%] h-[22%] bg-gradient-to-b from-pink-300 to-rose-400 rounded-full border-2 border-rose-500/30">
          <div className="absolute top-[30%] left-[25%] w-[15%] h-[30%] rounded-full bg-rose-500/50" />
          <div className="absolute top-[30%] right-[25%] w-[15%] h-[30%] rounded-full bg-rose-500/50" />
        </div>
        {/* Eyes */}
        <div className="absolute top-[35%] left-[28%] w-[10%] h-[10%] rounded-full bg-rose-800" />
        <div className="absolute top-[35%] right-[28%] w-[10%] h-[10%] rounded-full bg-rose-800" />
        {/* Ears */}
        <div className="absolute top-[10%] left-[18%] w-[18%] h-[18%] bg-gradient-to-br from-pink-400 to-rose-500 rounded-full transform -rotate-12" />
        <div className="absolute top-[10%] right-[18%] w-[18%] h-[18%] bg-gradient-to-br from-pink-400 to-rose-500 rounded-full transform rotate-12" />
      </div>
    </div>
  );
}

function GlobeOrb({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-sky-400 to-blue-600 shadow-xl overflow-hidden">
        {/* Continents */}
        <div className="absolute top-[15%] left-[20%] w-[30%] h-[25%] bg-[#AAE874]/70 rounded-[40%]" />
        <div className="absolute top-[35%] right-[15%] w-[25%] h-[30%] bg-[#AAE874]/60 rounded-[40%]" />
        <div className="absolute bottom-[15%] left-[30%] w-[20%] h-[15%] bg-[#AAE874]/50 rounded-[40%]" />
        {/* Grid lines */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/20" />
        <div className="absolute top-[30%] left-0 right-0 h-[1px] bg-white/15" />
        <div className="absolute bottom-[30%] left-0 right-0 h-[1px] bg-white/15" />
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white/20" />
        {/* Atmosphere glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent" />
        {/* Highlight */}
        <div className="absolute top-[12%] right-[22%] w-[22%] h-[22%] bg-white/50 blur-md rounded-full" />
      </div>
    </div>
  );
}

function InstitutionalShield({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-400 to-slate-700 opacity-20 blur-lg rounded-2xl" />
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Shield shape */}
        <div className="relative w-[80%] h-[85%]">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 shadow-xl" style={{ borderRadius: '10% 10% 50% 50%' }}>
            {/* Inner shield */}
            <div className="absolute inset-[12%] bg-gradient-to-b from-slate-400 to-slate-600 border-2 border-slate-300/30" style={{ borderRadius: '8% 8% 50% 50%' }}>
              {/* Emblem */}
              <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[40%] h-[40%] bg-gradient-to-br from-[#AAE874] to-[#7BC74D] rounded-full shadow-inner">
                <div className="absolute inset-[25%] rounded-full bg-white/40 blur-[1px]" />
              </div>
            </div>
          </div>
          {/* Metallic highlight */}
          <div className="absolute top-[8%] left-[15%] w-[30%] h-[20%] bg-white/30 blur-sm rounded-full" />
        </div>
      </div>
    </div>
  );
}

function MegaphoneOrb({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-orange-100/60 to-amber-200/40 border-4 border-orange-300/50 shadow-xl flex items-center justify-center backdrop-blur-sm">
        {/* Megaphone icon */}
        <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]">
          <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
        {/* Sound waves */}
        <div className="absolute right-[10%] top-1/2 -translate-y-1/2 w-[15%] h-[40%] border-r-2 border-orange-400/40 rounded-r-full" />
        {/* Highlight */}
        <div className="absolute top-[15%] left-[20%] w-[25%] h-[25%] bg-white/40 blur-sm rounded-full" />
      </div>
    </div>
  );
}

function RadarDisc({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 to-green-800 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-gray-900 to-gray-800 shadow-xl border-2 border-emerald-500/30 overflow-hidden">
        {/* Radar grid */}
        <div className="absolute inset-[15%] rounded-full border border-emerald-500/30" />
        <div className="absolute inset-[35%] rounded-full border border-emerald-500/25" />
        {/* Cross lines */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-emerald-500/20" />
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-emerald-500/20" />
        {/* Sweep */}
        <div className="absolute top-1/2 left-1/2 w-[45%] h-[2px] bg-gradient-to-r from-emerald-400 to-transparent origin-left transform -rotate-45" />
        {/* Glow area behind sweep */}
        <div className="absolute top-[15%] right-[15%] w-[30%] h-[30%] bg-emerald-400/15 blur-md rounded-full" />
        {/* Blips */}
        <div className="absolute top-[25%] right-[30%] w-[6%] h-[6%] rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        <div className="absolute bottom-[30%] left-[25%] w-[4%] h-[4%] rounded-full bg-emerald-400/60 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[8%] h-[8%] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
      </div>
    </div>
  );
}

function MicroscopeOrb({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-violet-100/50 to-purple-200/40 border-4 border-violet-300/50 shadow-xl flex items-center justify-center backdrop-blur-sm">
        {/* Microscope icon */}
        <svg viewBox="0 0 24 24" className="w-[48%] h-[48%] text-violet-600 drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]">
          <path fill="currentColor" d="M13 11.33L18 18H6l5-6.67V6h2v5.33zM15.96 4H8.04C7.62 4 7.2 4.16 6.88 4.44L8 6h8l1.12-1.56C16.8 4.16 16.38 4 15.96 4zM12 19c-3.87 0-7-3.13-7-7h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2c0 3.87-3.13 7-7 7zm-5 1h10v2H7v-2z" />
        </svg>
        {/* Data points */}
        <div className="absolute top-[18%] right-[18%] w-[8%] h-[8%] rounded-full bg-violet-400/60" />
        <div className="absolute bottom-[22%] left-[22%] w-[6%] h-[6%] rounded-full bg-purple-400/50" />
        {/* Highlight */}
        <div className="absolute top-[12%] left-[18%] w-[25%] h-[25%] bg-white/40 blur-sm rounded-full" />
      </div>
    </div>
  );
}

function HourglassOrb({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 opacity-20 blur-lg" />
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-amber-50/60 to-orange-100/40 border-4 border-amber-400/50 shadow-xl flex items-center justify-center backdrop-blur-sm">
        {/* Hourglass shape */}
        <div className="relative w-[45%] h-[65%] flex flex-col items-center">
          {/* Top bulb */}
          <div className="w-full h-[40%] bg-gradient-to-b from-amber-400 to-amber-500 rounded-t-lg border-2 border-amber-600/30 overflow-hidden">
            <div className="absolute top-[15%] left-[20%] w-[30%] h-[15%] bg-white/30 blur-[1px] rounded-full" />
          </div>
          {/* Neck */}
          <div className="w-[25%] h-[20%] bg-gradient-to-b from-amber-500 to-amber-400 border-x-2 border-amber-600/20" />
          {/* Bottom bulb */}
          <div className="w-full h-[40%] bg-gradient-to-b from-amber-500 to-amber-600 rounded-b-lg border-2 border-amber-600/30 overflow-hidden">
            {/* Sand */}
            <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-t from-orange-400/80 to-amber-300/40 rounded-b-md" />
          </div>
        </div>
        {/* Frame top */}
        <div className="absolute top-[14%] left-[22%] right-[22%] h-[4%] bg-gradient-to-r from-amber-600 to-amber-700 rounded-full" />
        {/* Frame bottom */}
        <div className="absolute bottom-[14%] left-[22%] right-[22%] h-[4%] bg-gradient-to-r from-amber-600 to-amber-700 rounded-full" />
      </div>
    </div>
  );
}
