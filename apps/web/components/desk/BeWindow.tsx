'use client';

import { useRef, useState } from 'react';
import { isDeskLayout, useDesktop, type Point, type WindowId } from './DesktopContext';

export interface HiddenMark {
  /** Command the mark runs in the terminal window. */
  command: string;
  label: string;
  glyph: 'spider' | 'key';
}

interface Props {
  id: WindowId;
  title: string;
  /** The window's own heading, or false when the content carries the page heading (the résumé window). */
  heading?: boolean;
  as?: 'section' | 'header';
  className?: string;
  bodyClassName?: string;
  mark?: HiddenMark;
  children: React.ReactNode;
}

const glyphs: Record<HiddenMark['glyph'], React.ReactNode> = {
  spider: <path d="M8 6.5a1.6 1.6 0 1 0 0 .01M8 8.5c-1.4 0-2 1-2 2.2S6.8 13 8 13s2-.9 2-2.3-.6-2.2-2-2.2M6.3 9 3 7.5M6 10.5H2.5M6.3 12 3.5 14M9.7 9 13 7.5M10 10.5h3.5M9.7 12l2.8 2M8 1v4" />,
  key: <><circle cx="5" cy="8" r="2.5" /><path d="M7.5 8H14M12 8v2.5M10 8v1.8" /></>,
};

/** Keeps at least this much of a dragged window's tab on the desk so it can always be grabbed back. */
const KEEP_VISIBLE = 96;

/**
 * A BeOS-style window: yellow tab, bevelled frame, close box (close = minimize into the Deskbar),
 * zoom box (fill the desk in place), and a resize grip that may hide a mark.
 */
export default function BeWindow({
  id, title, heading = true, as: Tag = 'section', className = '', bodyClassName = '', mark, children,
}: Props) {
  const desktop = useDesktop();
  const minimized = desktop.minimized.has(id);
  const maximized = desktop.maximized.has(id);
  const active = desktop.front === id;
  const z = desktop.order.indexOf(id) + 1;
  const position = desktop.positions[id];
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; start: Point; bounds: { width: number; height: number } } | null>(null);
  const windowRef = useRef<HTMLElement>(null);
  const titleId = `${id}-title`;

  // Dragging is a desktop nicety: only with a fine pointer on the free-form desk, never when maximized.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    desktop.focus(id);
    const element = windowRef.current;
    if (!element || maximized || event.button !== 0 || !isDeskLayout() || !window.matchMedia('(pointer: fine)').matches) return;
    if ((event.target as Element).closest('button, a')) return;
    const parent = element.offsetParent as HTMLElement | null;
    drag.current = {
      x: event.clientX, y: event.clientY,
      start: { x: element.offsetLeft, y: element.offsetTop },
      bounds: { width: parent?.clientWidth ?? window.innerWidth, height: parent?.clientHeight ?? window.innerHeight },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    document.documentElement.classList.add('be-dragging');
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { x, y, start, bounds } = drag.current;
    const width = windowRef.current?.offsetWidth ?? 0;
    desktop.place(id, {
      x: Math.round(Math.min(Math.max(start.x + event.clientX - x, KEEP_VISIBLE - width), bounds.width - KEEP_VISIBLE)),
      y: Math.round(Math.min(Math.max(start.y + event.clientY - y, 0), bounds.height - KEEP_VISIBLE)),
    });
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    document.documentElement.classList.remove('be-dragging');
  };

  const Title = heading ? 'h2' : 'span';
  const style = {
    zIndex: z,
    ...(position && { '--x': `${position.x}px`, '--y': `${position.y}px` }),
  } as React.CSSProperties;

  return (
    <Tag
      ref={windowRef as React.Ref<HTMLElement & HTMLDivElement>}
      id={id}
      aria-labelledby={heading ? titleId : undefined}
      data-window={id}
      className={[
        'be-win', className, active && 'is-active', minimized && 'is-minimized',
        desktop.exiting.has(id) && 'is-exiting', desktop.opening.has(id) && 'is-opening', maximized && 'is-maximized',
        position && 'is-placed', dragging && 'is-dragging',
      ].filter(Boolean).join(' ')}
      style={style}
      onPointerDownCapture={() => desktop.focus(id)}
    >
      <div
        className="be-tab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => { if (!(event.target as Element).closest('button')) desktop.minimize(id); }}
      >
        <button type="button" className="be-box be-box-close" aria-label={`Minimize ${title}`} onClick={() => desktop.minimize(id)} />
        <Title id={titleId} className="be-tab-title">{title}</Title>
      </div>
      <div className="be-controls">
        <button
          type="button"
          className="be-box be-box-zoom"
          aria-pressed={maximized}
          aria-label={maximized ? `Restore ${title}` : `Maximize ${title}`}
          onClick={() => desktop.toggleMaximized(id)}
        />
      </div>
      <div id={`${id}-body`} className={`be-body ${bodyClassName}`}>
        {children}
      </div>
      {mark && (
        <button
          type="button"
          className="be-grip"
          aria-label={mark.label}
          title={mark.label}
          onClick={(event) => desktop.run(mark.command, event.currentTarget)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="be-grip-lines"><path d="M15 6 6 15M15 10l-5 5M15 14l-1 1" /></svg>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="be-grip-mark">{glyphs[mark.glyph]}</svg>
        </button>
      )}
    </Tag>
  );
}
