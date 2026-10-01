import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ASSISTANT_ERROR_MESSAGE, askAssistant, createAssistantUnknownHandler, createShell, formatSourcesLine, MAX_LINK_LENGTH,
  parseAddress, themes, toAddress, welcomeCommand,
} from '@ahmed-moghazy/shared';
import type {
  AssistantEvent, AssistantTurn, CommandOutput, Completion, HistoryEntry, NoticeKind, SequenceStep,
} from '@ahmed-moghazy/shared';
import { useHistory } from './useHistory';
import { useThemeApplier } from './useThemeApplier';

export type TerminalMode = 'command' | 'chat';

export interface AssistantEntryState {
  question: string;
  status: 'thinking' | 'streaming' | 'done' | 'cancelled';
  parts: Array<
    | { kind: 'command'; commandLine: string; output: CommandOutput[] }
    | { kind: 'text'; text: string }
    | { kind: 'sources'; line: string }
    | { kind: 'notice'; notice: NoticeKind; message: string }>;
}

interface TerminalEntry extends HistoryEntry {
  sequence?: SequenceStep[];
  sequenceDone?: boolean;
  sequenceId?: number;
  assistant?: AssistantEntryState;
  assistantId?: number;
}

const MAX_EXCHANGES = 5;

function applyEvent(state: AssistantEntryState, event: AssistantEvent): AssistantEntryState {
  if (state.status === 'cancelled' || state.status === 'done') return state;
  const streaming = { ...state, status: 'streaming' as const };
  switch (event.type) {
    case 'command':
      return { ...streaming, parts: [...state.parts, { kind: 'command', commandLine: event.commandLine, output: event.output }] };
    case 'text': {
      const last = state.parts[state.parts.length - 1];
      if (last?.kind === 'text') {
        return { ...streaming, parts: [...state.parts.slice(0, -1), { kind: 'text', text: last.text + event.delta }] };
      }
      return { ...streaming, parts: [...state.parts, { kind: 'text', text: event.delta }] };
    }
    case 'sources': {
      const line = formatSourcesLine(event);
      return line ? { ...streaming, parts: [...state.parts, { kind: 'sources', line }] } : streaming;
    }
    case 'notice':
      return { ...streaming, parts: [...state.parts, { kind: 'notice', notice: event.kind, message: event.message }] };
    case 'declined':
      // A refusal stands alone: drop any text the model wrote before deciding to decline.
      // The fixed refusal text follows this event.
      return { ...streaming, parts: state.parts.filter((part) => part.kind !== 'text') };
    case 'done':
      return { ...state, status: 'done' };
  }
}

function answerText(state: AssistantEntryState): string {
  return state.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('').trim();
}

export function useTerminal() {
  const [history, setHistory] = useState<TerminalEntry[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [mode, setMode] = useState<TerminalMode>('command');
  const [prompt, setPrompt] = useState('visitor@portfolio:~$');
  const [running, setRunning] = useState(false);
  const [skip, setSkip] = useState(0);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const activeSequenceRef = useRef<number | null>(null);
  const sequenceIdRef = useRef(0);
  const shellRef = useRef<ReturnType<typeof createShell> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<AssistantTurn[]>([]);
  const assistantIdRef = useRef(0);
  const askingRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ranLinkRef = useRef(false);
  const addressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { push, up, down, reset } = useHistory();
  const { theme, setTheme } = useThemeApplier();

  const getShell = useCallback(() => {
    if (!shellRef.current) {
      shellRef.current = createShell({
        surface: 'web', origin: window.location.origin, onUnknownCommand: createAssistantUnknownHandler(),
      });
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

  useEffect(() => () => {
    if (addressTimerRef.current !== null) clearTimeout(addressTimerRef.current);
  }, []);

  const syncAddress = useCallback((line: string, cwdBefore: string) => {
    if (addressTimerRef.current !== null) clearTimeout(addressTimerRef.current);
    const commandLine = cwdBefore === '/' ? line : `cd ${cwdBefore} && ${line}`;
    const address = !line || commandLine.length > MAX_LINK_LENGTH ? '/' : toAddress(commandLine);
    addressTimerRef.current = setTimeout(() => {
      try {
        window.history.replaceState(window.history.state, '', address);
      } catch {
        // Some browsers limit rapid history updates.
      }
    }, 250);
  }, []);

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

  const updateAssistant = useCallback((id: number, update: (state: AssistantEntryState) => AssistantEntryState) => {
    setHistory((previous) => previous.map((entry) =>
      entry.assistantId === id && entry.assistant ? { ...entry, assistant: update(entry.assistant) } : entry));
  }, []);

  const runAssistant = useCallback(async (question: string, id: number, controller: AbortController) => {
    let latest: AssistantEntryState = { question, status: 'thinking', parts: [] };
    const apply = (event: AssistantEvent) => {
      latest = applyEvent(latest, event);
      updateAssistant(id, (state) => applyEvent(state, event));
    };
    try {
      for await (const event of askAssistant({
        endpoint: '/api/chat', surface: 'web', question, history: conversationRef.current, signal: controller.signal,
      })) {
        if (controller.signal.aborted) break;
        apply(event);
      }
    } catch {
      if (!controller.signal.aborted) {
        apply({ type: 'notice', kind: 'error', message: ASSISTANT_ERROR_MESSAGE });
        apply({ type: 'done' });
      }
    }
    if (controller.signal.aborted) {
      updateAssistant(id, (state) => (state.status === 'done' ? state : { ...state, status: 'cancelled' }));
    } else {
      const text = answerText(latest);
      if (latest.status === 'done' && text) {
        conversationRef.current = [
          ...conversationRef.current,
          { role: 'user' as const, text: question },
          { role: 'assistant' as const, text },
        ].slice(-MAX_EXCHANGES * 2);
      }
    }
    if (controllerRef.current === controller) {
      controllerRef.current = null;
      setRunning(false);
    }
    if (askingRef.current === id) askingRef.current = null;
  }, [updateAssistant]);

  const handleCommand = useCallback(async (input: string, opts: { origin?: 'typed' | 'link' } = {}) => {
    const isLink = opts.origin === 'link';
    skipSequence();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const submittedPrompt = currentPrompt();
    setRunning(true);
    if (!isLink) setShowWelcome(false);
    const shell = getShell();
    const cwdBefore = shell.session.cwd;
    const result = await shell.run(input, { signal: controller.signal });
    if (controllerRef.current === controller) {
      controllerRef.current = null;
      setRunning(false);
    }
    // A cancelled chain may already have changed directory.
    setPrompt(currentPrompt());
    if (controller.signal.aborted || result.cancelled) return;

    if (isLink && result.ask) {
      setPrefill({ text: input, nonce: Date.now() });
      return;
    }

    push(input);
    if (result.ask) {
      const { question } = result.ask;
      const id = ++assistantIdRef.current;
      askingRef.current = id;
      controllerRef.current = controller;
      setRunning(true);
      setHistory((previous) => [...previous, {
        input, prompt: submittedPrompt, output: [], assistantId: id,
        assistant: { question, status: 'thinking', parts: [] },
      }]);
      await runAssistant(question, id, controller);
      return;
    }
    // The shell drops output printed before a clear or welcome, so whatever remains ran
    // after the reset. On the web the welcome banner is the WelcomeScreen, not log output.
    let output = result.output;
    if (result.welcome) {
      setShowWelcome(true);
      setHistory([]);
      output = output.slice(welcomeCommand().output.length);
    } else if (result.clear) {
      setHistory([]);
      if (isLink) setShowWelcome(false);
    }
    if (result.theme && themes[result.theme]) setTheme(themes[result.theme]);
    if (!isLink && result.openUrl) window.open(result.openUrl, '_blank', 'noopener,noreferrer');
    if (!isLink && result.download) {
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
    if (isLink && (result.openUrl || result.download)) {
      output = [...output, {
        type: 'text',
        content: 'Opened from a link, so nothing was opened or downloaded. Use the link above.',
        style: { dim: true },
      }];
    }
    if (mode === 'command') {
      syncAddress(result.clear || result.welcome ? '' : input, cwdBefore);
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
  }, [currentPrompt, getShell, mode, push, runAssistant, setTheme, skipSequence, syncAddress]);

  useEffect(() => {
    if (ranLinkRef.current) return;
    ranLinkRef.current = true;
    const address = parseAddress(window.location.pathname, window.location.search);
    if (address.kind === 'command' || address.kind === 'not-command') {
      void handleCommand(address.line, { origin: 'link' });
    } else if (address.kind === 'invalid') {
      const reasons = {
        'too-long': 'link too long',
        undecodable: 'could not decode link',
        ambiguous: 'ambiguous link',
        'control-chars': 'link contains control characters',
      };
      setHistory((previous) => [...previous, {
        input: '',
        output: [{
          type: 'text',
          content: `This link couldn't be used (${reasons[address.reason]}). Type "help" to explore.`,
          style: { dim: true },
        }],
      }]);
    }
  }, [handleCommand]);

  const complete = useCallback((input: string, caret: number): Completion => {
    return getShell().complete(input, caret);
  }, [getShell]);

  const cancel = useCallback(() => {
    if (skipSequence()) return;
    const asking = askingRef.current;
    if (asking !== null) {
      updateAssistant(asking, (state) => (state.status === 'done' ? state : { ...state, status: 'cancelled' }));
    }
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }, [skipSequence, updateAssistant]);

  const clearScreen = useCallback(() => {
    skipSequence();
    // The answer being cleared has nowhere to render, so stop it instead of streaming unseen.
    if (askingRef.current !== null) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setRunning(false);
    }
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
    history, showWelcome, theme, scrollRef, handleCommand, mode, exitChat, conversationRef, prefill,
    prompt, running, skip, sequencePlaying, finishSequence,
    complete, cancel, clearScreen, onListCandidates, onAbandon,
    historyUp: up, historyDown: down, resetHistoryCursor: reset,
  };
}
