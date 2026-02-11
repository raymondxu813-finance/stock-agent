import { Menu, Edit3 } from 'lucide-react';

type WelcomePageProps = {
  onStartNew: () => void;
};

const AGENT_ICONS = [
  { color: 'bg-emerald-500', position: 'top-8 left-1/2 -translate-x-1/2', icon: '✨' },
  { color: 'bg-indigo-500', position: 'top-24 left-12', icon: '≋' },
  { color: 'bg-blue-500', position: 'bottom-24 left-12', icon: '◆' },
  { color: 'bg-orange-500', position: 'top-24 right-12', icon: '👂' },
  { color: 'bg-gray-800', position: 'bottom-24 right-12', icon: '⚡' },
  { color: 'bg-purple-500', position: 'top-36 left-1/2 -translate-x-1/2 opacity-50', icon: '💬' },
];

export function WelcomePage({ onStartNew }: WelcomePageProps) {
  return (
    <div className="h-full bg-[#f5f5f5] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <button className="p-2 -ml-2">
          <Menu className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-lg text-gray-900">MultiAgent</h1>
        <button onClick={onStartNew} className="p-2 -mr-2">
          <Edit3 className="w-6 h-6 text-gray-900" />
        </button>
      </div>

      {/* Agent Icons Circle */}
      <div className="relative h-80 mx-auto w-full max-w-xs mt-8">
        {AGENT_ICONS.map((agent, index) => (
          <div
            key={index}
            className={`absolute w-16 h-16 ${agent.color} rounded-full flex items-center justify-center text-2xl shadow-lg ${agent.position}`}
          >
            {agent.icon}
          </div>
        ))}
      </div>

      {/* Text Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <p className="text-sm text-gray-500 mb-4">同一个 AI，可能遇到幻觉</p>
        <h2 className="text-3xl text-gray-900 mb-2">问多个 AI，</h2>
        <h2 className="text-3xl text-gray-900 mb-4">得到真相</h2>
        <p className="text-base text-gray-600">重大决定的 AI 顾问团</p>
      </div>

      {/* Agent List */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 mb-3 px-2">参与讨论的 AI</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { name: 'GPT', company: 'OpenAI', color: 'bg-emerald-500', icon: '✨' },
            { name: 'Claude', company: 'Anthropic', color: 'bg-orange-500', icon: '👂' },
            { name: 'Grok', company: 'xAI', color: 'bg-gray-800', icon: '⚡' },
            { name: 'Gemini', company: 'Google', color: 'bg-blue-500', icon: '◆' },
          ].map((agent, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className={`w-14 h-14 ${agent.color} rounded-full flex items-center justify-center text-xl mb-1.5 shadow-md`}>
                {agent.icon}
              </div>
              <span className="text-xs text-gray-900">{agent.name}</span>
              <span className="text-[10px] text-gray-500">{agent.company}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Questions */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 mb-3 px-2">试试这些问题</p>
        <div className="bg-white rounded-2xl px-4 py-3 mb-3 shadow-sm">
          <p className="text-sm text-gray-900">OpenAI、Google、Anthropic、xAI 谁会胜出？</p>
        </div>
      </div>

      {/* Input Area */}
      <div className="px-4 pb-8">
        <div className="bg-white rounded-full px-5 py-3 shadow-lg flex items-center gap-3">
          <input
            type="text"
            placeholder="Ask a question for AIs to discuss..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
            onFocus={onStartNew}
          />
          <button className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
