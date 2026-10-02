'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TourStep } from '@ahmed-moghazy/shared';
import { recordClientEvent } from '../lib/client-events';

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

interface TourOptions {
  reducedMotion: boolean;
  run: (line: string, stepIndex: number) => Promise<void>;
  cancel: () => void;
  restoreTheme: () => void;
}

interface TourSession {
  steps: TourStep[];
  index: number;
  lastRunIndex: number;
  busy: boolean;
  controller: AbortController;
  startedAt: number;
  options: TourOptions;
}

export function useTour() {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [lastRunIndex, setLastRunIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const sessionRef = useRef<TourSession | null>(null);
  const playing = steps.length > 0;

  const stop = useCallback((completed = false) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    session.controller.abort();
    session.options.cancel();
    session.options.restoreTheme();
    if (completed) recordClientEvent('tours_completed');
    setSteps([]);
    setTyped(null);
    setBusy(false);
    setFinished(completed);
  }, []);
  const dismissFinished = useCallback(() => setFinished(false), []);

  useEffect(() => () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    session.controller.abort();
    session.options.cancel();
    session.options.restoreTheme();
  }, []);

  const runStep = useCallback(async (session: TourSession, stepIndex: number) => {
    const step = session.steps[stepIndex];
    session.busy = true;
    session.lastRunIndex = stepIndex;
    setBusy(true);
    setLastRunIndex(stepIndex);
    setTyped('');
    try {
      if (session.options.reducedMotion) setTyped(step.line);
      else for (const char of step.line) {
        if (session.controller.signal.aborted) return;
        setTyped((previous) => (previous ?? '') + char);
        await delay(20, session.controller.signal);
      }
      if (session.controller.signal.aborted) return;
      await session.options.run(step.line, stepIndex);
    } finally {
      if (sessionRef.current === session) {
        session.busy = false;
        setBusy(false);
        setTyped(null);
        setFocusRequest((value) => value + 1);
      }
    }
  }, []);

  const start = useCallback((allSteps: TourStep[], options: TourOptions) => {
    stop();
    const filtered = allSteps.filter((step) => !options.reducedMotion || !step.motion);
    if (!filtered.length) return;
    const session: TourSession = {
      steps: filtered, index: 0, lastRunIndex: -1, busy: false,
      controller: new AbortController(), startedAt: performance.now(), options,
    };
    sessionRef.current = session;
    setSteps(filtered);
    setIndex(0);
    setFinished(false);
    setFocusRequest((value) => value + 1);
    recordClientEvent('tours_started');
    void runStep(session, 0);
  }, [runStep, stop]);

  const next = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.busy) return;
    if (session.index === session.steps.length - 1) { stop(true); return; }
    session.index += 1;
    setIndex(session.index);
    if (session.index > session.lastRunIndex) void runStep(session, session.index);
  }, [runStep, stop]);

  const back = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.index === 0) return;
    session.index -= 1;
    setIndex(session.index);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.timeStamp <= (sessionRef.current?.startedAt ?? 0)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const prompt = document.querySelector<HTMLInputElement>('.terminal-container .command-input-wrap input');
      if (event.target instanceof HTMLInputElement && event.target !== prompt) return;
      if (event.key === 'Escape') { event.preventDefault(); stop(); return; }
      if (prompt?.value) return;
      if (event.key === 'Enter' || event.key === 'ArrowRight') { event.preventDefault(); next(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [playing, next, back, stop]);

  return { playing, steps, index, lastRunIndex, busy, typed, finished, focusRequest, start, next, back, stop, dismissFinished };
}
