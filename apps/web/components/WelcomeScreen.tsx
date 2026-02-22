'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ASCII_BANNER,
  WELCOME_SUBTITLE,
  WELCOME_HINT,
} from '@ahmed-moghazy/shared';

interface Props {
  showMenu: boolean;
  menuItems: Array<{ label: string; value: string }>;
  onMenuSelect: (command: string) => void;
}

export default function WelcomeScreen({
  showMenu,
  menuItems,
  onMenuSelect,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showMenu) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : menuItems.length - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i < menuItems.length - 1 ? i + 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onMenuSelect(menuItems[selectedIndex].value);
      }
    },
    [showMenu, selectedIndex, menuItems, onMenuSelect],
  );

  useEffect(() => {
    if (!showMenu) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMenu, handleKeyDown]);

  return (
    <div style={{ marginBottom: '24px' }}>
      <pre
        className="ascii-banner"
        style={{
          color: 'var(--primary)',
          fontSize: '10px',
          lineHeight: '1.1',
        }}
      >
        {ASCII_BANNER}
      </pre>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        {WELCOME_SUBTITLE}
      </div>
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--dimmed)',
          margin: '8px 0',
        }}
      />
      <div style={{ color: 'var(--dimmed)', marginBottom: '16px' }}>
        {WELCOME_HINT}
      </div>

      {showMenu && (
        <div>
          {menuItems.map((item, i) => (
            <div
              key={item.value}
              onClick={() => onMenuSelect(item.value)}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                backgroundColor:
                  i === selectedIndex ? 'var(--primary)' : 'transparent',
                color: i === selectedIndex ? 'var(--bg)' : 'var(--fg)',
                borderRadius: '2px',
                fontFamily: 'inherit',
                transition: 'background-color 0.1s',
              }}
            >
              {i === selectedIndex ? '> ' : '  '}
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
