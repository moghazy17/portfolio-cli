import type { Theme } from './types.js';

export const themes: Record<string, Theme> = {
  matrix: {
    name: 'matrix',
    primary: '#2c84db',
    secondary: '#1a5fa0',
    accent: '#2c84db',
    background: '#0d1117',
    foreground: '#c9d1d9',
    dimmed: '#6e7681',
    error: '#ff6b6b',
    success: '#2c84db',
  },
  dracula: {
    name: 'dracula',
    primary: '#bd93f9',
    secondary: '#ff79c6',
    accent: '#50fa7b',
    background: '#282a36',
    foreground: '#f8f8f2',
    dimmed: '#6272a4',
    error: '#ff5555',
    success: '#50fa7b',
  },
  nord: {
    name: 'nord',
    primary: '#88c0d0',
    secondary: '#81a1c1',
    accent: '#a3be8c',
    background: '#2e3440',
    foreground: '#eceff4',
    dimmed: '#4c566a',
    error: '#bf616a',
    success: '#a3be8c',
  },
};

export const DEFAULT_THEME = 'matrix';
