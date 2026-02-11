import { useState } from 'react';
import { WelcomePage } from './components/WelcomePage';
import { NewDiscussionPage } from './components/NewDiscussionPage';
import { DiscussionPage } from './components/DiscussionPage';

export type Agent = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  selected: boolean;
};

export type AgentComment = {
  agentId: string;
  agentName: string;
  agentColor: string;
  content: string;
  expanded: boolean;
};

export type Discussion = {
  title: string;
  background: string;
  agents: Agent[];
  comments: AgentComment[];
  moderatorAnalysis: {
    round: number;
    consensusLevel: number;
    summary: string;
    newPoints: string[];
    consensus: ConsensusItem[];
    disagreements: DisagreementItem[];
  };
};

export type ConsensusItem = {
  content: string;
  agents: string[];
  percentage: number;
};

export type DisagreementItem = {
  topic: string;
  description: string;
  supportAgents: Array<{ name: string; color: string }>;
  opposeAgents: Array<{ name: string; color: string }>;
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<'welcome' | 'new' | 'discussion'>('welcome');
  const [discussion, setDiscussion] = useState<Discussion | null>(null);

  const handleStartNew = () => {
    setCurrentPage('new');
  };

  const handleCreateDiscussion = (newDiscussion: Discussion) => {
    setDiscussion(newDiscussion);
    setCurrentPage('discussion');
  };

  const handleBackToHome = () => {
    setCurrentPage('welcome');
    setDiscussion(null);
  };

  const handleBack = () => {
    if (currentPage === 'new') {
      setCurrentPage('welcome');
    } else if (currentPage === 'discussion') {
      setCurrentPage('welcome');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {/* Mobile viewport container */}
      <div className="w-full max-w-[375px] h-screen bg-[#0a0a0a] shadow-2xl overflow-hidden relative">
        {currentPage === 'welcome' && (
          <WelcomePage onStartNew={handleStartNew} />
        )}
        {currentPage === 'new' && (
          <NewDiscussionPage 
            onBack={handleBack}
            onCreateDiscussion={handleCreateDiscussion}
          />
        )}
        {currentPage === 'discussion' && discussion && (
          <DiscussionPage 
            discussion={discussion}
            onBack={handleBackToHome}
            onUpdateDiscussion={setDiscussion}
          />
        )}
      </div>
    </div>
  );
}
