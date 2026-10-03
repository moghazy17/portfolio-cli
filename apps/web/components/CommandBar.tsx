'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { recordClientEvent } from '../lib/client-events';
import CommandSheet from './CommandSheet';

/** The fixed chip bar under every terminal: the same chips on `/` and in the /gui window. */
const chips: Array<{ label: string; line: string; icon?: string; question?: true }> = [
  { label: 'projects', line: 'projects', icon: '/desk/projects.webp' },
  { label: 'skills', line: 'skills', icon: '/desk/skills.webp' },
  { label: 'experience', line: 'experience', icon: '/desk/experience.webp' },
  { label: 'resume', line: 'resume', icon: '/desk/resume.webp' },
  { label: 'ask AI', line: 'What did he build with LLMs at his current job?', question: true },
];

const spark = (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M10 1.5 12 8l6.5 2-6.5 2-2 6.5L8 12l-6.5-2L8 8z" fill="currentColor" />
  </svg>
);

export default function CommandBar({ ready, onSelect, variant = 'terminal' }: {
  ready: boolean;
  onSelect: (line: string) => void;
  /** `desk` styles the bar for the /gui terminal window. */
  variant?: 'terminal' | 'desk';
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const count = chips.length + 1;

  useEffect(() => { if (!ready) setSheetOpen(false); }, [ready]);
  useEffect(() => {
    const request = () => { if (ready) { setSheetOpen(true); recordClientEvent('command_sheet_opens'); } };
    window.addEventListener('command-sheet-request', request);
    return () => window.removeEventListener('command-sheet-request', request);
  }, [ready]);

  const focusPrompt = () => requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.terminal-container input')?.focus());
  const closeSheet = () => { setSheetOpen(false); focusPrompt(); };
  const choose = (line: string) => { setSheetOpen(false); onSelect(line); focusPrompt(); };
  const openSheet = () => {
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

  const desk = variant === 'desk';
  const sheetTheme = (): React.CSSProperties => {
    const source = navRef.current;
    if (!source) return {};
    const computed = getComputedStyle(source);
    return Object.fromEntries(['--bg', '--fg', '--primary', '--accent', '--dimmed'].map((name) => [name, computed.getPropertyValue(name)])) as React.CSSProperties;
  };
  const sheet = sheetOpen && <CommandSheet onClose={closeSheet} onSelect={choose} desk={desk} style={desk ? sheetTheme() : undefined} />;
  const chipClass = (question?: boolean) => desk
    ? `be-chip${question ? ' be-chip-ask' : ''}`
    : `command-chip${question ? ' command-chip-question' : ''}`;

  return <nav ref={navRef} className={`command-bar${desk ? ' command-bar-desk' : ''}${sheetOpen ? ' command-bar-open' : ''}`}
    aria-label="Quick commands" onKeyDown={onKeyDown}>
    <div className={desk ? 'be-chips' : 'command-bar-items'}>
      {chips.map((chip, index) => <button type="button" className={chipClass(chip.question)}
        key={chip.label} data-line={chip.line} disabled={!ready} tabIndex={activeIndex === index ? 0 : -1}
        onFocus={() => setActiveIndex(index)}
        onClick={() => { recordClientEvent('suggestion_taps'); choose(chip.line); }}
        aria-label={chip.question ? `Ask the assistant: ${chip.line}` : undefined}>
        {chip.icon ? <img src={chip.icon} alt="" width={18} height={18} /> : spark}{chip.label}
      </button>)}
      <button type="button" className={`${chipClass()} ${desk ? 'be-chip-all' : 'command-chip-all'}`} disabled={!ready}
        tabIndex={activeIndex === chips.length ? 0 : -1}
        onFocus={() => setActiveIndex(chips.length)} onClick={openSheet}
        aria-haspopup="dialog" aria-expanded={sheetOpen}><span aria-hidden="true">⋯</span> all commands</button>
    </div>
    {desk && sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet}
  </nav>;
}
