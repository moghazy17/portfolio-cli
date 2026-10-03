'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { Completion } from '@ahmed-moghazy/shared';
import { recordClientEvent } from '../lib/client-events';

interface Props {
  prefill?: { text: string; nonce: number } | null;
  onPrefillApplied: () => void;
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
  tourText: string | null;
  tourActive: boolean;
  onTourInput: () => void;
  /** Focus the input on mount (off when the terminal is one window among many). */
  autoFocus?: boolean;
}

export default function CommandLine({
  prefill,
  onPrefillApplied,
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
  tourText,
  tourActive,
  onTourInput,
  autoFocus = true,
}: Props) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const previousTab = useRef(false);
  const pendingCaret = useRef<number | null>(null);

  useEffect(() => {
    if (autoFocus && !window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const tourWasActive = useRef(false);
  const tourTakenOver = useRef(false);
  useEffect(() => {
    if (tourText !== null) {
      if (!tourTakenOver.current) { tourWasActive.current = true; setInput(tourText); }
    } else {
      if (tourWasActive.current && !tourTakenOver.current) setInput('');
      tourWasActive.current = false;
      tourTakenOver.current = false;
    }
  }, [tourText]);
  useEffect(() => { if (!tourActive) tourTakenOver.current = false; }, [tourActive]);


  useEffect(() => {
    if (!prefill) return;
    setInput(prefill.text);
    pendingCaret.current = prefill.text.length;
    if (!window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus();
    onPrefillApplied();
  }, [onPrefillApplied, prefill?.nonce]);

  useEffect(() => {
    if (pendingCaret.current !== null) {
      inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '?' && !input && !document.getElementById('command-sheet-heading') && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      // The command bar owns the sheet, which lists every command and the keyboard shortcuts.
      window.dispatchEvent(new Event('command-sheet-request'));
      recordClientEvent('shortcut_sheet_opens');
      return;
    }
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
        if (tourActive && tourText !== null && !tourTakenOver.current) {
          e.preventDefault();
          break;
        }
        if (input.trim()) {
          e.preventDefault();
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
        if (!input && !e.shiftKey) {
          const firstChip = document.querySelector<HTMLButtonElement>('.command-bar button[tabindex="0"]');
          if (firstChip) { e.preventDefault(); firstChip.focus(); return; }
        }
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
      <div className="command-input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            previousTab.current = false;
            resetHistoryCursor();
            if (tourActive && e.target.value !== tourText) {
              tourTakenOver.current = true;
              onTourInput();
            }
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          enterKeyHint="go"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label={`Terminal command input, current directory ${prompt.replace(/^visitor@portfolio:/, '').replace(/\$$/, '')}`}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg)',
            fontFamily: 'inherit',
            fontSize: '16px',
            caretColor: 'var(--primary)',
          }}
        />
      </div>
    </div>
  );
}
