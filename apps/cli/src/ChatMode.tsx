import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { defaultTheme } from '@ahmed-moghazy/shared';
import type { ChatMessage } from '@ahmed-moghazy/shared';

const API_URL = process.env.PORTFOLIO_API_URL;
const ASSISTANT_COLOR = '#28c840';

interface Props {
  onExit: () => void;
}

export default function ChatMode({ onExit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  useInput((ch, key) => {
    if (isLoading) return;

    if (key.escape) {
      onExit();
      return;
    }

    if (key.return) {
      const value = input.trim();
      if (!value) return;

      if (value.toLowerCase() === 'exit') {
        onExit();
        return;
      }

      setInput('');
      sendMessage(value);
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (ch && !key.ctrl && !key.meta && !key.tab) {
      setInput((prev) => prev + ch);
    }
  });

  async function sendMessage(userMessage: string) {
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user' as const, content: userMessage },
    ];
    setMessages(newMessages);
    setIsLoading(true);
    setStreamingContent('');

    if (!API_URL) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Chat unavailable: PORTFOLIO_API_URL is not configured.' }]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I could not connect to the AI service.' },
        ]);
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          // Vercel AI SDK data stream protocol: text tokens are "0:" prefixed
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2));
              accumulated += text;
              setStreamingContent(accumulated);
            } catch {
              // skip malformed lines
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: accumulated },
      ]);
      setStreamingContent('');
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Could not reach the AI service. Make sure you have internet access.' },
      ]);
    }

    setIsLoading(false);
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={defaultTheme.primary} bold>
          AI Chat Mode
        </Text>
        <Text dimColor> — Ask anything about Ahmed</Text>
      </Box>

      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1}>
          <Text>
            <Text color={msg.role === 'user' ? defaultTheme.primary : ASSISTANT_COLOR} bold>
              {msg.role === 'user' ? 'You: ' : "Ahmed's AI: "}
            </Text>
            <Text>{msg.content}</Text>
          </Text>
        </Box>
      ))}

      {isLoading && streamingContent && (
        <Box marginBottom={1}>
          <Text>
            <Text color={ASSISTANT_COLOR} bold>
              {"Ahmed's AI: "}
            </Text>
            <Text>{streamingContent}</Text>
          </Text>
        </Box>
      )}

      {isLoading && !streamingContent && (
        <Box marginBottom={1}>
          <Text color={ASSISTANT_COLOR} dimColor>
            thinking...
          </Text>
        </Box>
      )}

      <Box>
        <Text color={defaultTheme.primary}>&gt; </Text>
        <Text>{input}</Text>
        <Text color={defaultTheme.primary}>_</Text>
      </Box>

      <Text dimColor>
        Type your question | &quot;exit&quot; or Esc: return to commands
      </Text>
    </Box>
  );
}
