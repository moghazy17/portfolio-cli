'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Theme } from '@ahmed-moghazy/shared';
import { markGuiSeen, setViewCookie } from '../../lib/view-cookie';
import { useDeskShell, type DeskEntry } from '../../hooks/useDeskShell';
import AssistantAnswer from '../AssistantAnswer';
import CommandLine from '../CommandLine';
import OutputRenderer from '../OutputRenderer';
import BeWindow from './BeWindow';
import { useDesktop } from './DesktopContext';

/** Terminal colours tuned for the window's dark body; every text colour clears 4.5:1 on the background. */
const deskTheme: Theme = {
  name: 'be',
  primary: '#6cb6ff',
  secondary: '#4c8fd6',
  accent: '#7bd88f',
  background: '#1f252a',
  foreground: '#dfe5ea',
  dimmed: '#9aa5b0',
  error: '#ff8a80',
  success: '#7bd88f',
};

const themeVars = {
  '--bg': deskTheme.background, '--fg': deskTheme.foreground, '--primary': deskTheme.primary, '--secondary': deskTheme.secondary,
  '--accent': deskTheme.accent, '--dimmed': deskTheme.dimmed, '--error': deskTheme.error, '--success': deskTheme.success,
} as React.CSSProperties;

const chips: Array<{ label: string; command: string; icon: string }> = [
  { label: 'projects', command: 'projects', icon: '/desk/projects.webp' },
  { label: 'skills', command: 'skills', icon: '/desk/skills.webp' },
  { label: 'experience', command: 'experience', icon: '/desk/experience.webp' },
  { label: 'resume', command: 'resume', icon: '/desk/resume.webp' },
];

const ASK = 'What did he build with LLMs at his current job?';

export default function DeskTerminal({ initial }: { initial: DeskEntry[] }) {
  const router = useRouter();
  const desktop = useDesktop();
  const shell = useDeskShell(initial);
  const logRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState(initial[0]?.prompt ?? 'visitor@portfolio:~$');
  const [offscreen, setOffscreen] = useState(false);

  // Keep the terminal one click away: its tab docks bottom-left once the window scrolls out of view.
  useEffect(() => {
    const element = document.getElementById('terminal');
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { registerTerminal } = desktop;
  const { run } = shell;
  useEffect(() => registerTerminal((command) => { void run(command); }), [registerTerminal, run]);
  useEffect(() => setPrompt(shell.prompt()), [shell, shell.entries]);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && shell.entries.length > initial.length) log.scrollTop = log.scrollHeight;
  }, [shell.entries, initial.length]);

  const openFullTerminal = () => {
    setViewCookie('terminal');
    markGuiSeen();
    router.push('/');
  };

  return (
    <>
    {offscreen && (
      <button type="button" className="be-docked-tab" onClick={(event) => desktop.open('terminal', event.currentTarget)}>
        <img src="/desk/terminal.webp" alt="" width={22} height={22} />
        Terminal
      </button>
    )}
    <BeWindow
      id="terminal"
      title="Terminal"
      className="be-terminal"
      bodyClassName="be-term-body"
      onZoom={openFullTerminal}
      zoomLabel="Open the full-screen terminal"
    >
      <div className="be-term" style={themeVars}>
        <div ref={logRef} className="be-term-log" role="log" aria-label="Terminal window output" aria-live="polite">
          {shell.entries.map((entry) => (
            <div key={entry.id} className="be-term-entry">
              <div>
                <span className="be-term-prompt">{entry.prompt}</span> <span>{entry.input}</span>
              </div>
              {entry.assistant
                ? <AssistantAnswer state={entry.assistant} theme={deskTheme} />
                : <OutputRenderer output={entry.output} theme={deskTheme} />}
              {entry.handoff && (
                <a className="be-term-handoff" href={`/?cmd=${encodeURIComponent(entry.handoff)}`}>
                  This one runs in the full terminal →
                </a>
              )}
            </div>
          ))}
          <CommandLine
            onPrefillApplied={() => undefined}
            onSubmit={(input) => { void shell.run(input); }}
            complete={shell.complete}
            historyUp={shell.historyUp}
            historyDown={shell.historyDown}
            resetHistoryCursor={shell.resetHistoryCursor}
            onListCandidates={shell.listCandidates}
            onAbandon={() => undefined}
            cancel={shell.cancel}
            clearScreen={shell.clearScreen}
            prompt={prompt}
            running={shell.running}
            sequencePlaying={false}
            tourText={null}
            tourActive={false}
            onTourInput={() => undefined}
            autoFocus={false}
          />
        </div>
        <ul className="be-chips" aria-label="Quick commands">
          {chips.map((chip) => (
            <li key={chip.command}>
              <button type="button" className="be-chip" disabled={shell.running} onClick={() => { void shell.run(chip.command); }}>
                <img src={chip.icon} alt="" width={20} height={20} />
                {chip.label}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="be-chip be-chip-ask" disabled={shell.running} onClick={() => { void shell.run(ASK); }}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M10 1.5 12 8l6.5 2-6.5 2-2 6.5L8 12l-6.5-2L8 8z" fill="#b48cff" />
              </svg>
              ask AI
            </button>
          </li>
        </ul>
      </div>
    </BeWindow>
    </>
  );
}
