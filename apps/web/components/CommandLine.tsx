'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { Completion } from '@ahmed-moghazy/shared';
import { promptExamplesFor } from '@ahmed-moghazy/shared';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { recordClientEvent } from '../lib/client-events';
import ShortcutSheet from './ShortcutSheet';

interface Props {
  visibleChipLines: string[];
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
}

export default function CommandLine({
  visibleChipLines,
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
}: Props) {
  const [input, setInput] = useState('');
  const [exampleIndex, setExampleIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const examples = promptExamplesFor(visibleChipLines);
  const example = examples[exampleIndex % examples.length];
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousTab = useRef(false);
  const pendingCaret = useRef<number | null>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => setExampleIndex((index) => (index + 1) % examples.length), 4_000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, examples.length]);

  useEffect(() => setExampleIndex((index) => index % examples.length), [examples.length]);
  useEffect(() => {
    const close = () => setSheetOpen(false);
    window.addEventListener('command-sheet-open', close);
    return () => window.removeEventListener('command-sheet-open', close);
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

  const closeSheet = () => { setSheetOpen(false); requestAnimationFrame(() => inputRef.current?.focus()); };

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
      setSheetOpen(true);
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
        {!input && tourText === null && !tourActive && <span className="prompt-example" aria-hidden="true">{example}</span>}
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
            outline: 'none',
            color: 'var(--fg)',
            fontFamily: 'inherit',
            fontSize: '16px',
            caretColor: 'var(--primary)',
          }}
        />
      </div>
      {sheetOpen && <ShortcutSheet onClose={closeSheet} />}
    </div>
  );
}
