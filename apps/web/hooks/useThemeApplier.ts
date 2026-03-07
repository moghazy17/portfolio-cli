import { useState, useEffect } from 'react';
import { themes, DEFAULT_THEME } from '@ahmed-moghazy/shared';
import type { Theme } from '@ahmed-moghazy/shared';

export function useThemeApplier() {
  const [theme, setTheme] = useState<Theme>(themes[DEFAULT_THEME]);

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

  return { theme, setTheme };
}
