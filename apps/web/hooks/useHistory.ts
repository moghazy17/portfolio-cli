import { useCallback, useEffect, useRef } from 'react';
import { history } from '@ahmed-moghazy/shared';
import type { HistoryState } from '@ahmed-moghazy/shared';

const storageKey = 'portfolio.history.v1';

export function useHistory() {
  const state = useRef<HistoryState>(history.empty());

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const entries: unknown = JSON.parse(stored);
      if (Array.isArray(entries) && entries.every((entry) => typeof entry === 'string')) {
        state.current = { ...history.empty(), entries: entries.slice(-history.HISTORY_LIMIT) };
      }
    } catch {
      // Browsing still works in memory when storage is unavailable.
    }
  }, []);

  const push = useCallback((line: string) => {
    state.current = history.push(state.current, line);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state.current.entries));
    } catch {
      // Keep the in-memory history.
    }
  }, []);

  const up = useCallback((current: string) => {
    state.current = history.up(state.current, current);
    const { entries, cursor } = state.current;
    return cursor === null ? current : entries[cursor];
  }, []);

  const down = useCallback(() => {
    state.current = history.down(state.current);
    const { entries, cursor, draft } = state.current;
    return cursor === null ? draft : entries[cursor];
  }, []);

  const reset = useCallback(() => {
    state.current = { ...state.current, cursor: null, draft: '' };
  }, []);

  return { push, up, down, reset };
}
