'use client';

import { useRef, useState } from 'react';
import { useDesktop, type WindowId } from './DesktopContext';

export interface HiddenMark {
  /** Command the mark runs in the terminal window. */
  command: string;
  label: string;
  glyph: 'spider' | 'ball' | 'reel' | 'key';
}

interface Props {
  id: WindowId;
  title: string;
  /** The window's own heading, or false when the content carries the page heading (the résumé window). */
  heading?: boolean;
  as?: 'section' | 'header';
  className?: string;
  bodyClassName?: string;
  /** Rendered by the zoom box; the terminal uses it to open the full-screen terminal. */
  onZoom?: () => void;
  zoomLabel?: string;
  mark?: HiddenMark;
  children: React.ReactNode;
}

const glyphs: Record<HiddenMark['glyph'], React.ReactNode> = {
  spider: <path d="M8 6.5a1.6 1.6 0 1 0 0 .01M8 8.5c-1.4 0-2 1-2 2.2S6.8 13 8 13s2-.9 2-2.3-.6-2.2-2-2.2M6.3 9 3 7.5M6 10.5H2.5M6.3 12 3.5 14M9.7 9 13 7.5M10 10.5h3.5M9.7 12l2.8 2M8 1v4" />,
  ball: <><circle cx="8" cy="8" r="5.5" /><path d="m8 5.2 2.4 1.7-.9 2.8h-3l-.9-2.8zM8 5.2V2.5M10.4 6.9l2.6-.8M9.5 9.7l1.6 2.3M6.5 9.7l-1.6 2.3M5.6 6.9 3 6.1" /></>,
  reel: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="5.2" r="1" /><circle cx="8" cy="10.8" r="1" /><circle cx="5.2" cy="8" r="1" /><circle cx="10.8" cy="8" r="1" /></>,
  key: <><circle cx="5" cy="8" r="2.5" /><path d="M7.5 8H14M12 8v2.5M10 8v1.8" /></>,
};

/** A BeOS-style window: yellow tab, bevelled frame, collapse and zoom boxes, and a resize grip. */
export default function BeWindow({
  id, title, heading = true, as: Tag = 'section', className = '', bodyClassName = '', onZoom, zoomLabel, mark, children,
}: Props) {
  const desktop = useDesktop();
  const collapsed = desktop.collapsed.has(id);
  const active = desktop.front === id;
  const z = desktop.order.indexOf(id) + 1;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);
  const drag = useRef<{ x: number; y: number; start: { x: number; y: number } } | null>(null);
  const titleId = `${id}-title`;

  // Dragging is a desktop nicety: only with a fine pointer and the free-form layout.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    desktop.focus(id);
    if (event.button !== 0 || !window.matchMedia('(pointer: fine) and (min-width: 1100px)').matches) return;
    if ((event.target as Element).closest('button, a')) return;
    drag.current = { x: event.clientX, y: event.clientY, start: offset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { x, y, start } = drag.current;
    setOffset({ x: start.x + event.clientX - x, y: start.y + event.clientY - y });
  };
  const onPointerUp = () => { drag.current = null; };

  const Title = heading ? 'h2' : 'span';

  return (
    <Tag
      id={id}
      aria-labelledby={heading ? titleId : undefined}
      className={`be-win ${active ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''} ${zoomed ? 'is-zoomed' : ''} ${className}`}
      style={{ zIndex: z, translate: offset.x || offset.y ? `${offset.x}px ${offset.y}px` : undefined }}
      onPointerDownCapture={() => desktop.focus(id)}
    >
      <div
        className="be-tab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => desktop.toggle(id)}
      >
        <Title id={titleId} className="be-tab-title">{title}</Title>
      </div>
      <div className="be-controls">
        <button
          type="button"
          className="be-box be-box-collapse"
          aria-expanded={!collapsed}
          aria-controls={`${id}-body`}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={() => desktop.toggle(id)}
        />
        {/* No close box: closing would hide portfolio content; collapse covers tidying up. */}
        {onZoom ? (
          <button type="button" className="be-box be-box-zoom" aria-label={zoomLabel ?? `Zoom ${title}`} onClick={onZoom} />
        ) : (
          <button
            type="button"
            className="be-box be-box-zoom"
            aria-pressed={zoomed}
            aria-label={`Show all of ${title}`}
            onClick={() => { setZoomed((value) => !value); if (collapsed) desktop.toggle(id); }}
          />
        )}
      </div>
      <div id={`${id}-body`} className={`be-body ${bodyClassName}`} hidden={collapsed}>
        {children}
      </div>
      {mark && !collapsed && (
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
