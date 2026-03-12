'use client';

import { getCompletions, getMenuItems } from '@ahmed-moghazy/shared';
import CommandLine from './CommandLine';
import OutputRenderer from './OutputRenderer';
import WelcomeScreen from './WelcomeScreen';

import ChatRenderer from './ChatRenderer';
import { useTerminal } from '../hooks/useTerminal';

const menuItems = getMenuItems();

export default function Terminal() {
  const { history, showWelcome, theme, commandHistoryList, scrollRef, handleCommand, mode, exitChat } =
    useTerminal();

  return (
    <div
      className="terminal-container"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
        padding: '16px',
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

        {mode === 'chat' ? (
          <ChatRenderer onExit={exitChat} />
        ) : (
          <CommandLine
            onSubmit={handleCommand}
            commandHistory={commandHistoryList}
            getCompletions={getCompletions}
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

    </div>
  );
}
