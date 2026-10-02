'use client';

import { useEffect, useRef } from 'react';

export default function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const shortcuts = [
    ['Tab', 'Complete a command'], ['↑ / ↓', 'Browse command history'],
    ['Ctrl+L', 'Clear the screen'], ['Ctrl+C', 'Cancel the current command'],
    ['Esc', 'Leave chat or close this sheet'], ['?', 'Open or close this sheet'],
  ];
  return (
    <div className="shortcut-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="shortcut-sheet" role="dialog" aria-modal="true" aria-labelledby="shortcut-heading"
        onKeyDown={(event) => {
          if (event.key === 'Escape' || event.key === '?') { event.preventDefault(); onClose(); }
          if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
        }}>
        <h2 id="shortcut-heading">Keyboard shortcuts</h2>
        <dl>{shortcuts.map(([key, description]) => <div key={key}><dt>{key}</dt><dd>{description}</dd></div>)}</dl>
        <button type="button" ref={closeRef} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
