'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markGuiSeen, setViewCookie } from '../../lib/view-cookie';
import { usePresence } from '../../hooks/usePresence';
import { useClickSound, useSoundSetting } from '../../hooks/useClickSound';
import { deskWindows, isDeskLayout, useDesktop } from './DesktopContext';

function localTime(timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date());
}

function RollingCount({ count }: { count: number }) {
  const last = useRef(count);
  const [previous, setPrevious] = useState<number | null>(null);
  useEffect(() => {
    if (last.current === count) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { last.current = count; setPrevious(null); return; }
    setPrevious(last.current);
    last.current = count;
    const timer = window.setTimeout(() => setPrevious(null), 250);
    return () => window.clearTimeout(timer);
  }, [count]);
  return <><span className={`be-count${previous !== null ? ' is-rolling' : ''}`} aria-hidden="true">
    {previous !== null && <span className="be-count-old">{previous}</span>}
    <span className="be-count-new">{count}</span>
  </span><span className="sr-only">{count}</span></>;
}

/** The BeOS Deskbar: site menu, the way back to the full terminal, the owner's local time, and who is here. */
export default function Deskbar({ host, place, timeZone }: { host: string; place: string; timeZone: string }) {
  const desktop = useDesktop();
  const router = useRouter();
  const presence = usePresence();
  useClickSound();
  const sound = useSoundSetting();
  const [time, setTime] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setTime(localTime(timeZone));
    const timer = window.setInterval(() => setTime(localTime(timeZone)), 15_000);
    return () => window.clearInterval(timer);
  }, [timeZone]);

  const backToTerminal = () => {
    setViewCookie('terminal');
    markGuiSeen();
    router.push('/');
  };

  return (
    <nav className={`be-deskbar ${menuOpen ? 'is-open' : ''}`} aria-label="Sections">
      <div className="be-deskbar-tab"><span>{host}</span></div>
      <span className="be-presence be-presence-bar" role="status">
        {presence && <><span className="be-presence-dot" aria-hidden="true" /><RollingCount count={presence.total} /><span className="be-presence-word"> exploring</span></>}
      </span>
      <div className="be-deskbar-head">
        <button
          type="button"
          data-testid="back-to-terminal"
          className="be-deskbar-terminal"
          onClick={backToTerminal}
        >
          <img src="/desk/terminal.webp" alt="" width={24} height={24} />
          <span className="be-deskbar-terminal-label">Full terminal</span>
        </button>
        <button
          type="button"
          className="be-deskbar-menu"
          aria-expanded={menuOpen}
          aria-controls="be-deskbar-links"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">Sections menu</span>
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
        </button>
      </div>
      <ul id="be-deskbar-links" className="be-deskbar-links">
        {deskWindows.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              data-window-entry={entry.id}
              className={`${desktop.front === entry.id && !desktop.minimized.has(entry.id) ? 'is-current' : ''}${desktop.minimized.has(entry.id) ? ' is-minimized' : ''}`}
              aria-pressed={desktop.front === entry.id && !desktop.minimized.has(entry.id)}
              onClick={(event) => {
                setMenuOpen(false);
                if (isDeskLayout()) desktop.activate(entry.id, event.currentTarget);
                else desktop.open(entry.id, event.currentTarget);
              }}
            >
              <img src={entry.icon} alt="" width={24} height={24} />
              <span>{entry.title}<span className="sr-only">{desktop.minimized.has(entry.id) ? ' (minimized)' : ''}</span></span>
            </button>
          </li>
        ))}
      </ul>
      <div className="be-deskbar-status">
        <div className="be-deskbar-clock">
          {time && <span>{place} <span className="sr-only">{time}</span><span className="be-clock-digits" aria-hidden="true"><span>{time.slice(0, 2)}</span><span className="be-clock-colon">:</span><span>{time.slice(3)}</span></span></span>}
          <button type="button" className="be-sound" aria-pressed={!sound.muted} onClick={sound.toggle}>
            <span className="sr-only">Click sounds</span>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <path className="be-sound-cone" d="M3 7.5h3l4-3.5v12l-4-3.5H3z" />
              {sound.muted
                ? <path className="be-sound-wave" d="m13 7.5 5 5m0-5-5 5" />
                : <path className="be-sound-wave" d="M13 7a4.2 4.2 0 0 1 0 6M15.5 4.8a7.4 7.4 0 0 1 0 10.4" />}
            </svg>
          </button>
        </div>
        <span className="be-presence be-presence-panel" aria-hidden="true">
          {presence && <><span className="be-presence-dot" aria-hidden="true" /><RollingCount count={presence.total} /> exploring now</>}
        </span>
      </div>
    </nav>
  );
}
