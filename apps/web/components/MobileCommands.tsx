'use client';

import { getMenuItems } from '@ahmed-moghazy/shared';

interface Props {
  onCommand: (cmd: string) => void;
}

export default function MobileCommands({ onCommand }: Props) {
  const menuItems = getMenuItems();

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
      {menuItems.map((item) => (
        <button
          key={item.value}
          onClick={() => onCommand(item.value)}
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
          {item.value}
        </button>
      ))}
    </div>
  );
}
