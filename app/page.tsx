'use client';

import { useState } from 'react';
import { WelcomePage } from '@/components/WelcomePage';
import { DiscussionPage } from '@/components/DiscussionPage';
import type { Discussion } from '@/types';

export default function Home() {
  const [currentPage, setCurrentPage] = useState<'welcome' | 'discussion'>('welcome');
  const [discussion, setDiscussion] = useState<Discussion | null>(null);

  const handleCreateDiscussion = (newDiscussion: Discussion) => {
    setDiscussion(newDiscussion);
    setCurrentPage('discussion');
  };

  const handleBackToHome = () => {
    setCurrentPage('welcome');
    setDiscussion(null);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {/* Mobile viewport container */}
      <div className="w-full max-w-[375px] h-screen bg-[#0a0a0a] shadow-2xl overflow-hidden relative">
        {currentPage === 'welcome' && (
          <WelcomePage onCreateDiscussion={handleCreateDiscussion} />
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
