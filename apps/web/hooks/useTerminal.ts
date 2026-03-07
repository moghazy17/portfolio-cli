import { useState, useRef, useEffect, useCallback } from 'react';
import { executeCommand, themes } from '@ahmed-moghazy/shared';
import type { HistoryEntry } from '@ahmed-moghazy/shared';
import { useThemeApplier } from './useThemeApplier';

export function useTerminal() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [commandHistoryList, setCommandHistoryList] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useThemeApplier();

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  const handleCommand = useCallback(
    async (input: string) => {
      const trimmed = input.trim().toLowerCase();

      if (trimmed === 'welcome' || trimmed === 'home' || trimmed === 'banner') {
        setShowWelcome(true);
        setHistory([]);
        setCommandHistoryList((prev) => [...prev, input]);
        return;
      }

      setShowWelcome(false);

      const result = await executeCommand(input);

      if (result.clear) {
        setHistory([]);
        return;
      }

      const parts = input.trim().split(/\s+/);
      if (parts[0]?.toLowerCase() === 'theme' && parts[1]) {
        const t = themes[parts[1].toLowerCase()];
        if (t) setTheme(t);
      }

      if (parts[0]?.toLowerCase() === 'open') {
        const linkOutput = result.output.find((o) => o.type === 'link');
        if (linkOutput && linkOutput.type === 'link') {
          window.open(linkOutput.url, '_blank', 'noopener,noreferrer');
        }
      }

      setHistory((prev) => [...prev, { input, output: result.output }]);
      setCommandHistoryList((prev) => [...prev, input]);
    },
    [setTheme],
  );

  return { history, showWelcome, theme, commandHistoryList, scrollRef, handleCommand };
}
