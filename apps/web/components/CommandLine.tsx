'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface Props {
  onSubmit: (input: string) => void;
  commandHistory: string[];
  getCompletions: (partial: string) => string[];
}

export default function CommandLine({
  onSubmit,
  commandHistory,
  getCompletions,
}: Props) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        if (input.trim()) {
          onSubmit(input);
          setInput('');
          setHistoryIndex(-1);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex < commandHistory.length - 1
              ? historyIndex + 1
              : historyIndex;
          setHistoryIndex(newIndex);
          setInput(commandHistory[commandHistory.length - 1 - newIndex]);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(commandHistory[commandHistory.length - 1 - newIndex]);
        } else {
          setHistoryIndex(-1);
          setInput('');
        }
        break;

      case 'Tab':
        e.preventDefault();
        if (input.trim()) {
          const completions = getCompletions(input.trim());
          if (completions.length === 1) {
            setInput(completions[0]);
          }
        }
        break;

      case 'l':
        if (e.ctrlKey) {
          e.preventDefault();
          onSubmit('clear');
        }
        break;
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{ color: 'var(--accent)', marginRight: '8px', userSelect: 'none' }}>
        $
      </span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        enterKeyHint="go"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-label="Terminal command input"
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
    </div>
  );
}
