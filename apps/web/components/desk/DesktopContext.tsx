'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type WindowId = 'terminal' | 'projects' | 'hero' | 'experience' | 'films' | 'guestbook' | 'about' | 'skills' | 'contact';

interface Desktop {
  front: WindowId;
  collapsed: ReadonlySet<WindowId>;
  order: readonly WindowId[];
  /** Brings a window forward, expands it, and scrolls it into view; `from` animates the zoom rectangle. */
  open: (id: WindowId, from?: Element | null) => void;
  focus: (id: WindowId) => void;
  toggle: (id: WindowId) => void;
  /** Runs a command in the terminal window. */
  run: (command: string, from?: Element | null) => void;
  registerTerminal: (runner: (command: string) => void) => void;
}

const DesktopContext = createContext<Desktop | null>(null);

export function useDesktop(): Desktop {
  const value = useContext(DesktopContext);
  if (!value) throw new Error('useDesktop must be used inside <DesktopProvider>');
  return value;
}

const initialOrder: WindowId[] = ['contact', 'skills', 'about', 'guestbook', 'films', 'experience', 'hero', 'projects', 'terminal'];

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** BeOS-style zoom rectangle: an outline that travels from the clicked icon to the window. */
function zoomRect(from: Element, to: Element) {
  if (reducedMotion()) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const visibleTop = Math.max(0, Math.min(b.top, window.innerHeight - 120));
  const target = { left: b.left, top: visibleTop, width: b.width, height: Math.min(b.height, window.innerHeight - visibleTop) };
  const ghost = document.createElement('div');
  ghost.className = 'be-zoom';
  document.body.appendChild(ghost);
  const frame = (rect: { left: number; top: number; width: number; height: number }) => ({
    transform: `translate(${rect.left}px, ${rect.top}px)`, width: `${rect.width}px`, height: `${rect.height}px`,
  });
  ghost.animate([frame(a), frame(target)], { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
    .finished.finally(() => ghost.remove());
}

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrder] = useState<WindowId[]>(initialOrder);
  const [collapsed, setCollapsed] = useState<Set<WindowId>>(new Set());
  const terminalRef = useRef<((command: string) => void) | null>(null);

  const focus = useCallback((id: WindowId) => {
    setOrder((list) => (list[list.length - 1] === id ? list : [...list.filter((item) => item !== id), id]));
  }, []);

  const open = useCallback((id: WindowId, from?: Element | null) => {
    focus(id);
    setCollapsed((set) => {
      if (!set.has(id)) return set;
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    if (from) requestAnimationFrame(() => zoomRect(from, element));
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
  }, [focus]);

  const toggle = useCallback((id: WindowId) => {
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const run = useCallback((command: string, from?: Element | null) => {
    open('terminal', from);
    terminalRef.current?.(command);
  }, [open]);

  const registerTerminal = useCallback((runner: (command: string) => void) => { terminalRef.current = runner; }, []);

  const value = useMemo<Desktop>(() => ({
    front: order[order.length - 1], collapsed, order, open, focus, toggle, run, registerTerminal,
  }), [order, collapsed, open, focus, toggle, run, registerTerminal]);

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}
