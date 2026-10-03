'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type WindowId = 'terminal' | 'projects' | 'hero' | 'experience' | 'films' | 'guestbook' | 'about' | 'skills' | 'contact';

/** Every window on the desk, in Deskbar order, with the title and icon its Deskbar entry shows. */
export const deskWindows: ReadonlyArray<{ id: WindowId; title: string; icon: string }> = [
  { id: 'terminal', title: 'Terminal', icon: '/desk/terminal.webp' },
  { id: 'hero', title: 'Résumé.pdf', icon: '/desk/resume.webp' },
  { id: 'about', title: 'About', icon: '/desk/about.webp' },
  { id: 'projects', title: 'Projects', icon: '/desk/projects.webp' },
  { id: 'experience', title: 'Experience', icon: '/desk/experience.webp' },
  { id: 'skills', title: 'System Profile', icon: '/desk/skills.webp' },
  { id: 'films', title: 'Films', icon: '/desk/films.webp' },
  { id: 'guestbook', title: 'Guestbook', icon: '/desk/guestbook.webp' },
  { id: 'contact', title: 'Mail', icon: '/desk/mail.webp' },
];

const windowIds = new Set<string>(deskWindows.map((item) => item.id));
const isWindowId = (value: string): value is WindowId => windowIds.has(value);

export interface Point { x: number; y: number }

interface Desktop {
  /** The focused window: the last open one in `order`. */
  front: WindowId | null;
  /** Back-to-front stacking order of every window, open or not. */
  order: readonly WindowId[];
  /** Windows taken off the desk (≥1100px only; the phone stack shows everything). */
  minimized: ReadonlySet<WindowId>;
  maximized: ReadonlySet<WindowId>;
  /** Desk position of a window that has been placed (cascaded or dragged); unset windows use their CSS spot. */
  positions: Readonly<Partial<Record<WindowId, Point>>>;
  /** Restores a window, brings it forward and scrolls it into view; `from` animates the zoom rectangle. */
  open: (id: WindowId, from?: Element | null) => void;
  focus: (id: WindowId) => void;
  minimize: (id: WindowId) => void;
  toggleMaximized: (id: WindowId) => void;
  /** Deskbar entry click: restore a minimized window, minimize the front one, or raise any other. */
  activate: (id: WindowId, from?: Element | null) => void;
  place: (id: WindowId, point: Point) => void;
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

/** Back to front. The terminal starts in front and alone; every other window starts minimized. */
const initialOrder: WindowId[] = ['contact', 'skills', 'about', 'guestbook', 'films', 'experience', 'hero', 'projects', 'terminal'];
const initialMinimized = new Set<WindowId>(initialOrder.filter((id) => id !== 'terminal'));

/** Opened windows step down and right from the desk's top-left, like BeOS's window placement. */
const CASCADE = { x: 24, y: 20, step: 32, slots: 7 };

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The free-form desk; below it windows stack in one scrolling column. */
export function isDeskLayout(): boolean {
  return window.matchMedia('(min-width: 1100px)').matches;
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

const without = <T,>(set: ReadonlySet<T>, item: T): Set<T> => {
  const next = new Set(set);
  next.delete(item);
  return next;
};

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrder] = useState<WindowId[]>(initialOrder);
  const [minimized, setMinimized] = useState<ReadonlySet<WindowId>>(initialMinimized);
  const [maximized, setMaximized] = useState<ReadonlySet<WindowId>>(new Set());
  const [positions, setPositions] = useState<Partial<Record<WindowId, Point>>>({});
  const cascadeRef = useRef(0);
  const terminalRef = useRef<((command: string) => void) | null>(null);
  const stateRef = useRef({ order, minimized });
  stateRef.current = { order, minimized };

  const front = useMemo(() => [...order].reverse().find((id) => !minimized.has(id)) ?? null, [order, minimized]);

  const focus = useCallback((id: WindowId) => {
    setOrder((list) => (list[list.length - 1] === id ? list : [...list.filter((item) => item !== id), id]));
  }, []);

  const open = useCallback((id: WindowId, from?: Element | null) => {
    focus(id);
    if (stateRef.current.minimized.has(id)) {
      setMinimized((set) => without(set, id));
      // First time on the desk: take the next cascade slot. A window that was moved keeps its place.
      setPositions((map) => {
        if (map[id] || id === 'terminal') return map;
        const slot = cascadeRef.current++ % CASCADE.slots;
        return { ...map, [id]: { x: CASCADE.x + slot * CASCADE.step, y: CASCADE.y + slot * CASCADE.step } };
      });
    }
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
    // Wait for the window to be shown before measuring it.
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (!element) return;
      if (!isDeskLayout()) element.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      if (from) zoomRect(from, element);
    });
  }, [focus]);

  const minimize = useCallback((id: WindowId) => {
    setMinimized((set) => new Set(set).add(id));
    setMaximized((set) => (set.has(id) ? without(set, id) : set));
    if (history.replaceState && window.location.hash === `#${id}`) history.replaceState(null, '', window.location.pathname);
  }, []);

  const toggleMaximized = useCallback((id: WindowId) => {
    focus(id);
    setMaximized((set) => (set.has(id) ? without(set, id) : new Set(set).add(id)));
  }, [focus]);

  const activate = useCallback((id: WindowId, from?: Element | null) => {
    const { order: list, minimized: hidden } = stateRef.current;
    const top = [...list].reverse().find((item) => !hidden.has(item));
    if (hidden.has(id)) open(id, from);
    else if (top === id) minimize(id);
    else focus(id);
  }, [open, minimize, focus]);

  const place = useCallback((id: WindowId, point: Point) => {
    setPositions((map) => ({ ...map, [id]: point }));
  }, []);

  const run = useCallback((command: string, from?: Element | null) => {
    open('terminal', from);
    terminalRef.current?.(command);
  }, [open]);

  const registerTerminal = useCallback((runner: (command: string) => void) => { terminalRef.current = runner; }, []);

  // Deep links: /gui#projects opens the desk with Projects open and in front.
  useEffect(() => {
    const follow = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (isWindowId(id)) open(id);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [open]);

  const value = useMemo<Desktop>(() => ({
    front, order, minimized, maximized, positions, open, focus, minimize, toggleMaximized, activate, place, run, registerTerminal,
  }), [front, order, minimized, maximized, positions, open, focus, minimize, toggleMaximized, activate, place, run, registerTerminal]);

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}
