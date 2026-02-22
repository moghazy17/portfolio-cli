'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  executeCommand,
  getCompletions,
  getMenuItems,
  themes,
  DEFAULT_THEME,
} from '@ahmed-moghazy/shared';
import type { CommandOutput, CommandResult, Theme } from '@ahmed-moghazy/shared';
import CommandLine from './CommandLine';
import OutputRenderer from './OutputRenderer';
import WelcomeScreen from './WelcomeScreen';
import MobileCommands from './MobileCommands';

interface HistoryEntry {
  input: string;
  output: CommandOutput[];
}

export default function Terminal() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [theme, setTheme] = useState<Theme>(themes[DEFAULT_THEME]);
  const [commandHistoryList, setCommandHistoryList] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuItems = getMenuItems();

  // Auto-scroll on new output
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.background);
    root.style.setProperty('--fg', theme.foreground);
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--secondary', theme.secondary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--dimmed', theme.dimmed);
    root.style.setProperty('--error', theme.error);
    root.style.setProperty('--success', theme.success);
    document.body.style.backgroundColor = theme.background;
  }, [theme]);

  const handleCommand = useCallback(
    (input: string) => {
      const trimmed = input.trim().toLowerCase();

      // Handle welcome command — show banner again and clear history
      if (trimmed === 'welcome' || trimmed === 'home' || trimmed === 'banner') {
        setShowWelcome(true);
        setHistory([]);
        setCommandHistoryList((prev) => [...prev, input]);
        return;
      }

      // Hide the welcome banner once a real command runs
      setShowWelcome(false);

      const result: CommandResult = executeCommand(input);

      // Handle clear
      if (result.clear) {
        setHistory([]);
        return;
      }

      // Handle theme switching
      const parts = input.trim().split(/\s+/);
      if (parts[0]?.toLowerCase() === 'theme' && parts[1]) {
        const t = themes[parts[1].toLowerCase()];
        if (t) setTheme(t);
      }

      setHistory((prev) => [...prev, { input, output: result.output }]);
      setCommandHistoryList((prev) => [...prev, input]);
    },
    [],
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
        padding: '16px',
        height: '100vh',
      }}
    >
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
          ahmed@portfolio ~ $
        </span>
      </div>

      {/* Scrollable output area */}
      <div
        ref={scrollRef}
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
        {showWelcome && (
          <WelcomeScreen
            showMenu={false}
            menuItems={menuItems}
            onMenuSelect={handleCommand}
          />
        )}

        {history.map((entry, i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
            <div>
              <span style={{ color: 'var(--accent)', userSelect: 'none' }}>
                ${' '}
              </span>
              <span style={{ color: 'var(--fg)' }}>{entry.input}</span>
            </div>
            <OutputRenderer output={entry.output} theme={theme} />
          </div>
        ))}

        <CommandLine
          onSubmit={handleCommand}
          commandHistory={commandHistoryList}
          getCompletions={getCompletions}
        />
      </div>

      {/* Always-visible menu bar */}
      <div
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
            onClick={() => handleCommand(item.value)}
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

      {/* Mobile tappable commands (larger buttons, shown only on small screens) */}
      <MobileCommands onCommand={handleCommand} />
    </div>
  );
}
