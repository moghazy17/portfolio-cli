'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { Completion } from '@ahmed-moghazy/shared';

interface Props {
  prefill?: { text: string; nonce: number } | null;
  onSubmit: (input: string) => void;
  complete: (input: string, caret: number) => Completion;
  historyUp: (current: string) => string;
  historyDown: () => string;
  resetHistoryCursor: () => void;
  onListCandidates: (input: string, candidates: string[]) => void;
  onAbandon: (input: string) => void;
  cancel: () => void;
  clearScreen: () => void;
  prompt: string;
  running: boolean;
  sequencePlaying: boolean;
}

export default function CommandLine({
  prefill,
  onSubmit,
  complete,
  historyUp,
  historyDown,
  resetHistoryCursor,
  onListCandidates,
  onAbandon,
  cancel,
  clearScreen,
  prompt,
  running,
  sequencePlaying,
}: Props) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const previousTab = useRef(false);
  const pendingCaret = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!prefill) return;
    setInput(prefill.text);
    pendingCaret.current = prefill.text.length;
    inputRef.current?.focus();
  }, [prefill?.nonce]);

  useEffect(() => {
    if (pendingCaret.current !== null) {
      inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const secondTab = previousTab.current && e.key === 'Tab';
    previousTab.current = e.key === 'Tab';

    if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c' &&
      (window.getSelection()?.toString() ?? '') === '') {
      e.preventDefault();
      if (sequencePlaying || running) cancel();
      else {
        onAbandon(input);
        setInput('');
      }
      return;
    }

    if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      clearScreen();
      return;
    }

    switch (e.key) {
      case 'Enter':
        if (input.trim()) {
          onSubmit(input);
          setInput('');
          resetHistoryCursor();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        setInput(historyUp(input));
        break;

      case 'ArrowDown':
        e.preventDefault();
        setInput(historyDown());
        break;

      case 'Tab':
        e.preventDefault();
        const completion = complete(input, e.currentTarget.selectionStart ?? input.length);
        if (secondTab && completion.candidates.length > 1) {
          onListCandidates(input, completion.candidates);
        } else if (completion.replacement !== undefined) {
          setInput(input.slice(0, completion.start) + completion.replacement + input.slice(completion.end));
          pendingCaret.current = completion.start + completion.replacement.length;
        }
        break;
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span aria-hidden="true" style={{ color: 'var(--accent)', marginRight: '8px', userSelect: 'none' }}>
        {prompt}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => { previousTab.current = false; resetHistoryCursor(); setInput(e.target.value); }}
        onKeyDown={handleKeyDown}
        enterKeyHint="go"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-label={`Terminal command input, current directory ${prompt.replace(/^visitor@portfolio:/, '').replace(/\$$/, '')}`}
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
