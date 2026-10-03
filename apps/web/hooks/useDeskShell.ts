'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ASSISTANT_ERROR_MESSAGE, askAssistant, createAssistantUnknownHandler, createShell, formatSourcesLine,
} from '@ahmed-moghazy/shared';
import type { AssistantEvent, AssistantTurn, CommandOutput, Completion } from '@ahmed-moghazy/shared';
import { fetchSkillEvidence, liveServices } from '../lib/live-services';
import type { AssistantEntryState } from './useTerminal';

/** One exchange in the desktop's terminal window. */
export interface DeskEntry {
  id: number;
  prompt: string;
  input: string;
  output: CommandOutput[];
  assistant?: AssistantEntryState;
  /** Set when the command needs the full-screen terminal (tour, chat, themes, signing). */
  handoff?: string;
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
      return last?.kind === 'text'
        ? { ...streaming, parts: [...state.parts.slice(0, -1), { kind: 'text', text: last.text + event.delta }] }
        : { ...streaming, parts: [...state.parts, { kind: 'text', text: event.delta }] };
    }
    case 'sources': {
      const line = formatSourcesLine(event);
      return line ? { ...streaming, parts: [...state.parts, { kind: 'sources', line }] } : streaming;
    }
    case 'notice':
      return { ...streaming, parts: [...state.parts, { kind: 'notice', notice: event.kind, message: event.message }] };
    case 'declined':
      return { ...streaming, parts: state.parts.filter((part) => part.kind !== 'text') };
    case 'done':
      return { ...state, status: 'done' };
  }
}

/**
 * A small, self-contained shell for the terminal window on the regular page. It shares the command
 * registry and the assistant with the full terminal but owns no URL, theme, boot, or tour state.
 */
export function useDeskShell(initial: DeskEntry[]) {
  const shellRef = useRef<ReturnType<typeof createShell> | null>(null);
  const getShell = () => {
    shellRef.current ??= createShell({
      surface: 'web', origin: window.location.origin, onUnknownCommand: createAssistantUnknownHandler(),
      skillEvidence: fetchSkillEvidence, live: liveServices,
    });
    return shellRef.current;
  };
  const [entries, setEntries] = useState<DeskEntry[]>(initial);
  const [running, setRunning] = useState(false);
  const nextId = useRef(initial.length);
  const controllerRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<AssistantTurn[]>([]);
  const historyRef = useRef<string[]>([]);
  const cursorRef = useRef(-1);

  const prompt = useCallback(() => {
    const { user, host, cwd } = getShell().prompt();
    return `${user}@${host}:${cwd}$`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (id: number, change: (entry: DeskEntry) => DeskEntry) =>
    setEntries((list) => list.map((entry) => (entry.id === id ? change(entry) : entry)));

  const ask = async (id: number, question: string, controller: AbortController) => {
    let latest: AssistantEntryState = { question, status: 'thinking', parts: [] };
    const apply = (event: AssistantEvent) => {
      latest = applyEvent(latest, event);
      const snapshot = latest;
      update(id, (entry) => ({ ...entry, assistant: snapshot }));
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
      update(id, (entry) => entry.assistant && entry.assistant.status !== 'done'
        ? { ...entry, assistant: { ...entry.assistant, status: 'cancelled' } } : entry);
      return;
    }
    const text = latest.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('').trim();
    if (latest.status === 'done' && text) {
      conversationRef.current = [...conversationRef.current, { role: 'user' as const, text: question }, { role: 'assistant' as const, text }]
        .slice(-MAX_EXCHANGES * 2);
    }
  };

  const run = useCallback(async (line: string) => {
    const input = line.trim();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (input) historyRef.current = [...historyRef.current.filter((item) => item !== input), input].slice(-50);
    cursorRef.current = -1;
    const shell = getShell();
    const id = nextId.current++;
    const entry: DeskEntry = { id, prompt: prompt(), input, output: [] };
    if (!input) { setEntries((list) => [...list, entry]); return; }
    setRunning(true);
    try {
      const result = await shell.run(input, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.clear) { setEntries([]); return; }
      if (result.download) {
        const link = Object.assign(document.createElement('a'), { href: result.download.url, download: result.download.filename });
        link.click();
      }
      if (result.openUrl) window.open(result.openUrl, '_blank', 'noopener,noreferrer');
      const handoff = result.tour || result.theme || result.sign || result.welcome ? input : undefined;
      const output = result.view === 'gui'
        ? [{ type: 'text' as const, content: "You're already in the regular view. The zoom box on this window opens the full terminal.", style: { dim: true } }]
        : result.output;
      setEntries((list) => [...list, { ...entry, output, handoff }]);
      if (result.ask) {
        setEntries((list) => list.map((item) => item.id === id
          ? { ...item, output: [], assistant: { question: result.ask!.question, status: 'thinking', parts: [] } } : item));
        await ask(id, result.ask.question, controller);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setRunning(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }, []);

  const complete = useCallback((input: string, caret: number): Completion => getShell().complete(input, caret),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const historyUp = useCallback((current: string) => {
    const list = historyRef.current;
    if (!list.length) return current;
    cursorRef.current = cursorRef.current < 0 ? list.length - 1 : Math.max(0, cursorRef.current - 1);
    return list[cursorRef.current];
  }, []);

  const historyDown = useCallback(() => {
    const list = historyRef.current;
    if (cursorRef.current < 0) return '';
    cursorRef.current += 1;
    if (cursorRef.current >= list.length) { cursorRef.current = -1; return ''; }
    return list[cursorRef.current];
  }, []);

  const resetHistoryCursor = useCallback(() => { cursorRef.current = -1; }, []);
  const clearScreen = useCallback(() => setEntries([]), []);

  const listCandidates = useCallback((input: string, candidates: string[]) => {
    const id = nextId.current++;
    setEntries((list) => [...list, { id, prompt: prompt(), input, output: [{ type: 'text', content: candidates.join('  ') }] }]);
  }, [prompt]);

  return { entries, running, run, cancel, complete, historyUp, historyDown, resetHistoryCursor, clearScreen, listCandidates, prompt };
}
