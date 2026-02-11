import { useState } from 'react';
import { Menu, Edit3, ChevronDown, ChevronUp, ArrowUp, X } from 'lucide-react';
import type { Discussion, AgentComment } from '../App';

type DiscussionPageProps = {
  discussion: Discussion;
  onBack: () => void;
  onUpdateDiscussion: (discussion: Discussion) => void;
};

export function DiscussionPage({ discussion, onBack, onUpdateDiscussion }: DiscussionPageProps) {
  const [showSummary, setShowSummary] = useState(false);
  const [collapsedSummary, setCollapsedSummary] = useState(false);

  const toggleExpanded = (agentId: string) => {
    const updatedComments = discussion.comments.map(comment =>
      comment.agentId === agentId
        ? { ...comment, expanded: !comment.expanded }
        : comment
    );
    onUpdateDiscussion({
      ...discussion,
      comments: updatedComments,
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const getPreviewText = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.slice(0, 3).join('\n') + (lines.length > 3 ? '...' : '');
  };

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5] relative">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center border-b border-gray-200 relative z-10">
        <button onClick={onBack} className="p-2 -ml-2">
          <Menu className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Discussion complete</span>
        </div>
        <button className="p-2 -mr-2">
          <Edit3 className="w-5 h-5 text-gray-900" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 space-y-3">
          {/* Session Header */}
          <div className="bg-indigo-500 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-white text-sm mb-0.5">{discussion.title}</h3>
              <div className="flex items-center gap-1 text-xs text-indigo-200">
                <span>讨论中</span>
                <span>•</span>
                <span>v{discussion.moderatorAnalysis.round}</span>
              </div>
            </div>
            <ChevronDown className="w-5 h-5 text-white" />
          </div>

          {/* Topic Card */}
          <div className="bg-white rounded-2xl p-4">
            <div className="text-center mb-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">TOPIC</span>
            </div>
            <h2 className="text-lg text-gray-900 text-center">{discussion.title}</h2>
          </div>

          {/* Agent Comments */}
          {discussion.comments.map((comment, index) => (
            <div key={comment.agentId} className="bg-white rounded-2xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${comment.agentColor} rounded-full flex items-center justify-center text-white`}>
                    {comment.agentName[0]}
                  </div>
                  <span className="text-base text-gray-900">{comment.agentName}</span>
                </div>
                
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {comment.expanded ? comment.content : getPreviewText(comment.content)}
                </div>
              </div>
              
              {comment.content.split('\n').filter(l => l.trim()).length > 3 && (
                <button
                  onClick={() => toggleExpanded(comment.agentId)}
                  className="w-full px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1 text-sm text-blue-600"
                >
                  {comment.expanded ? (
                    <>
                      <span>收起</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>展开全部</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          ))}

          {/* Moderator Analysis */}
          <div className={`bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border-2 border-yellow-400 overflow-hidden ${collapsedSummary ? '' : ''}`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-900">主持人分析</h3>
                    <p className="text-xs text-gray-500">第 {discussion.moderatorAnalysis.round} 轮</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSummary(true)}
                  className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg"
                >
                  有进展
                </button>
                <button
                  onClick={() => setCollapsedSummary(!collapsedSummary)}
                  className="ml-2"
                >
                  {collapsedSummary ? (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>

              {!collapsedSummary && (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-600">共识度</span>
                      <span className="text-xl text-orange-600">{discussion.moderatorAnalysis.consensusLevel}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                        style={{ width: `${discussion.moderatorAnalysis.consensusLevel}%` }}
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
                      <span className="text-gray-400 mt-0.5">≡</span>
                      <p>{discussion.moderatorAnalysis.summary}</p>
                    </div>
                  </div>

                  {/* New Points */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-yellow-600">●</span>
                      <h4 className="text-sm text-gray-900">本轮新观点</h4>
                    </div>
                    <div className="space-y-1.5">
                      {discussion.moderatorAnalysis.newPoints.map((point, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="text-orange-400 mt-0.5">+</span>
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consensus */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-600">✓</span>
                      <h4 className="text-sm text-gray-900">已达成共识</h4>
                    </div>
                    <div className="space-y-2">
                      {discussion.moderatorAnalysis.consensus.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">•</span>
                          <span className="flex-1 text-xs text-gray-700">{item.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Disagreements Preview */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-orange-600">⚡</span>
                      <h4 className="text-sm text-gray-900">仍在讨论</h4>
                    </div>
                    <div className="space-y-2">
                      {discussion.moderatorAnalysis.disagreements.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => setShowSummary(true)}
                          className="w-full bg-white rounded-lg p-3 text-left"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm text-gray-900 flex-1">{item.topic}</h5>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{item.description}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {item.supportAgents.slice(0, 2).map((agent, i) => (
                                <div
                                  key={i}
                                  className={`w-6 h-6 ${agent.color} rounded-full border-2 border-white`}
                                />
                              ))}
                            </div>
                            {item.supportAgents.length > 2 && (
                              <span className="text-xs text-gray-500">+{item.supportAgents.length - 2}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 flex items-center gap-3">
        <button className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-full text-sm">
          Continue discussion...
        </button>
        <button
          onClick={() => setShowSummary(true)}
          className="px-4 py-3 bg-indigo-500 text-white rounded-full flex items-center justify-center gap-2 text-sm shadow-lg"
        >
          <span>回到底部</span>
        </button>
        <button
          onClick={scrollToBottom}
          className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center"
        >
          <ArrowUp className="w-5 h-5 text-indigo-600" />
        </button>
      </div>

      {/* Summary Modal */}
      {showSummary && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 pt-3 pb-2 flex items-center justify-center border-b border-gray-200">
              <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
              <button
                onClick={() => setShowSummary(false)}
                className="absolute right-4 top-3 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-xl text-gray-900 mb-1">Master Document</h2>
                
                {/* Tabs */}
                <div className="flex gap-6 mb-6 border-b border-gray-200">
                  <button className="pb-3 text-sm text-indigo-600 border-b-2 border-indigo-600">
                    总结
                  </button>
                  <button className="pb-3 text-sm text-gray-500">
                    模型
                  </button>
                  <button className="pb-3 text-sm text-gray-500">
                    历史
                  </button>
                </div>

                {/* Version Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 rounded-full mb-4">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white text-sm">讨论中</span>
                  <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded">v3</span>
                </div>

                {/* Title */}
                <h3 className="text-2xl text-gray-900 mb-4">{discussion.title}</h3>

                {/* Summary Paragraph */}
                <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">
                    {discussion.moderatorAnalysis.summary}
                  </p>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-indigo-500 text-sm">💬</span>
                      <h4 className="text-sm text-gray-900 flex-1">综论</h4>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      在 2024 年，比特币有望呈现上涨趋势，受到减半事件、机构投资增加和宏观经济环境的共同影响。然而，投资者需警惕市场波动、监管风险和宏观经济政策的不确定性。新技术发展可能进一步影响市场动态。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex -space-x-2">
                      {discussion.agents.map((agent, i) => (
                        <div
                          key={i}
                          className={`w-6 h-6 ${agent.color} rounded-full border-2 border-white flex items-center justify-center text-xs text-white`}
                        >
                          {agent.icon}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">参与者</span>
                    <div className="flex-1"></div>
                    <span className="text-green-600 text-sm">✓</span>
                    <span className="text-xs text-gray-500">1</span>
                    <span className="text-red-600 text-sm">⤺</span>
                    <span className="text-xs text-gray-500">2</span>
                  </div>
                </div>

                {/* Consensus */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-green-600">✓</span>
                    <h4 className="text-base text-gray-900">关键共识</h4>
                  </div>
                  {discussion.moderatorAnalysis.consensus.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 mb-3 p-3 bg-green-50 rounded-xl">
                      <span className="text-green-600 text-lg mt-0.5">{index + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 mb-2">{item.content}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {discussion.agents.slice(0, 3).map((agent, i) => (
                              <div
                                key={i}
                                className={`w-5 h-5 ${agent.color} rounded-full border-2 border-white`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-600">{item.agents.join(' · ')}</span>
                          <div className="flex-1"></div>
                          <span className="text-sm text-green-600">{item.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Disagreements */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600">⤺</span>
                      <h4 className="text-base text-gray-900">分歧焦点</h4>
                    </div>
                    <span className="text-xs text-gray-500">部分无法决议</span>
                  </div>
                  {discussion.moderatorAnalysis.disagreements.map((item, index) => (
                    <div key={index} className="mb-3 p-4 bg-gray-50 rounded-xl">
                      <h5 className="text-sm text-gray-900 mb-2">{item.topic}</h5>
                      <p className="text-xs text-gray-600 mb-3">{item.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {item.supportAgents.slice(0, 2).map((agent, i) => (
                          <div key={i} className="p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-4 h-4 ${agent.color} rounded-full`} />
                              <span className="text-xs text-gray-600 truncate">{agent.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowSummary(false)}
                className="w-full py-3 bg-indigo-500 text-white rounded-full text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
