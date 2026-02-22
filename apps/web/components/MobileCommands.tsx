'use client';

import { commandRegistry } from '@ahmed-moghazy/shared';

interface Props {
  onCommand: (cmd: string) => void;
}

export default function MobileCommands({ onCommand }: Props) {
  const visibleCommands = commandRegistry.filter(
    (c) => !['clear', 'welcome', 'whoami', 'theme'].includes(c.name),
  );

  return (
    <div
      className="mobile-commands"
      style={{
        display: 'none',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '12px',
        borderTop: '1px solid var(--dimmed)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      {visibleCommands.map((cmd) => (
        <button
          key={cmd.name}
          onClick={() => onCommand(cmd.name)}
          style={{
            background: 'transparent',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            padding: '6px 12px',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {cmd.name}
        </button>
      ))}
    </div>
  );
}
