import { useState, useRef, useEffect, useCallback } from 'react';
import { createShell, themes, welcomeCommand } from '@ahmed-moghazy/shared';
import type { Completion, HistoryEntry, SequenceStep } from '@ahmed-moghazy/shared';
import { useHistory } from './useHistory';
import { useThemeApplier } from './useThemeApplier';

export type TerminalMode = 'command' | 'chat';

interface TerminalEntry extends HistoryEntry {
  sequence?: SequenceStep[];
  sequenceDone?: boolean;
  sequenceId?: number;
}

export function useTerminal() {
  const [history, setHistory] = useState<TerminalEntry[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [mode, setMode] = useState<TerminalMode>('command');
  const [prompt, setPrompt] = useState('visitor@portfolio:~$');
  const [running, setRunning] = useState(false);
  const [skip, setSkip] = useState(0);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const activeSequenceRef = useRef<number | null>(null);
  const sequenceIdRef = useRef(0);
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

  const skipSequence = useCallback(() => {
    if (activeSequenceRef.current === null) return false;
    activeSequenceRef.current = null;
    setSequencePlaying(false);
    setSkip((previous) => previous + 1);
    return true;
  }, []);

  const finishSequence = useCallback((id: number) => {
    if (activeSequenceRef.current === id) {
      activeSequenceRef.current = null;
      setSequencePlaying(false);
    }
    setHistory((previous) => previous.map((entry) =>
      entry.sequenceId === id ? { ...entry, sequenceDone: true } : entry));
  }, []);

  const handleCommand = useCallback(async (input: string) => {
    skipSequence();
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
    // A cancelled chain may already have changed directory.
    setPrompt(currentPrompt());
    if (controller.signal.aborted || result.cancelled) return;

    push(input);
    // The shell drops output printed before a clear or welcome, so whatever remains ran
    // after the reset. On the web the welcome banner is the WelcomeScreen, not log output.
    let output = result.output;
    if (result.welcome) {
      setShowWelcome(true);
      setHistory([]);
      output = output.slice(welcomeCommand().output.length);
    } else if (result.clear) {
      setHistory([]);
    }
    if (result.theme && themes[result.theme]) setTheme(themes[result.theme]);
    if (result.openUrl) window.open(result.openUrl, '_blank', 'noopener,noreferrer');
    if (result.download) {
      let link: HTMLAnchorElement | null = null;
      try {
        link = document.createElement('a');
        link.href = result.download.url;
        link.download = result.download.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch {
        link?.remove();
        window.open(result.download.url, '_blank', 'noopener,noreferrer');
      }
    }
    if ((result.welcome || result.clear) && !output.length && !result.sequence) {
      if (result.mode === 'chat') setMode('chat');
      return;
    }
    const sequenceId = result.sequence ? ++sequenceIdRef.current : undefined;
    if (sequenceId !== undefined) {
      activeSequenceRef.current = sequenceId;
      setSequencePlaying(true);
    }
    setHistory((previous) => [...previous, {
      input, prompt: submittedPrompt, output,
      sequence: result.sequence, sequenceId,
    }]);
    if (result.mode === 'chat') setMode('chat');
  }, [currentPrompt, getShell, push, setTheme, skipSequence]);

  const complete = useCallback((input: string, caret: number): Completion => {
    return getShell().complete(input, caret);
  }, [getShell]);

  const cancel = useCallback(() => {
    if (skipSequence()) return;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }, [skipSequence]);

  const clearScreen = useCallback(() => {
    skipSequence();
    setHistory([]);
    setShowWelcome(false);
  }, [skipSequence]);

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
    prompt, running, skip, sequencePlaying, finishSequence,
    complete, cancel, clearScreen, onListCandidates, onAbandon,
    historyUp: up, historyDown: down, resetHistoryCursor: reset,
  };
}
