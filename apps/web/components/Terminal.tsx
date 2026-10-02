'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getMenuItems } from '@ahmed-moghazy/shared';
import AssistantAnswer from './AssistantAnswer';
import CommandLine from './CommandLine';
import OutputRenderer from './OutputRenderer';
import SequencePlayer from './SequencePlayer';
import WelcomeScreen from './WelcomeScreen';

import ChatRenderer from './ChatRenderer';
import { useTerminal } from '../hooks/useTerminal';
import { useIdle } from '../hooks/useIdle';
import CrtFilter from './CrtFilter';

const Screensaver = dynamic(() => import('./Screensaver'), { ssr: false });

const menuItems = getMenuItems();

export default function Terminal() {
  const {
    history, showWelcome, theme, scrollRef, handleCommand, mode, exitChat, conversationRef,
    prompt, running, skip, sequencePlaying, finishSequence,
    prefill, onPrefillApplied,
    complete, cancel, clearScreen, onListCandidates, onAbandon,
    historyUp, historyDown, resetHistoryCursor,
    booting, bootSteps, skipBoot, reducedMotion,
  } = useTerminal();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const { idle, reset } = useIdle(60_000, visible && !reducedMotion && !running && !sequencePlaying && !booting);
  useEffect(() => { if (idle) document.querySelector<HTMLInputElement>('.terminal-container input')?.focus(); }, [idle]);
  useEffect(() => {
    if (!idle) return;
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
      }
      reset();
      const input = document.querySelector<HTMLInputElement>('.terminal-container input');
      input?.focus();
      if (!(event instanceof KeyboardEvent)) requestAnimationFrame(() => input?.focus());
    };
    for (const name of ['keydown', 'pointermove', 'pointerdown', 'wheel', 'scroll', 'touchstart']) window.addEventListener(name, dismiss, true);
    return () => { for (const name of ['keydown', 'pointermove', 'pointerdown', 'wheel', 'scroll', 'touchstart']) window.removeEventListener(name, dismiss, true); };
  }, [idle, reset]);

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
          style={{
            marginLeft: 'auto',
            color: 'var(--dimmed)',
            fontSize: '12px',
          }}
        >
          {prompt}
        </span>
      </div>

      {/* Scrollable output area */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Terminal output"
        aria-live="polite"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          background: 'var(--bg)',
          fontFamily: 'var(--font-mono)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {booting && <div data-testid="boot">
          <SequencePlayer steps={bootSteps} final={[]} theme={theme} skip={skip} onDone={skipBoot} />
          <div style={{ color: 'var(--dimmed)' }}>press any key to skip</div>
        </div>}
        {showWelcome && !booting && (
          <WelcomeScreen
            showMenu={false}
            menuItems={menuItems}
            onMenuSelect={handleCommand}
          />
        )}

        {history.map((entry, i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
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

        {mode === 'chat' ? (
          <ChatRenderer onExit={exitChat} conversationRef={conversationRef} theme={theme} />
        ) : (
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
          />
        )}
      </div>

      {/* Always-visible menu bar */}
      <div
        className="menu-bar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '10px 16px',
          borderTop: '1px solid var(--dimmed)',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '0 0 8px 8px',
        }}
      >
        {menuItems.map((item) => (
          <button
            key={item.value}
            className="menu-btn"
            onClick={(e) => { e.stopPropagation(); handleCommand(item.value); }}
            style={{
              background: 'transparent',
              border: '1px solid var(--primary)',
              color: 'var(--primary)',
              padding: '5px 12px',
              borderRadius: '4px',
              fontFamily: 'inherit',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--primary)';
            }}
          >
            {item.value}
          </button>
        ))}
      </div>

      {idle && <Screensaver color={theme.primary} />}

    </div>
  );
}
