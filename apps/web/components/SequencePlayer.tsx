'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandOutput, SequenceStep, Theme } from '@ahmed-moghazy/shared';
import OutputRenderer from './OutputRenderer';

interface Props {
  steps: SequenceStep[];
  final: CommandOutput[];
  theme: Theme;
  skip: number;
  onDone: () => void;
}

export default function SequencePlayer({ steps, final, theme, skip, onDone }: Props) {
  const [frame, setFrame] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
    return steps.length ? 0 : null;
  });
  const initialSkip = useRef(skip);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setFrame(null);
    if (!done.current) {
      done.current = true;
      onDoneRef.current();
    }
  }, []);

  useEffect(() => {
    if (frame === null) {
      finish();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      setFrame(frame + 1 < steps.length ? frame + 1 : null);
    }, steps[frame].delayMs);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [frame, steps, finish]);

  useEffect(() => {
    if (skip > initialSkip.current) finish();
  }, [skip, finish]);

  // Frames sit inside the terminal's live log, so hide them from assistive technology;
  // the final output mounts as a new node and is announced once.
  if (frame === null) return <OutputRenderer output={final} theme={theme} />;
  return (
    <div aria-hidden="true">
      <OutputRenderer output={steps[frame].output} theme={theme} />
    </div>
  );
}
