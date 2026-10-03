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
  { id: 'skills', title: 'Skills', icon: '/desk/skills.webp' },
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
  /** Windows still visible while their minimize gesture finishes. */
  exiting: ReadonlySet<WindowId>;
  opening: ReadonlySet<WindowId>;
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

const TAB_MARGIN = 8;
const CASCADE_COLUMNS = [24, 260, 496, 732, 968];

/** Measure tabs in layout coordinates so an in-progress open animation cannot skew placement. */
function tabBox(element: HTMLElement) {
  const tab = element.querySelector<HTMLElement>('.be-tab')!;
  const left = element.offsetLeft + tab.offsetLeft;
  const top = element.offsetTop + tab.offsetTop;
  return { left, top, right: left + tab.offsetWidth, bottom: top + tab.offsetHeight };
}

function firstOpenPosition(id: WindowId): Point | null {
  const element = document.getElementById(id);
  // A minimized element has no offsetParent until its display rule is lifted for measurement.
  if (!element) return null;
  const otherTabs = [...document.querySelectorAll<HTMLElement>('.be-win:not(.is-minimized):not(.is-exiting)')]
    .filter((win) => win !== element).map(tabBox);
  const oldX = element.style.getPropertyValue('--x');
  const oldY = element.style.getPropertyValue('--y');
  element.classList.remove('is-minimized');
  try {
    const desk = element.offsetParent as HTMLElement | null;
    if (!desk) return null;
    const preferred = { x: element.offsetLeft, y: element.offsetTop };
    element.style.setProperty('--x', '12px');
    element.style.setProperty('--y', '20px');
    const naturalWidth = element.offsetWidth;
    const maxX = Math.max(12, desk.clientWidth - naturalWidth - 12);
    const maxY = Math.max(20, desk.clientHeight - 210);
    const xSlots = [preferred.x, ...CASCADE_COLUMNS].map((x) => Math.round(Math.min(Math.max(12, x), maxX)));
    const ySlots = Array.from({ length: 10 }, (_, i) => 20 + i * 58)
      .filter((y) => y <= maxY).sort((a, b) => Math.abs(a - preferred.y) - Math.abs(b - preferred.y));
    const candidates = [preferred, ...xSlots.flatMap((x) => ySlots.map((y) => ({ x, y })))];
    for (const candidate of candidates) {
      element.style.setProperty('--x', `${candidate.x}px`);
      element.style.setProperty('--y', `${candidate.y}px`);
      const tab = tabBox(element);
      const fits = element.offsetLeft >= 0 && element.offsetTop >= 0 &&
        element.offsetLeft + element.offsetWidth <= desk.clientWidth &&
        element.offsetTop + element.offsetHeight <= desk.clientHeight;
      const free = otherTabs.every((other) =>
        tab.right + TAB_MARGIN <= other.left || other.right + TAB_MARGIN <= tab.left ||
        tab.bottom + TAB_MARGIN <= other.top || other.bottom + TAB_MARGIN <= tab.top);
      if (fits && free) return candidate;
    }
    return { x: xSlots[0], y: ySlots[0] ?? 20 };
  } finally {
    if (oldX) element.style.setProperty('--x', oldX); else element.style.removeProperty('--x');
    if (oldY) element.style.setProperty('--y', oldY); else element.style.removeProperty('--y');
    element.classList.add('is-minimized');
  }
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The free-form desk; below it windows stack in one scrolling column. */
export function isDeskLayout(): boolean {
  return window.matchMedia('(min-width: 1100px)').matches;
}

/** BeOS-style zoom rectangle: an outline that travels from the clicked icon to the window. */
function zoomRect(a: DOMRect, to: Element): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  const b = to.getBoundingClientRect();
  const visibleTop = Math.max(0, Math.min(b.top, window.innerHeight - 120));
  const target = { left: b.left, top: visibleTop, width: b.width, height: Math.min(b.height, window.innerHeight - visibleTop) };
  const ghost = document.createElement('div');
  ghost.className = 'be-zoom';
  document.body.appendChild(ghost);
  const frame = (rect: { left: number; top: number; width: number; height: number }) => ({
    transform: `translate(${rect.left}px, ${rect.top}px)`, width: `${rect.width}px`, height: `${rect.height}px`,
  });
  return ghost.animate([frame(a), frame(target)], { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
    .finished.catch(() => undefined).then(() => { ghost.remove(); });
}

const without = <T,>(set: ReadonlySet<T>, item: T): Set<T> => {
  const next = new Set(set);
  next.delete(item);
  return next;
};

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrder] = useState<WindowId[]>(initialOrder);
  const [minimized, setMinimized] = useState<ReadonlySet<WindowId>>(initialMinimized);
  const [exiting, setExiting] = useState<ReadonlySet<WindowId>>(new Set());
  const [opening, setOpening] = useState<ReadonlySet<WindowId>>(new Set());
  const [maximized, setMaximized] = useState<ReadonlySet<WindowId>>(new Set());
  const [positions, setPositions] = useState<Partial<Record<WindowId, Point>>>({});
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const terminalRef = useRef<((command: string) => void) | null>(null);
  const stateRef = useRef({ order, minimized });
  stateRef.current = { order, minimized };
  const animations = useRef(new Map<WindowId, Animation>());
  const versions = useRef(new Map<WindowId, number>());

  const interrupt = useCallback((id: WindowId) => {
    const version = (versions.current.get(id) ?? 0) + 1;
    versions.current.set(id, version);
    animations.current.get(id)?.cancel();
    animations.current.delete(id);
    document.getElementById(id)?.style.removeProperty('transform-origin');
    return version;
  }, []);

  const front = useMemo(() => [...order].reverse().find((id) => !minimized.has(id)) ?? null, [order, minimized]);

  const focus = useCallback((id: WindowId) => {
    const list = stateRef.current.order;
    if (list[list.length - 1] === id) return;
    const next = [...list.filter((item) => item !== id), id];
    stateRef.current = { ...stateRef.current, order: next };
    setOrder(next);
  }, []);

  const open = useCallback((id: WindowId, from?: Element | null) => {
    const version = interrupt(id);
    const animate = isDeskLayout() && !reducedMotion();
    const wasHidden = stateRef.current.minimized.has(id);
    const source = from?.getBoundingClientRect();
    setExiting((set) => without(set, id));
    setOpening((set) => animate && (wasHidden || !!from) ? new Set(set).add(id) : without(set, id));
    focus(id);
    if (wasHidden) {
      stateRef.current = { ...stateRef.current, minimized: without(stateRef.current.minimized, id) };
      setMinimized((set) => without(set, id));
      setMaximized((set) => (set.has(id) ? without(set, id) : set));
      // Keep dragged/previous positions; otherwise try the window's own CSS spot before finding a free tab slot.
      if (id !== 'terminal' && !positionsRef.current[id] && isDeskLayout()) {
        const point = firstOpenPosition(id);
        if (point) {
          positionsRef.current = { ...positionsRef.current, [id]: point };
          setPositions(positionsRef.current);
        }
      }
    }
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
    // Wait for the window to be shown before measuring it.
    requestAnimationFrame(async () => {
      const element = document.getElementById(id);
      if (!element) return;
      if (!isDeskLayout()) element.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      if (!animate || (!wasHidden && !from)) return;
      if (source) {
        const target = element.getBoundingClientRect();
        element.style.transformOrigin = `${source.left + source.width / 2 < target.left + target.width / 2 ? 'left' : 'right'} center`;
      }
      if (source) await zoomRect(source, element);
      if (versions.current.get(id) !== version) return;
      const animation = element.animate(
        [{ transform: 'scale(.85)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
      );
      animations.current.set(id, animation);
      try { await animation.finished; } catch { return; }
      if (versions.current.get(id) !== version) return;
      setOpening((set) => without(set, id));
      requestAnimationFrame(() => animation.cancel());
      animations.current.delete(id);
      element.style.removeProperty('transform-origin');
    });
  }, [focus, interrupt]);

  const minimize = useCallback((id: WindowId) => {
    const version = interrupt(id);
    setOpening((set) => without(set, id));
    const animate = isDeskLayout() && !reducedMotion() && !stateRef.current.minimized.has(id);
    if (animate) setExiting((set) => new Set(set).add(id));
    else setExiting((set) => without(set, id));
    stateRef.current = { ...stateRef.current, minimized: new Set(stateRef.current.minimized).add(id) };
    setMinimized((set) => new Set(set).add(id));
    if (!animate) setMaximized((set) => (set.has(id) ? without(set, id) : set));
    if (history.replaceState && window.location.hash === `#${id}`) history.replaceState(null, '', window.location.pathname);
    if (!animate) return;
    const element = document.getElementById(id);
    const entry = document.querySelector(`[data-window-entry="${id}"]`);
    if (!element) { setExiting((set) => without(set, id)); return; }
    const a = element.getBoundingClientRect();
    const b = entry?.getBoundingClientRect();
    const dx = b ? b.left + b.width / 2 - (a.left + a.width / 2) : 0;
    const dy = b ? b.top + b.height / 2 - (a.top + a.height / 2) : 0;
    const animation = element.animate(
      [{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.16)`, opacity: 0 }],
      { duration: 200, easing: 'cubic-bezier(.55, .08, .9, .45)', fill: 'forwards' },
    );
    animations.current.set(id, animation);
    animation.finished.then(() => {
      if (versions.current.get(id) !== version) return;
      setExiting((set) => without(set, id));
      setMaximized((set) => (set.has(id) ? without(set, id) : set));
      requestAnimationFrame(() => animation.cancel());
      animations.current.delete(id);
      if (entry) {
        entry.classList.remove('be-entry-flash');
        void (entry as HTMLElement).offsetWidth;
        entry.classList.add('be-entry-flash');
        window.setTimeout(() => entry.classList.remove('be-entry-flash'), 260);
      }
    }).catch(() => undefined);
  }, [interrupt]);

  const toggleMaximized = useCallback((id: WindowId) => {
    const version = interrupt(id);
    const element = document.getElementById(id);
    const before = element?.getBoundingClientRect();
    focus(id);
    setMaximized((set) => (set.has(id) ? without(set, id) : new Set(set).add(id)));
    if (!element || !before || !isDeskLayout() || reducedMotion()) return;
    requestAnimationFrame(() => {
      if (versions.current.get(id) !== version) return;
      const after = element.getBoundingClientRect();
      const sx = before.width / after.width;
      const sy = before.height / after.height;
      const animation = element.animate(
        [{ transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${sx}, ${sy})` }, { transform: 'none' }],
        { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
      element.style.transformOrigin = 'top left';
      animations.current.set(id, animation);
      animation.finished.then(() => {
        if (versions.current.get(id) === version) {
          element.style.removeProperty('transform-origin');
          animations.current.delete(id);
        }
      }).catch(() => undefined);
    });
  }, [focus, interrupt]);

  const activate = useCallback((id: WindowId, from?: Element | null) => {
    const { order: list, minimized: hidden } = stateRef.current;
    const top = [...list].reverse().find((item) => !hidden.has(item));
    if (hidden.has(id)) open(id, from);
    else if (top === id) minimize(id);
    else focus(id);
  }, [open, minimize, focus]);

  const place = useCallback((id: WindowId, point: Point) => {
    positionsRef.current = { ...positionsRef.current, [id]: point };
    setPositions(positionsRef.current);
  }, []);

  const run = useCallback((command: string, from?: Element | null) => {
    open('terminal', from);
    terminalRef.current?.(command);
  }, [open]);

  const registerTerminal = useCallback((runner: (command: string) => void) => { terminalRef.current = runner; }, []);

  // Deep links: /gui#projects opens the desk with Projects open and in front.
  useEffect(() => {
    const follow = () => {
      // A malformed escape (`#%E0`) must not take the desk down; window ids never need decoding anyway.
      const id = window.location.hash.slice(1);
      if (isWindowId(id)) open(id);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [open]);

  const value = useMemo<Desktop>(() => ({
    front, order, minimized, exiting, opening, maximized, positions, open, focus, minimize, toggleMaximized, activate, place, run, registerTerminal,
  }), [front, order, minimized, exiting, opening, maximized, positions, open, focus, minimize, toggleMaximized, activate, place, run, registerTerminal]);

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}
