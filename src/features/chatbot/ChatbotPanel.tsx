import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { sendChatMessage, createUserMessage, createAssistantMessage, type ChatMessage } from '../../services/chat';

const QUICK_ACTIONS = [
  'How do I create a new application?',
  'What documents are required for LMIA?',
  'How to add an employer?'
];

export const ChatbotPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm your AI assistant for immigration case management. I can help you with creating applications, understanding document requirements, managing cohorts, and more. What would you like help with?",
      createdAt: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setError(null);
    const userMessage = createUserMessage(messageText);
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, text: m.text }));

      conversationHistory.push({ role: 'user', text: messageText });

      const response = await sendChatMessage(conversationHistory);
      const assistantMessage = createAssistantMessage(response.reply);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const retryLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      // Remove the last user message and retry
      setMessages(prev => prev.filter(m => m.id !== lastUserMessage.id));
      setError(null);
      sendMessage(lastUserMessage.text);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">AI Assistant</h2>
          <p className="text-xs text-gray-500">Powered by Gemini</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'assistant'
                ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                : 'bg-gray-800'
              }`}>
              {message.role === 'assistant' ? (
                <Bot size={16} className="text-white" />
              ) : (
                <User size={16} className="text-white" />
              )}
            </div>
            <div className={`max-w-[75%] ${message.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed ${message.role === 'assistant'
                  ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-md shadow-sm'
                  : 'bg-gray-800 text-white rounded-tr-md'
                }`}>
                {message.text}
              </div>
              <div className={`text-[10px] text-gray-400 mt-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                {formatTime(message.createdAt)}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={16} />
            <span className="flex-1">{error}</span>
            <button
              onClick={retryLastMessage}
              className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium transition-colors"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => sendMessage(action)}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about immigration cases..."
              className="w-full px-4 py-3 pr-12 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!canSend}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${canSend
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          AI responses are for guidance only. Always verify with official sources.
        </p>
      </div>
    </div>
  );
};

export default ChatbotPanel;