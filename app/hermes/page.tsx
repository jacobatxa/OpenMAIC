'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

// System-defined shortcuts
const SHORTCUTS = [
  { label: '📋 任务列表', msg: '查看所有定时任务的状态' },
  { label: '📈 股票查询', msg: '查询美股持仓最新行情' },
  { label: '📰 新闻摘要', msg: '查看最新AI新闻摘要' },
  { label: '⏸️ 暂停新闻', msg: '暂停 AI News Digest 定时任务' },
  { label: '▶️ 恢复任务', msg: '恢复 Feed Page Rebuilder 定时任务' },
  { label: '📊 周报', msg: '生成本周工作总结报告' },
];

export default function HermesPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是 **Hermes Agent**，你的 AI 后台助手。我可以帮你管理定时任务、查询股票行情、获取最新资讯。有什么需要帮忙的？直接输入，或者点下面的快捷按钮 👇',
      id: 'welcome',
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const toggleTheme = () => setIsDark(!isDark);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      role: 'user',
      content: text.trim(),
      id: Date.now().toString(),
    };

    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      id: (Date.now() + 1).toString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const msgs = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/hermes-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: `❌ 错误: ${err.error}` } : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            if (data.startsWith(':')) continue; // heartbeat
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: fullContent } : m
                  )
                );
              }
              if (parsed.error) {
                fullContent += `\n\n❌ ${parsed.error}`;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: fullContent } : m
                  )
                );
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: `❌ 连接错误: ${err.message}` } : m
        )
      );
    }

    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const renderContent = (content: string) => {
    // Convert markdown-style bold
    let html = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
    return html;
  };

  return (
    <div
      style={{
        height: '100dvh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: isDark
          ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)'
          : 'linear-gradient(135deg, #f0f0f5 0%, #e8e8f0 50%, #f0f0f5 100%)',
        color: isDark ? '#e0e0e8' : '#1a1a2e',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: isDark ? '1px solid #2a2a3e' : '1px solid #d0d0da',
          background: isDark ? 'rgba(15,15,26,0.9)' : 'rgba(240,240,245,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              color: '#fff',
            }}
          >
            H
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Hermes Agent</div>
            <div style={{ fontSize: 11, color: isDark ? '#8a8a9e' : '#888', marginTop: -1 }}>
              豆包后台 · 在线
            </div>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: isDark ? '1px solid #2a2a3e' : '1px solid #d0d0da',
            background: isDark ? '#1a1a2e' : '#fff',
            color: isDark ? '#e0e0e8' : '#1a1a2e',
            cursor: 'pointer',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : isDark ? '#1e1e32' : '#ffffff',
                color: msg.role === 'user' ? '#fff' : isDark ? '#e0e0e8' : '#1a1a2e',
                fontSize: 14,
                lineHeight: 1.6,
                boxShadow: isDark
                  ? '0 2px 8px rgba(0,0,0,0.3)'
                  : '0 2px 8px rgba(0,0,0,0.06)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
            />
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '16px 16px 16px 4px',
                background: isDark ? '#1e1e32' : '#ffffff',
                display: 'flex',
                gap: 4,
              }}
            >
              <span style={{ animation: 'bounce 1s infinite', animationDelay: '0ms' }}>●</span>
              <span style={{ animation: 'bounce 1s infinite', animationDelay: '200ms' }}>●</span>
              <span style={{ animation: 'bounce 1s infinite', animationDelay: '400ms' }}>●</span>
            </div>
          </div>
        )}

        {/* Shortcuts */}
        {messages.length <= 2 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 4,
              justifyContent: 'center',
            }}
          >
            {SHORTCUTS.map((sc) => (
              <button
                key={sc.label}
                onClick={() => sendMessage(sc.msg)}
                disabled={isStreaming}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: isDark ? '1px solid #2a2a3e' : '1px solid #d0d0da',
                  background: isDark ? 'rgba(30,30,50,0.6)' : 'rgba(255,255,255,0.8)',
                  color: isDark ? '#b0b0c8' : '#555',
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  opacity: isStreaming ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isStreaming) {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.color = isDark ? '#e0e0e8' : '#1a1a2e';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isDark ? '#2a2a3e' : '#d0d0da';
                  e.currentTarget.style.color = isDark ? '#b0b0c8' : '#555';
                }}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '8px 12px 16px',
          borderTop: isDark ? '1px solid #2a2a3e' : '1px solid #d0d0da',
          background: isDark ? 'rgba(15,15,26,0.9)' : 'rgba(240,240,245,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            maxWidth: 800,
            margin: '0 auto',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的需求..."
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 16,
              border: isDark ? '1px solid #2a2a3e' : '1px solid #d0d0da',
              background: isDark ? '#1a1a2e' : '#fff',
              color: isDark ? '#e0e0e8' : '#1a1a2e',
              fontSize: 14,
              lineHeight: 1.4,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              maxHeight: 120,
              opacity: isStreaming ? 0.6 : 1,
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: 'none',
              background: !input.trim() || isStreaming
                ? (isDark ? '#2a2a3e' : '#d0d0da')
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              cursor: !input.trim() || isStreaming ? 'not-allowed' : 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-4px); }
        }
        * {
          -webkit-tap-highlight-color: transparent;
          scrollbar-width: thin;
          scrollbar-color: ${isDark ? '#2a2a3e transparent' : '#d0d0da transparent'};
        }
        textarea::placeholder {
          color: ${isDark ? '#5a5a7e' : '#aaa'};
        }
      `}</style>
    </div>
  );
}
