'use client';

import { useEffect, useRef } from 'react';
import { getMenuGroups } from '@ahmed-moghazy/shared';

const groups = getMenuGroups();
const shortcuts = [
  ['Tab', 'Complete a command'], ['↑ / ↓', 'Browse command history'],
  ['Ctrl+L', 'Clear the screen'], ['Ctrl+C', 'Cancel the current command'],
  ['? or Esc', 'Open or close this sheet'],
];

export default function CommandSheet({ onClose, onSelect }: { onClose: () => void; onSelect: (line: string) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeRef.current?.focus(); }, []);

  return <>
    <div className="command-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} />
    <div ref={dialogRef} className="command-sheet" role="dialog" aria-modal="true" aria-labelledby="command-sheet-heading"
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === '?') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
        if (event.key !== 'Tab') return;
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <div className="command-sheet-header"><h2 id="command-sheet-heading">All commands</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="Close all commands">×</button></div>
      <div className="command-sheet-list">
        {groups.map((group) => <section key={group.heading} aria-label={group.heading}>
          <h3>{group.heading}</h3>
          {group.items.map((item) => <button key={item.value} type="button" onClick={() => onSelect(item.value)}>
            <span className="command-sheet-name">{item.value}</span>
            <span className="command-sheet-description">{item.label.slice(item.value.length).trim()}</span>
          </button>)}
        </section>)}
        <section aria-label="Keyboard shortcuts" className="command-sheet-shortcuts">
          <h3>Keyboard shortcuts</h3>
          <dl>{shortcuts.map(([key, description]) => <div key={key}><dt>{key}</dt><dd>{description}</dd></div>)}</dl>
        </section>
      </div>
    </div>
  </>;
}
