import { useState, useRef, useEffect, useCallback } from 'react';
import { createShell, themes } from '@ahmed-moghazy/shared';
import type { Completion, HistoryEntry } from '@ahmed-moghazy/shared';
import { useHistory } from './useHistory';
import { useThemeApplier } from './useThemeApplier';

export type TerminalMode = 'command' | 'chat';

export function useTerminal() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [mode, setMode] = useState<TerminalMode>('command');
  const [prompt, setPrompt] = useState('visitor@portfolio:~$');
  const [running, setRunning] = useState(false);
  const shellRef = useRef<ReturnType<typeof createShell> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { push, up, down, reset } = useHistory();
  const { theme, setTheme } = useThemeApplier();

  const getShell = useCallback(() => {
    if (!shellRef.current) {
      shellRef.current = createShell({ surface: 'web', origin: window.location.origin });
    }
    return shellRef.current;
  }, []);

  const currentPrompt = useCallback(() => {
    const { user, host, cwd } = getShell().prompt();
    return `${user}@${host}:${cwd}$`;
  }, [getShell]);

  useEffect(() => {
    setPrompt(currentPrompt());
  }, [currentPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  const handleCommand = useCallback(async (input: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const submittedPrompt = currentPrompt();
    setRunning(true);
    setShowWelcome(false);
    const result = await getShell().run(input, { signal: controller.signal });
    if (controllerRef.current === controller) {
      controllerRef.current = null;
      setRunning(false);
    }
    if (controller.signal.aborted || result.cancelled) return;

    push(input);
    setPrompt(currentPrompt());
    if (result.welcome) {
      setShowWelcome(true);
      setHistory([]);
      return;
    }
    if (result.clear) {
      setHistory([]);
      return;
    }
    if (result.theme && themes[result.theme]) setTheme(themes[result.theme]);
    if (result.openUrl) window.open(result.openUrl, '_blank', 'noopener,noreferrer');
    setHistory((previous) => [...previous, { input, prompt: submittedPrompt, output: result.output }]);
    if (result.mode === 'chat') setMode('chat');
  }, [currentPrompt, getShell, push, setTheme]);

  const complete = useCallback((input: string, caret: number): Completion => {
    return getShell().complete(input, caret);
  }, [getShell]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }, []);

  const clearScreen = useCallback(() => {
    setHistory([]);
    setShowWelcome(false);
  }, []);

  const onListCandidates = useCallback((input: string, candidates: string[]) => {
    setHistory((previous) => [...previous, {
      input,
      prompt: currentPrompt(),
      output: [{ type: 'lines', lines: candidates.map((text) => ({ text })) }],
    }]);
  }, [currentPrompt]);

  const onAbandon = useCallback((input: string) => {
    setShowWelcome(false);
    setHistory((previous) => [...previous, { input: `${input}^C`, prompt: currentPrompt(), output: [] }]);
  }, [currentPrompt]);

  const exitChat = useCallback(() => {
    setMode('command');
  }, []);

  return {
    history, showWelcome, theme, scrollRef, handleCommand, mode, exitChat,
    prompt, running, complete, cancel, clearScreen, onListCandidates, onAbandon,
    historyUp: up, historyDown: down, resetHistoryCursor: reset,
  };
}
