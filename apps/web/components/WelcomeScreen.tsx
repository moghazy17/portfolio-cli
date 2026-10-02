'use client';

import { useState, useEffect } from 'react';
import {
  ASCII_BANNER,
  WELCOME_SUBTITLE,
  WELCOME_HINT,
  WELCOME_SHORTCUT_HINT,
} from '@ahmed-moghazy/shared';

export default function WelcomeScreen() {
  const [finePointer, setFinePointer] = useState(false);
  const [glitch, setGlitch] = useState(true);

  useEffect(() => setFinePointer(window.matchMedia('(pointer: fine)').matches), []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setGlitch(false); return; }
    const settle = () => setGlitch(false);
    window.addEventListener('keydown', settle, { once: true });
    window.addEventListener('pointerdown', settle, { once: true });
    window.addEventListener('touchstart', settle, { once: true });
    const timer = setTimeout(settle, 620);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', settle);
      window.removeEventListener('pointerdown', settle);
      window.removeEventListener('touchstart', settle);
    };
  }, []);

  return (
    <div style={{ marginBottom: '24px' }}>
      <pre
        className={`ascii-banner${glitch ? ' glitch-reveal' : ''}`}
        data-text={ASCII_BANNER}
        style={{
          color: 'var(--primary)',
          fontSize: '10px',
          lineHeight: '1.1',
          overflowX: 'auto',
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
        {WELCOME_HINT}{finePointer && ` ${WELCOME_SHORTCUT_HINT}`}
      </div>
    </div>
  );
}
