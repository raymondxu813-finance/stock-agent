import { useState } from 'react';
import { AgentCard } from './AgentCard';
import { ActiveMatrix } from './ActiveMatrix';
import { ActionBar } from './ActionBar';
import { BrandHeader } from './BrandHeader';
import { AgentSlot } from './AgentSlot';
import { AgentSelectionSheet } from './AgentSelectionSheet';
import { RecommendedTopics } from './RecommendedTopics';
import { Shield, Network, Rocket, Zap, Waves } from 'lucide-react';

export interface Agent {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatar: 'sphere' | 'safe' | 'crystal' | 'rocket' | 'lightning' | 'rings';
  auraColor: string;
}

const agents: Agent[] = [
  {
    id: 'leapcat',
    name: 'Leapcat AI',
    title: 'Core Intelligence',
    bio: 'Your neutral gateway to global markets. Balanced and data-driven.',
    avatar: 'sphere',
    auraColor: 'from-[#AAE874]/20 to-[#7BC74D]/10',
  },
  {
    id: 'buffett',
    name: 'AI Buffett',
    title: 'Value Maestro',
    bio: 'Focuses on the "Margin of Safety" and long-term cash flow analysis.',
    avatar: 'safe',
    auraColor: 'from-amber-400/20 to-yellow-600/10',
  },
  {
    id: 'munger',
    name: 'AI Munger',
    title: 'Logic Architect',
    bio: 'Master of mental models. Expert at multidisciplinary thinking.',
    avatar: 'crystal',
    auraColor: 'from-cyan-400/20 to-blue-500/10',
  },
  {
    id: 'cathie',
    name: 'AI Cathie',
    title: 'Innovation Lead',
    bio: 'Focus on disruptive technologies, AI, and the next industrial revolution.',
    avatar: 'rocket',
    auraColor: 'from-purple-400/20 to-pink-500/10',
  },
  {
    id: 'musk',
    name: 'AI Musk',
    title: 'First Principles',
    bio: 'Analyzes assets through physics, scalability, and long-term utility.',
    avatar: 'lightning',
    auraColor: 'from-blue-400/20 to-indigo-600/10',
  },
  {
    id: 'dalio',
    name: 'AI Dalio',
    title: 'Macro Strategist',
    bio: 'Specializes in the Big Cycle and building "All Weather" portfolios.',
    avatar: 'rings',
    auraColor: 'from-emerald-400/20 to-teal-600/10',
  },
];

const MAX_SLOTS = 6;

export function AgentLobby() {
  // Pre-select first 3 agents: Leapcat AI, AI Buffett, AI Munger
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([
    agents[0], // Leapcat AI
    agents[1], // AI Buffett
    agents[2], // AI Munger
  ]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const toggleAgent = (agent: Agent) => {
    if (selectedAgents.find(a => a.id === agent.id)) {
      setSelectedAgents(selectedAgents.filter(a => a.id !== agent.id));
    } else if (selectedAgents.length < MAX_SLOTS) {
      setSelectedAgents([...selectedAgents, agent]);
    }
  };

  const removeAgent = (agentId: string) => {
    setSelectedAgents(selectedAgents.filter(a => a.id !== agentId));
  };

  // Create array of 6 slots
  const slots = Array.from({ length: MAX_SLOTS }, (_, index) => selectedAgents[index] || null);

  return (
    <div className="relative min-h-screen pb-32 bg-white">
      {/* Ambient Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-24 left-10 w-1 h-1 bg-[#AAE874] rounded-full opacity-40 animate-pulse" />
        <div className="absolute top-32 right-16 w-1.5 h-1.5 bg-[#AAE874] rounded-full opacity-30 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-48 left-20 w-1 h-1 bg-[#AAE874] rounded-full opacity-35 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-56 right-24 w-1 h-1 bg-[#AAE874] rounded-full opacity-45 animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Brand Header */}
      <BrandHeader />

      {/* Main Content */}
      <div className="relative px-5 pb-8">
        {/* 2x3 Slot Grid */}
        <div className="flex flex-col items-center gap-8 mb-6">
          {/* Row 1 */}
          <div className="flex justify-center gap-8">
            {slots.slice(0, 3).map((agent, index) => (
              <AgentSlot
                key={index}
                agent={agent || undefined}
                onClick={() => setIsSheetOpen(true)}
                onDelete={agent ? () => removeAgent(agent.id) : undefined}
              />
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex justify-center gap-8">
            {slots.slice(3, 6).map((agent, index) => (
              <AgentSlot
                key={index + 3}
                agent={agent || undefined}
                onClick={() => setIsSheetOpen(true)}
                onDelete={agent ? () => removeAgent(agent.id) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Selection Count */}
        <div className="text-center mb-8">
          <p className="text-[14px] text-[#666666]">
            Selected <span className="font-bold text-[#AAE874]">{selectedAgents.length}/{MAX_SLOTS}</span>
          </p>
        </div>
      </div>

      {/* Recommended Topics Carousel */}
      <RecommendedTopics />

      {/* Agent Selection Bottom Sheet */}
      <AgentSelectionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        agents={agents}
        selectedAgents={selectedAgents}
        onToggle={toggleAgent}
        onDelete={removeAgent}
        maxSlots={MAX_SLOTS}
      />

      {/* Sticky Action Bar */}
      <ActionBar
        selectedCount={selectedAgents.length}
        disabled={selectedAgents.length === 0}
      />
    </div>
  );
}