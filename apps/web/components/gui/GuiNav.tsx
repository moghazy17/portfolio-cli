'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { markGuiSeen, setViewCookie } from '../../lib/view-cookie';
import { MenuIcon, TerminalIcon } from './icons';

interface Props {
  name: string;
  links: Array<{ href: string; label: string }>;
}

const linkClass = 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:text-fg';

export default function GuiNav({ name, links }: Props) {
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);

  const backToTerminal = () => {
    setViewCookie('terminal');
    markGuiSeen();
    router.push('/');
  };

  return (
    <nav aria-label="Sections" className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-2 px-4 sm:px-6">
        <a href="#hero" className="min-w-0 flex-1 truncate py-2 font-semibold sm:flex-none sm:pr-4">{name}</a>

        <ul className="hidden items-center sm:flex">
          {links.map((link) => (
            <li key={link.href}><a href={link.href} className={linkClass}>{link.label}</a></li>
          ))}
        </ul>

        <details ref={menuRef} className="relative sm:hidden">
          <summary
            aria-label="Sections menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border"
          >
            <MenuIcon />
          </summary>
          <ul className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`${linkClass} w-full`}
                  onClick={() => menuRef.current?.removeAttribute('open')}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </details>

        <button
          type="button"
          data-testid="back-to-terminal"
          onClick={backToTerminal}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent px-3 text-sm font-medium text-accent hover:bg-accent hover:text-on-accent sm:ml-auto"
        >
          <TerminalIcon className="h-4 w-4" />
          Terminal
        </button>
      </div>
    </nav>
  );
}
