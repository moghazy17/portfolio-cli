'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState, useRef, useEffect, useMemo, KeyboardEvent, MutableRefObject } from 'react';
import { formatSourcesLine, parseAssistantDataPart, profile, redactSecrets, sanitizeAssistantText, toRequestMessages } from '@ahmed-moghazy/shared';
import type { AssistantTurn, Theme } from '@ahmed-moghazy/shared';
import AssistantAnswer from './AssistantAnswer';
import type { AssistantEntryState } from '../hooks/useTerminal';

interface Props {
  onExit: () => void;
  conversationRef: MutableRefObject<AssistantTurn[]>;
  theme: Theme;
}

type EntryPart = AssistantEntryState['parts'][number];

const MAX_TURNS = 10;

function getMessageText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('');
}

function cleanText(text: string): string {
  return sanitizeAssistantText(redactSecrets(text));
}

// Converts a streamed message into the parts AssistantAnswer renders. Malformed data
// parts are dropped.
function toEntryParts(message: UIMessage): EntryPart[] {
  // A refusal stands alone: text the model wrote before the decline marker is dropped, and
  // the fixed refusal text that follows the marker is kept.
  const declinedAt = message.parts.findIndex((part) => part.type === 'data-decline');
  return message.parts.flatMap((part, index): EntryPart[] => {
    if (part.type === 'text' && index < declinedAt) return [];
    if (part.type === 'text') {
      const text = cleanText(part.text);
      return text.trim() ? [{ kind: 'text', text }] : [];
    }
    const event = parseAssistantDataPart(part.type, (part as { data?: unknown }).data);
    if (event?.type === 'command') return [{ kind: 'command', commandLine: event.commandLine, output: event.output }];
    if (event?.type === 'sources') {
      const line = formatSourcesLine(event);
      return line ? [{ kind: 'sources', line }] : [];
    }
    if (event?.type === 'notice') return [{ kind: 'notice', notice: event.kind, message: event.message }];
    return [];
  });
}

function toMessages(turns: AssistantTurn[]): UIMessage[] {
  return turns.map((turn, index) => ({
    id: `seed-${index}`, role: turn.role, parts: [{ type: 'text' as const, text: turn.text }],
  }));
}

// Errors arrive either as a stream error message or as a raw JSON response body
// (e.g. our 429 rate-limit response), so unwrap the JSON case.
function getErrorText(error: Error): string {
  try {
    const parsed = JSON.parse(error.message);
    if (typeof parsed?.error === 'string') return parsed.error;
  } catch {
    // not JSON — use the message as-is
  }
  return error.message || 'Something went wrong. Please try again.';
}

export default function ChatRenderer({ onExit, conversationRef, theme }: Props) {
  const transport = useMemo(
    () => new DefaultChatTransport<UIMessage>({
      api: '/api/chat',
      // Only recent text goes on the wire; command output stays in the rendered transcript.
      prepareSendMessagesRequest: ({ messages }) => ({ body: { messages: toRequestMessages(messages), surface: 'web' } }),
    }),
    [],
  );
  const [seed] = useState(() => toMessages(conversationRef.current));
  const { messages, sendMessage, stop, status, error } = useChat({
    transport,
    messages: seed,
    onFinish: ({ message, messages: all, isAbort, isError, isDisconnect }) => {
      if (isAbort || isError || isDisconnect) return;
      // Same text the visitor saw, so a refusal is remembered without the discarded preamble.
      const answer = toEntryParts(message).flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('').trim();
      const question = all[all.length - 2];
      if (!answer || question?.role !== 'user') return;
      conversationRef.current = [
        ...conversationRef.current,
        { role: 'user' as const, text: getMessageText(question) },
        { role: 'assistant' as const, text: answer },
      ].slice(-MAX_TURNS);
    },
  });
  const [input, setInput] = useState('');
  const [cancelled, setCancelled] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const stopAnswer = () => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (lastUser) setCancelled((previous) => new Set(previous).add(lastUser.id));
    stop();
  };

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
    if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c' &&
      (window.getSelection()?.toString() ?? '') === '') {
      e.preventDefault();
      if (isLoading) stopAnswer();
      else onExit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const label = (role: UIMessage['role']) => (
    <span
      style={{
        color: role === 'user' ? 'var(--accent)' : 'var(--primary)',
        fontWeight: 'bold',
        userSelect: 'none',
      }}
    >
      {role === 'user' ? 'You: ' : `${profile.firstName}'s AI: `}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {messages.map((msg, index) => {
        if (msg.role === 'system') return null;
        const isLast = index === messages.length - 1;

        if (msg.role === 'user') {
          // A question with no answer yet is either being awaited or was stopped before any output.
          const unanswered = messages[index + 1]?.role !== 'assistant';
          const pending: AssistantEntryState['status'] | null = !unanswered ? null
            : cancelled.has(msg.id) ? 'cancelled'
              : isLast && status === 'submitted' ? 'thinking' : null;
          const question = getMessageText(msg);
          return (
            <div key={msg.id} style={{ marginBottom: '8px' }}>
              <div>
                {label('user')}
                <span style={{ color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{question}</span>
              </div>
              {pending && (
                <div>
                  {label('assistant')}
                  <AssistantAnswer state={{ question, status: pending, parts: [] }} theme={theme} />
                </div>
              )}
            </div>
          );
        }

        const parts = toEntryParts(msg);
        if (!parts.length) return null;
        const question = messages[index - 1];
        const state: AssistantEntryState['status'] = question && cancelled.has(question.id) ? 'cancelled'
          : isLast && status === 'streaming' ? 'streaming' : 'done';
        return (
          <div key={msg.id} style={{ marginBottom: '8px' }}>
            {label('assistant')}
            <AssistantAnswer
              state={{ question: question ? getMessageText(question) : '', status: state, parts }}
              theme={theme}
            />
          </div>
        );
      })}

      {error && status === 'error' && (
        <div role="alert" style={{ marginBottom: '8px', color: 'var(--error)', whiteSpace: 'pre-wrap' }}>
          {getErrorText(error)}
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
          placeholder={`Ask about ${profile.firstName}... (type 'exit' to leave)`}
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
    </div>
  );
}
