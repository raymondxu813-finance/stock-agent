import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  userQuestion: string;
  setUserQuestion: (question: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [userQuestion, setUserQuestion] = useState('');

  return (
    <ChatContext.Provider value={{ userQuestion, setUserQuestion }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
}
