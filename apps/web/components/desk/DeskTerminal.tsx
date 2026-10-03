'use client';

import { useEffect, useState } from 'react';
import type { TerminalEntry } from '../../hooks/useTerminal';
import Terminal from '../Terminal';
import BeWindow from './BeWindow';
import { useDesktop } from './DesktopContext';

/** The real terminal, one window on the desk: same shell, theme, history and session as `/`. */
export default function DeskTerminal({ initial }: { initial: TerminalEntry[] }) {
  const desktop = useDesktop();
  const [offscreen, setOffscreen] = useState(false);

  // On the scrolling phone/tablet stack, keep the terminal one tap away once it scrolls out of view.
  useEffect(() => {
    const element = document.getElementById('terminal');
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {offscreen && (
        <button type="button" className="be-docked-tab" onClick={(event) => desktop.open('terminal', event.currentTarget)}>
          <img src="/desk/terminal.webp" alt="" width={22} height={22} />
          Terminal
        </button>
      )}
      <BeWindow id="terminal" title="Terminal" className="be-terminal" bodyClassName="be-term-body">
        <Terminal windowed initialHistory={initial} registerRunner={desktop.registerTerminal} />
      </BeWindow>
    </>
  );
}
