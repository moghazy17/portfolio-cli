'use client';

import { useCallback, useEffect, useState } from 'react';
import { TYPE_MAX_MS } from '@ahmed-moghazy/shared';

export function useTypewriter(total: number, enabled: boolean) {
  const [budget, setBudget] = useState(enabled ? 0 : total);
  const complete = useCallback(() => setBudget(total), [total]);
  useEffect(() => {
    if (!enabled || total === 0) { setBudget(total); return; }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const next = Math.min(total, Math.floor((now - start) * Math.max(total / TYPE_MAX_MS, 60 / 1000)));
      setBudget(next);
      if (next < total) frame = requestAnimationFrame(tick);
    };
    setBudget(0);
    frame = requestAnimationFrame(tick);
    window.addEventListener('keydown', complete);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', complete); };
  }, [enabled, total, complete]);
  return { budget: enabled ? budget : total, complete };
}
