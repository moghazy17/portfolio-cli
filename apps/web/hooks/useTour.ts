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

export function useTour() {
  const [playing, setPlaying] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const cancelRef = useRef<() => void>(() => undefined);

  const stop = useCallback(() => {
    if (!controllerRef.current || controllerRef.current.signal.aborted) return;
    controllerRef.current.abort();
    cancelRef.current();
  }, []);
  const dismissFinished = useCallback(() => setFinished(false), []);

  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  const start = useCallback(async (steps: TourStep[], options: {
    reducedMotion: boolean;
    run: (line: string) => Promise<void>;
    cancel: () => void;
    restoreTheme: () => void;
  }) => {
    stop();
    const controller = new AbortController();
    controllerRef.current = controller;
    cancelRef.current = options.cancel;
    setPlaying(true);
    setFinished(false);
    recordClientEvent('tours_started');
    const interrupt = (event: Event) => {
      if (event instanceof KeyboardEvent) event.preventDefault();
      stop();
    };
    for (const name of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(name, interrupt, true);
    try {
      for (const step of steps) {
        if (controller.signal.aborted) break;
        if (options.reducedMotion && step.motion) continue;
        setTyped('');
        if (options.reducedMotion) setTyped(step.line);
        else for (const char of step.line) {
          if (controller.signal.aborted) break;
          setTyped((previous) => (previous ?? '') + char);
          await delay(35, controller.signal);
        }
        if (controller.signal.aborted) break;
        await options.run(step.line);
        if (controller.signal.aborted) break;
        setTyped('');
        if (step.pauseMs) await delay(step.pauseMs, controller.signal);
      }
      if (!controller.signal.aborted) {
        recordClientEvent('tours_completed');
        setFinished(true);
      }
    } finally {
      for (const name of ['keydown', 'pointerdown', 'touchstart']) window.removeEventListener(name, interrupt, true);
      options.restoreTheme();
      if (controllerRef.current === controller) controllerRef.current = null;
      setTyped(null);
      setPlaying(false);
    }
  }, [stop]);

  return { playing, typed, finished, start, stop, dismissFinished };
}
