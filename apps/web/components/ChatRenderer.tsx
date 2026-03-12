'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface Props {
  onExit: () => void;
}

function getMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function ChatRenderer({ onExit }: Props) {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const handleSubmit = () => {
    const value = input.trim();
    if (!value || isLoading) return;

    if (value.toLowerCase() === 'exit') {
      onExit();
      return;
    }

    sendMessage({ text: value });
    setInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {messages.map((msg) => {
        const text = getMessageText(msg.parts);
        if (!text) return null;
        return (
          <div key={msg.id} style={{ marginBottom: '8px' }}>
            <span
              style={{
                color: msg.role === 'user' ? 'var(--accent)' : 'var(--primary)',
                fontWeight: 'bold',
                userSelect: 'none',
              }}
            >
              {msg.role === 'user' ? 'You: ' : "Ahmed's AI: "}
            </span>
            <span style={{ color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{text}</span>
          </div>
        );
      })}

      {status === 'submitted' && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
            {"Ahmed's AI: "}
          </span>
          <span
            style={{
              color: 'var(--primary)',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          >
            thinking...
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--primary)', marginRight: '0', userSelect: 'none' }}>
          &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          enterKeyHint="send"
          placeholder="Ask about Ahmed... (type 'exit' to leave)"
          disabled={isLoading}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label="Chat input"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--fg)',
            fontFamily: 'inherit',
            fontSize: '16px',
            caretColor: 'var(--primary)',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          style={{
            background: input.trim() && !isLoading ? 'var(--primary)' : 'transparent',
            border: '1px solid var(--primary)',
            color: input.trim() && !isLoading ? 'var(--bg)' : 'var(--dimmed)',
            padding: '6px 14px',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: '14px',
            cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
            opacity: input.trim() && !isLoading ? 1 : 0.5,
          }}
        >
          Send
        </button>
      </div>

      <div style={{ color: 'var(--dimmed)', fontSize: '12px' }}>
        Type your question and press Enter | &quot;exit&quot; to return to commands
      </div>

      <div ref={bottomRef} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
