'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BANNER_LINES,
  WELCOME_HINT,
} from '@ahmed-moghazy/shared';
import { useBannerAnimation } from '../hooks/useBannerAnimation';

interface Props {
  showMenu: boolean;
  menuItems: Array<{ label: string; value: string }>;
  onMenuSelect: (command: string) => void;
  animationTrigger?: number;
}

export default function WelcomeScreen({
  showMenu,
  menuItems,
  onMenuSelect,
  animationTrigger = 0,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { visibleLineCount, subtitleText, isAnimating, skip } =
    useBannerAnimation(animationTrigger);

  useEffect(() => {
    if (!isAnimating) return;
    const handleSkip = () => skip();
    window.addEventListener('keydown', handleSkip, { once: true });
    return () => window.removeEventListener('keydown', handleSkip);
  }, [isAnimating, skip]);

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
          overflowX: 'auto',
        }}
      >
        {BANNER_LINES.slice(0, visibleLineCount).join('\n')}
      </pre>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', minHeight: '1.6em' }}>
        {subtitleText}
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
