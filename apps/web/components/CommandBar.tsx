'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Suggestion } from '@ahmed-moghazy/shared';
import { recordClientEvent } from '../lib/client-events';
import CommandSheet from './CommandSheet';

export default function CommandBar({ items, ready, onSelect }: { items: Suggestion[]; ready: boolean; onSelect: (line: string) => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const count = items.length + 1;

  useEffect(() => { if (!ready) setSheetOpen(false); }, [ready]);
  useEffect(() => { setActiveIndex((index) => Math.min(index, count - 1)); }, [count]);

  const focusPrompt = () => requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.terminal-container input')?.focus());
  const closeSheet = () => { setSheetOpen(false); focusPrompt(); };
  const choose = (line: string) => { setSheetOpen(false); onSelect(line); focusPrompt(); };
  const openSheet = () => {
    window.dispatchEvent(new Event('command-sheet-open'));
    setSheetOpen(true);
    recordClientEvent('command_sheet_opens');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (sheetOpen) return;
    let next: number;
    const index = Array.from(navRef.current?.querySelectorAll('button') ?? []).indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % count; break;
      case 'ArrowLeft': next = (index + count - 1) % count; break;
      case 'Home': next = 0; break;
      case 'End': next = count - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveIndex(next);
    navRef.current?.querySelectorAll('button')[next]?.focus();
  };

  return <nav ref={navRef} className={`command-bar${sheetOpen ? ' command-bar-open' : ''}`} aria-label="Suggestions" onKeyDown={onKeyDown}>
    {ready && <div className="command-bar-items">
      {items.map((item, index) => <button type="button" className={`command-chip${item.kind === 'question' ? ' command-chip-question' : ''}`}
        key={`${item.kind}:${item.line}`} data-line={item.line} tabIndex={activeIndex === index ? 0 : -1}
        onFocus={() => setActiveIndex(index)} onClick={() => choose(item.line)}
        aria-label={item.kind === 'question' ? `Ask the assistant: ${item.label}` : item.label}>
        {item.kind === 'question' && <span aria-hidden="true">✦ </span>}{item.label}
      </button>)}
      <button type="button" className="command-chip command-chip-all" tabIndex={activeIndex === items.length ? 0 : -1}
        onFocus={() => setActiveIndex(items.length)} onClick={openSheet} aria-label="All commands"
        aria-haspopup="dialog" aria-expanded={sheetOpen}>☰ all</button>
    </div>}
    {sheetOpen && <CommandSheet onClose={closeSheet} onSelect={choose} />}
  </nav>;
}
