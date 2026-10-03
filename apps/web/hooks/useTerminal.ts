import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ASSISTANT_ERROR_MESSAGE, askAssistant, createAssistantUnknownHandler, createShell, formatSourcesLine, MAX_LINK_LENGTH,
  bootSequence, guestbookEntryOutput, parseAddress, shouldType, SIGN_MESSAGES, themes, toAddress, welcomeCommand,
} from '@ahmed-moghazy/shared';
import type {
  AssistantEvent, AssistantTurn, CommandOutput, Completion, HistoryEntry, NoticeKind, SequenceStep, SignResult,
} from '@ahmed-moghazy/shared';
import { peekSnapshot, saveSnapshot, takeSnapshot } from '../lib/terminal-snapshot';
import { markGuiSeen, setViewCookie } from '../lib/view-cookie';
import { useHistory } from './useHistory';
import { useThemeApplier } from './useThemeApplier';
import { useReducedMotion } from './useReducedMotion';
import { fetchSkillEvidence, liveServices } from '../lib/live-services';
import { getTurnstileToken } from '../lib/turnstile-client';
import { useTour } from './useTour';

export interface AssistantEntryState {
  question: string;
  status: 'thinking' | 'streaming' | 'done' | 'cancelled';
  parts: Array<
    | { kind: 'command'; commandLine: string; output: CommandOutput[] }
    | { kind: 'text'; text: string }
    | { kind: 'sources'; line: string }
    | { kind: 'notice'; notice: NoticeKind; message: string }>;
}

export interface TerminalEntry extends HistoryEntry {
  tourStepIndex?: number;
  tourSessionId?: string;
  reveal?: boolean;
  sequence?: SequenceStep[];
  sequenceDone?: boolean;
  sequenceId?: number;
  assistant?: AssistantEntryState;
  assistantId?: number;
}

const MAX_EXCHANGES = 5;
let bootStartedInPage = false;
const BOOT_STEPS = bootSequence();

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

// A restored log must not replay a sequence or show an answer that is still streaming.
function settleEntry(entry: TerminalEntry): TerminalEntry {
  const shown = entry.reveal ? { ...entry, reveal: false } : entry;
  const settled = shown.sequence && !shown.sequenceDone ? { ...shown, sequenceDone: true } : shown;
  const { assistant } = settled;
  return assistant && assistant.status !== 'done' && assistant.status !== 'cancelled'
    ? { ...settled, assistant: { ...assistant, status: 'cancelled' } }
    : settled;
}

export interface TerminalOptions {
  /**
   * The terminal is one window on the /gui desktop: no boot, no address-bar sync, no deep-link run,
   * and the theme is applied to the window rather than the page.
   */
  windowed?: boolean;
  /** Log shown when there is no session to restore (the window starts with `about` already run). */
  initialHistory?: TerminalEntry[];
  onFx?: (fx: 'web' | 'confetti') => void;
}

export function useTerminal({ windowed = false, initialHistory, onFx }: TerminalOptions = {}) {
  const router = useRouter();
  const restoredRef = useRef(peekSnapshot());
  const [history, setHistory] = useState<TerminalEntry[]>(() => restoredRef.current?.history ?? initialHistory ?? []);
  const [showWelcome, setShowWelcome] = useState(!restoredRef.current && !initialHistory);
  const initialWelcomeRef = useRef(showWelcome);
  const [booting, setBooting] = useState(false);
  const [prompt, setPrompt] = useState(restoredRef.current?.prompt ?? 'visitor@portfolio:~$');
  const latestRef = useRef({ history, showWelcome, prompt });
  latestRef.current = { history, showWelcome, prompt };
  const [running, setRunning] = useState(false);
  const [skip, setSkip] = useState(0);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  // The idle screensaver is opt-in: the `screensaver` command turns it on and the choice is remembered.
  const [screensaver, setScreensaver] = useState(false);
  useEffect(() => {
    try { setScreensaver(window.localStorage.getItem('screensaver:v1') === 'on'); } catch { /* Storage is optional. */ }
  }, []);
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
  const { theme, setTheme } = useThemeApplier(!windowed);
  const reducedMotion = useReducedMotion();
  const {
    playing: tourPlaying, steps: tourSteps, index: tourIndex, lastRunIndex: tourLastRunIndex, sessionId: tourSessionId,
    busy: tourBusy, typed: tourText, finished: tourFinished, focusRequest: tourFocusRequest,
    start: startTour, next: nextTour, back: backTour, stop: stopTour, dismissFinished,
  } = useTour();

  const skipBoot = useCallback(() => setBooting(false), []);
  // Set once the visitor runs or clears something, so an untouched window doesn't replace the welcome on `/`.
  const usedRef = useRef(false);

  // Pick up the session the other view left behind. On a client-side navigation the new page renders
  // before the old terminal unmounts and saves, so the render-time peek can miss it; effects run after
  // that save. Declared first so the boot, prompt and deep-link effects below see the restored state.
  useEffect(() => {
    const snapshot = takeSnapshot();
    if (!snapshot || restoredRef.current === snapshot) return;
    restoredRef.current = snapshot;
    shellRef.current = null;
    setHistory(snapshot.history);
    setShowWelcome(false);
    setPrompt(snapshot.prompt);
  }, []);

  useEffect(() => {
    if (windowed || restoredRef.current || bootStartedInPage || !initialWelcomeRef.current || window.location.pathname !== '/' || window.location.search || window.location.hash ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (window.localStorage.getItem('boot:v1')) return;
      window.localStorage.setItem('boot:v1', '1');
    } catch {
      // The in-memory flag still prevents a replay in this page.
    }
    bootStartedInPage = true;
    setBooting(true);
  }, []);

  useEffect(() => {
    if (!booting) return;
    window.addEventListener('keydown', skipBoot);
    window.addEventListener('pointerdown', skipBoot);
    window.addEventListener('touchstart', skipBoot);
    return () => {
      window.removeEventListener('keydown', skipBoot);
      window.removeEventListener('pointerdown', skipBoot);
      window.removeEventListener('touchstart', skipBoot);
    };
  }, [booting, skipBoot]);

  const getShell = useCallback(() => {
    if (!shellRef.current) {
      shellRef.current = createShell({
        surface: 'web', origin: window.location.origin, onUnknownCommand: createAssistantUnknownHandler(),
        skillEvidence: fetchSkillEvidence,
        live: liveServices,
        ...(restoredRef.current && { initialCwd: restoredRef.current.cwd }),
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
    const log = scrollRef.current;
    if (!log) return;
    const entry = tourPlaying && tourSessionId && tourIndex < tourLastRunIndex
      ? log.querySelector<HTMLElement>(`[data-tour="${tourSessionId}:${tourIndex}"]`) : null;
    if (entry) {
      log.scrollTo(0, log.scrollTop + entry.getBoundingClientRect().top - log.getBoundingClientRect().top - 12);
    } else {
      log.scrollTo(0, log.scrollHeight);
    }
  }, [history, tourPlaying, tourIndex, tourLastRunIndex, tourSessionId]);

  useEffect(() => () => {
    if (addressTimerRef.current !== null) clearTimeout(addressTimerRef.current);
  }, []);

  // Keep the log and directory for the way back from the regular page. A terminal that was never
  // used has nothing worth keeping, and returning to it should show the welcome as usual.
  useEffect(() => () => {
    const { history: log, showWelcome: welcome, prompt: shownPrompt } = latestRef.current;
    if (!log.length && welcome) return;
    if (windowed && !usedRef.current && !restoredRef.current) return;
    controllerRef.current?.abort();
    saveSnapshot({ history: log.map(settleEntry), cwd: shellRef.current?.session.cwd ?? '/', prompt: shownPrompt });
  }, []);

  const syncAddress = useCallback((line: string, cwdBefore: string) => {
    // The window lives on /gui; its URL never follows the commands.
    if (windowed) return;
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
  }, [windowed]);

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

  const handleCommand = useCallback(async (input: string, opts: { origin?: 'typed' | 'link' | 'tour'; tourStepIndex?: number; tourSessionId?: string } = {}) => {
    const isLink = opts.origin === 'link';
    const isTour = opts.origin === 'tour';
    usedRef.current = true;
    if (!isTour) dismissFinished();
    if (!isTour && tourPlaying) stopTour();
    skipBoot();
    setHistory((previous) => previous.map((entry) => entry.reveal ? { ...entry, reveal: false } : entry));
    skipSequence();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const submittedPrompt = currentPrompt();
    setRunning(true);
    if (!isLink) setShowWelcome(false);
    const shell = getShell();
    const cwdBefore = shell.session.cwd;
    // Tour steps are a demonstration: they never enter the visitor's history or the address bar.
    if (!isLink && !isTour) push(input);
    const result = await shell.run(input, { signal: controller.signal });
    if (controllerRef.current === controller) {
      controllerRef.current = null;
      setRunning(false);
    }
    // A cancelled chain may already have changed directory.
    setPrompt(currentPrompt());
    if (controller.signal.aborted || result.cancelled) return;
    if (!isLink && !isTour && result.fx) onFx?.(result.fx);

    if (isLink && result.ask) {
      setPrefill({ text: input, nonce: Date.now() });
      return;
    }

    if (isLink) push(input);
    if (result.ask) {
      const { question } = result.ask;
      const id = ++assistantIdRef.current;
      askingRef.current = id;
      controllerRef.current = controller;
      setRunning(true);
      setHistory((previous) => [...previous, {
        input, prompt: submittedPrompt, output: [], assistantId: id, tourStepIndex: opts.tourStepIndex, tourSessionId: opts.tourSessionId,
        assistant: { question, status: 'thinking', parts: [] },
      }]);
      await runAssistant(question, id, controller);
      return;
    }
    // The shell drops output printed before a clear or welcome, so whatever remains ran
    // after the reset. On the web the welcome banner is the WelcomeScreen, not log output.
    let output = result.view === 'gui' && windowed
      ? [{ type: 'text' as const, content: "You're already in the regular view. The Deskbar's Full terminal button opens the full-screen terminal.", style: { dim: true } }]
      : result.output;
    if (result.welcome) {
      setShowWelcome(true);
      setHistory([]);
      output = output.slice(welcomeCommand().output.length);
    } else if (result.clear) {
      setHistory([]);
      if (isLink) setShowWelcome(false);
    }
    if (result.theme && themes[result.theme]) setTheme(themes[result.theme], !isLink && !isTour);
    if (!isLink && !isTour && result.openUrl) window.open(result.openUrl, '_blank', 'noopener,noreferrer');
    if (!isLink && !isTour && result.download) {
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
    if (isLink && result.sign) {
      output = [{ type: 'text', content: 'To sign, type this command in the web terminal.', style: { dim: true } }];
    }
    const resetWithoutOutput = (result.welcome || result.clear) && !output.length && !result.sequence;
    if (!result.view && !isTour) {
      syncAddress(resetWithoutOutput ? '' : input, cwdBefore);
    }
    if (resetWithoutOutput) return;
    const sequenceId = result.sequence ? ++sequenceIdRef.current : undefined;
    if (sequenceId !== undefined) {
      activeSequenceRef.current = sequenceId;
      setSequencePlaying(true);
    }
    setHistory((previous) => [...previous, {
      input, prompt: submittedPrompt, output, tourStepIndex: opts.tourStepIndex, tourSessionId: opts.tourSessionId,
      reveal: !isLink && !result.ask && !result.sequence && !/[|]/.test(input) && !reducedMotion && shouldType(output),
      sequence: result.sequence, sequenceId,
    }]);
    if (result.sign && !isLink && !isTour) {
      setRunning(true);
      controllerRef.current = controller;
      try {
        const turnstileToken = await getTurnstileToken();
        if (controller.signal.aborted) return;
        const response = await fetch('/api/guestbook', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ ...result.sign, turnstileToken }),
        });
        const signed = await response.json() as SignResult;
        if (controller.signal.aborted) return;
        setHistory((previous) => [...previous, { input: '', output: signed.ok
          ? [{ type: 'text', content: `Thanks for signing, ${signed.entry.name}!`, style: { color: 'success' } }, ...guestbookEntryOutput(signed.entry)]
          : [{ type: 'error', content: signed.message }] }]);
      } catch {
        if (!controller.signal.aborted) setHistory((previous) => [...previous, { input: '', output: [{ type: 'error', content: SIGN_MESSAGES.human_check }] }]);
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setRunning(false);
        }
      }
    }
    // Unlike openUrl and download, switching views only changes what is displayed, so links may do it.
    if (result.screensaver !== undefined && !isLink && !isTour) {
      setScreensaver(result.screensaver);
      try { window.localStorage.setItem('screensaver:v1', result.screensaver ? 'on' : 'off'); } catch { /* Storage is optional. */ }
    }
    if (result.view === 'gui' && !isTour && !windowed) {
      setViewCookie('gui');
      markGuiSeen();
      router.push('/gui');
    }
    if (result.tour && !isLink && !isTour) {
      const startingTheme = theme;
      void startTour(result.tour, {
        reducedMotion,
        run: (line, stepIndex, sessionId) => handleCommand(line, { origin: 'tour', tourStepIndex: stepIndex, tourSessionId: sessionId }),
        cancel: () => { controllerRef.current?.abort(); controllerRef.current = null; setRunning(false); },
        restoreTheme: () => setTheme(startingTheme, false),
      });
    }
  }, [currentPrompt, getShell, push, router, runAssistant, setTheme, skipSequence, skipBoot, syncAddress, reducedMotion, theme, startTour, stopTour, tourPlaying, dismissFinished, windowed, onFx]);

  const submitSuggestion = useCallback((line: string) => { void handleCommand(line); }, [handleCommand]);

  useEffect(() => {
    if (ranLinkRef.current || windowed) return;
    ranLinkRef.current = true;
    // A restored log already holds what the address ran, so only note that the terminal is the view.
    if (restoredRef.current) {
      setViewCookie('terminal');
      return;
    }
    const address = parseAddress(window.location.pathname, window.location.search);
    if (address.kind === 'root') setViewCookie('terminal');
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
  }, [handleCommand, windowed]);

  const complete = useCallback((input: string, caret: number): Completion => {
    return getShell().complete(input, caret);
  }, [getShell]);

  const cancel = useCallback(() => {
    if (tourPlaying) { stopTour(); return; }
    if (skipSequence()) return;
    const asking = askingRef.current;
    if (asking !== null) {
      updateAssistant(asking, (state) => (state.status === 'done' ? state : { ...state, status: 'cancelled' }));
    }
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }, [skipSequence, updateAssistant, tourPlaying, stopTour]);

  const clearScreen = useCallback(() => {
    usedRef.current = true;
    if (tourPlaying) stopTour();
    skipSequence();
    // The answer being cleared has nowhere to render, so stop it instead of streaming unseen.
    if (askingRef.current !== null) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setRunning(false);
    }
    setHistory([]);
    setShowWelcome(false);
  }, [skipSequence, tourPlaying, stopTour]);

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

  const onPrefillApplied = useCallback(() => {
    setPrefill(null);
  }, []);

  return {
    history, showWelcome, theme, scrollRef, handleCommand, submitSuggestion, prefill, onPrefillApplied,
    booting, bootSteps: BOOT_STEPS, skipBoot, reducedMotion, screensaver,
    prompt, running, skip, sequencePlaying, finishSequence, tourPlaying, tourSteps, tourIndex, tourBusy,
    tourText, tourFinished, tourFocusRequest, nextTour, backTour, stopTour,
    complete, cancel, clearScreen, onListCandidates, onAbandon,
    historyUp: up, historyDown: down, resetHistoryCursor: reset,
  };
}
