'use client';

import { useEffect, useRef } from 'react';
import type { TourStep } from '@ahmed-moghazy/shared';

interface Props {
  steps: TourStep[];
  index: number;
  busy: boolean;
  focusRequest: number;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
}

export default function TourCard({ steps, index, busy, focusRequest, onBack, onNext, onExit }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const active = document.activeElement;
    const prompt = document.querySelector('.terminal-container .command-input-wrap input');
    if (active === document.body || active === prompt || (active && cardRef.current?.contains(active))) {
      nextRef.current?.focus({ preventScroll: true });
    }
  }, [focusRequest]);

  return (
    <section ref={cardRef} className="tour-card" role="region" aria-label="Tour">
      <div className="tour-card-heading">Step {index + 1}/{steps.length} · {steps[index].title}</div>
      <p className="tour-card-caption" aria-live="polite">{steps[index].caption}</p>
      <div className="tour-card-actions">
        <button type="button" aria-disabled={index === 0} onClick={() => { if (index > 0) onBack(); }}>Back</button>
        <button ref={nextRef} type="button" aria-disabled={busy} onClick={() => { if (!busy) onNext(); }}>
          {index === steps.length - 1 ? 'Finish' : 'Next →'}
        </button>
        <button type="button" onClick={onExit}>Exit</button>
      </div>
      <div className="tour-card-keys">Enter next · ← back · Esc exit</div>
    </section>
  );
}
