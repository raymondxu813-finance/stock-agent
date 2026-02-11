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
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-[#F5F5F5]">
      {/* H5 容器：移动端全屏，桌面端以 390×844 居中展示 */}
      <div className="w-full max-w-[390px] h-[100dvh] max-h-[844px] bg-white overflow-hidden relative
        sm:rounded-[32px] sm:border sm:border-[#E8E8E8]
        max-sm:max-h-none max-sm:rounded-none max-sm:border-none">
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
