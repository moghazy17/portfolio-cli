'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { hasSeenGui } from '../lib/view-cookie';
import AssistantAnswer from './AssistantAnswer';
import CommandLine from './CommandLine';
import OutputRenderer from './OutputRenderer';
import SequencePlayer from './SequencePlayer';
import WelcomeScreen from './WelcomeScreen';

import { useTerminal, type TerminalEntry } from '../hooks/useTerminal';
import { useIdle } from '../hooks/useIdle';
import CrtFilter from './CrtFilter';
import { usePresence } from '../hooks/usePresence';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import CommandBar from './CommandBar';
import TourCard from './TourCard';

const Screensaver = dynamic(() => import('./Screensaver'), { ssr: false });

interface Props {
  /** Render inside a /gui window: no chrome, boot, screensaver, keyboard inset or page theme. */
  windowed?: boolean;
  initialHistory?: TerminalEntry[];
  /** Hands the window manager a way to run commands here (desktop icons, hidden marks). */
  registerRunner?: (run: (line: string) => void) => void;
  onFx?: (fx: 'web' | 'confetti') => void;
}

export default function Terminal({ windowed = false, initialHistory, registerRunner, onFx }: Props) {
  // The desktop's Deskbar already reports presence, and a window has no keyboard-inset layout.
  const presence = usePresence(!windowed);
  useKeyboardInset(!windowed);
  const {
    history, showWelcome, theme, scrollRef, handleCommand, submitSuggestion,
    prompt, running, skip, sequencePlaying, finishSequence, tourPlaying, tourSteps, tourIndex, tourBusy,
    tourText, tourFinished, tourFocusRequest, nextTour, backTour, stopTour,
    prefill, onPrefillApplied,
    complete, cancel, clearScreen, onListCandidates, onAbandon,
    historyUp, historyDown, resetHistoryCursor,
    booting, bootSteps, skipBoot, reducedMotion, screensaver,
  } = useTerminal({ windowed, initialHistory, onFx });
  useEffect(() => { registerRunner?.((line) => { void handleCommand(line); }); }, [registerRunner, handleCommand]);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const { idle, reset } = useIdle(60_000, !windowed && screensaver && visible && !reducedMotion && !running && !sequencePlaying && !tourPlaying && !booting);
  useEffect(() => { if (idle && window.matchMedia('(pointer: fine)').matches) document.querySelector<HTMLInputElement>('.terminal-container input')?.focus(); }, [idle]);
  useEffect(() => {
    if (!idle) return;
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
      }
      reset();
      const input = document.querySelector<HTMLInputElement>('.terminal-container input');
      if (window.matchMedia('(pointer: fine)').matches) {
        input?.focus();
        if (!(event instanceof KeyboardEvent)) requestAnimationFrame(() => input?.focus());
      }
    };
    for (const name of ['keydown', 'pointermove', 'pointerdown', 'wheel', 'scroll', 'touchstart']) window.addEventListener(name, dismiss, true);
    return () => { for (const name of ['keydown', 'pointermove', 'pointerdown', 'wheel', 'scroll', 'touchstart']) window.removeEventListener(name, dismiss, true); };
  }, [idle, reset]);
  // Prominent until either view has been used once; read after mount so the server markup matches.
  const [guiSeen, setGuiSeen] = useState(false);
  useEffect(() => setGuiSeen(hasSeenGui()), []);
  const barReady = !running && !sequencePlaying && !tourPlaying && !booting;

  const logContent = (
    <>
      {booting && <div data-testid="boot">
        <SequencePlayer steps={bootSteps} final={[]} theme={theme} skip={skip} onDone={skipBoot} />
        <div style={{ color: 'var(--dimmed)' }}>press any key to skip</div>
      </div>}
      {showWelcome && !booting && <WelcomeScreen />}

      {history.map((entry, i) => (
        <div key={i} data-tour-step={entry.tourStepIndex}
          data-tour={entry.tourSessionId !== undefined && entry.tourStepIndex !== undefined ? `${entry.tourSessionId}:${entry.tourStepIndex}` : undefined}
          style={{ marginBottom: '16px' }}>
          {entry.identity && (
            <div className="be-term-identity" data-testid="gui-identity">
              <strong>{entry.identity.name}</strong>
              <span>{entry.identity.label}</span>
              <span>{entry.identity.location}</span>
            </div>
          )}
          {entry.prompt && (
            <div>
              <span style={{ color: 'var(--accent)', userSelect: 'none' }}>
                {entry.prompt}{' '}
              </span>
              <span style={{ color: 'var(--fg)' }}>{entry.input}</span>
            </div>
          )}
          {entry.assistant ? (
            <AssistantAnswer state={entry.assistant} theme={theme} />
          ) : entry.sequence && !entry.sequenceDone && entry.sequenceId !== undefined ? (
            <SequencePlayer
              steps={entry.sequence}
              final={entry.output}
              theme={theme}
              skip={skip}
              onDone={() => finishSequence(entry.sequenceId!)}
            />
          ) : (
            <OutputRenderer output={entry.output} theme={theme} reveal={entry.reveal} />
          )}
        </div>
      ))}

      {tourPlaying && <TourCard
        steps={tourSteps}
        index={tourIndex}
        busy={tourBusy}
        focusRequest={tourFocusRequest}
        onBack={backTour}
        onNext={nextTour}
        onExit={() => stopTour(false, true)}
      />}
      {tourFinished && !tourPlaying && <div className="tour-finish" role="status">Your turn</div>}
      <div>
        <CommandLine
          prefill={prefill}
          onPrefillApplied={onPrefillApplied}
          onSubmit={handleCommand}
          complete={complete}
          historyUp={historyUp}
          historyDown={historyDown}
          resetHistoryCursor={resetHistoryCursor}
          onListCandidates={onListCandidates}
          onAbandon={onAbandon}
          cancel={cancel}
          clearScreen={clearScreen}
          prompt={prompt}
          running={running}
          sequencePlaying={sequencePlaying}
          tourText={tourText}
          tourActive={tourPlaying}
          onTourInput={() => stopTour()}
          autoFocus={!windowed}
        />
      </div>
    </>
  );

  if (windowed) {
    const vars = {
      '--bg': theme.background, '--fg': theme.foreground, '--primary': theme.primary, '--secondary': theme.secondary,
      '--accent': theme.accent, '--dimmed': theme.dimmed, '--error': theme.error, '--success': theme.success,
    } as React.CSSProperties;
    return (
      <div className="terminal-container be-term" style={vars}>
        <div ref={scrollRef} className="be-term-log" role="log" aria-label="Terminal output" aria-live="polite">
          {logContent}
        </div>
        <CommandBar variant="desk" ready={barReady} onSelect={submitSuggestion} />
      </div>
    );
  }

  return (
    <div
      className="terminal-container"
      data-effect={theme.effects?.crt ? 'crt' : undefined}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
        padding: '16px',
        paddingBottom: 'calc(16px + var(--keyboard-inset, 0px))',
        position: 'relative',
      }}
    >
      {theme.effects?.crt && <CrtFilter />}
      {/* Terminal window chrome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid var(--dimmed)',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#ff5f57',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#febc2e',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#28c840',
            display: 'inline-block',
          }}
        />
        <span
          className="chrome-prompt"
          style={{
            marginLeft: 'auto',
            color: 'var(--dimmed)',
            fontSize: '12px',
          }}
        >
          {prompt}
        </span>
        {presence && <span aria-label={`${presence.total} exploring now`} style={{ color: 'var(--dimmed)', fontSize: 12, whiteSpace: 'nowrap' }}>{presence.total} online</span>}
        <button
          type="button"
          data-testid="open-gui"
          className={`gui-button${guiSeen ? ' gui-button-seen' : ''}`}
          onClick={() => handleCommand('gui')}
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 18v3" />
          </svg>
          Regular view
        </button>
      </div>

      {/* Scrollable output area */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Terminal output"
        aria-live="polite"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '16px',
          background: 'var(--bg)',
          fontFamily: 'var(--font-mono)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {logContent}
      </div>

      <CommandBar ready={barReady} onSelect={submitSuggestion} />

      {idle && <Screensaver color={theme.primary} />}

    </div>
  );
}
