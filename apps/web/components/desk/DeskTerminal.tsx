'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerminalEntry } from '../../hooks/useTerminal';
import Terminal from '../Terminal';
import BeWindow from './BeWindow';
import { isDeskLayout, useDesktop } from './DesktopContext';
import { installDisclosureMotion, playConfetti, playWebStrand } from './DeskEffects';

/** The real terminal, one window on the desk: same shell, theme, history and session as `/`. */
export default function DeskTerminal({ initial }: { initial: TerminalEntry[] }) {
  const desktop = useDesktop();
  const [offscreen, setOffscreen] = useState(false);
  const effects = useRef(new Set<() => void>());
  const effectTimers = useRef(new Set<number>());

  useEffect(() => {
    const stopDisclosureMotion = installDisclosureMotion();
    const activeEffects = effects.current;
    const activeTimers = effectTimers.current;
    return () => {
      stopDisclosureMotion();
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeEffects.forEach((cleanup) => cleanup());
      activeEffects.clear();
    };
  }, []);

  const openWindow = desktop.open;
  const onFx = useCallback((fx: 'web' | 'confetti' | 'films') => {
    const tab = document.querySelector('#terminal .be-tab');
    if (fx === 'films') { openWindow('films', tab); return; }
    if (fx === 'web' && !tab) return;
    const cleanup = fx === 'web' ? playWebStrand(tab!) : playConfetti();
    effects.current.add(cleanup);
    const timer = window.setTimeout(() => { effects.current.delete(cleanup); effectTimers.current.delete(timer); }, 1250);
    effectTimers.current.add(timer);
  }, [openWindow]);

  // Bringing the terminal to the front (tab click, icon, Deskbar) makes it ready to type, as on a real desk.
  useEffect(() => {
    if (desktop.front !== 'terminal' || !isDeskLayout() || !window.matchMedia('(pointer: fine)').matches) return;
    if (document.activeElement?.closest('#terminal')) return;
    document.querySelector<HTMLInputElement>('#terminal .command-input-wrap input')?.focus({ preventScroll: true });
  }, [desktop.front]);

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
        <Terminal windowed initialHistory={initial} registerRunner={desktop.registerTerminal} onFx={onFx} />
      </BeWindow>
    </>
  );
}
