'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markGuiSeen, setViewCookie } from '../../lib/view-cookie';
import { usePresence } from '../../hooks/usePresence';
import { useDesktop, type WindowId } from './DesktopContext';

export const deskLinks: Array<{ id: WindowId; label: string; icon: string }> = [
  { id: 'about', label: 'About', icon: '/desk/about.webp' },
  { id: 'projects', label: 'Projects', icon: '/desk/projects.webp' },
  { id: 'experience', label: 'Experience', icon: '/desk/experience.webp' },
  { id: 'films', label: 'Films', icon: '/desk/films.webp' },
  { id: 'guestbook', label: 'Guestbook', icon: '/desk/guestbook.webp' },
];

function localTime(timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date());
}

/** The BeOS Deskbar: site menu, the way back to the full terminal, the owner's local time, and who is here. */
export default function Deskbar({ host, place, timeZone }: { host: string; place: string; timeZone: string }) {
  const desktop = useDesktop();
  const router = useRouter();
  const presence = usePresence();
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
        {presence && <><span className="be-presence-dot" aria-hidden="true" />{presence.total}<span className="be-presence-word"> exploring</span></>}
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
        {deskLinks.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className={desktop.front === link.id ? 'is-current' : undefined}
              onClick={(event) => { event.preventDefault(); setMenuOpen(false); desktop.open(link.id, event.currentTarget); }}
            >
              <img src={link.icon} alt="" width={24} height={24} />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="be-deskbar-status">
        {time && <span>{place} {time}</span>}
        <span className="be-presence be-presence-panel" aria-hidden={!presence}>
          {presence && <><span className="be-presence-dot" aria-hidden="true" />{presence.total} exploring now</>}
        </span>
      </div>
    </nav>
  );
}
