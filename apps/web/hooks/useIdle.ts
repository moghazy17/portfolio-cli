'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useIdle(ms: number, enabled: boolean) {
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  const reset = useCallback(() => { idleRef.current = false; setIdle(false); }, []);
  useEffect(() => {
    if (!enabled) { idleRef.current = false; setIdle(false); return; }
    let timer: ReturnType<typeof setTimeout>;
    const activity = (event?: Event) => {
      if (idleRef.current && event instanceof KeyboardEvent && event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      idleRef.current = false;
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => { idleRef.current = true; setIdle(true); }, ms);
    };
    activity();
    const events = ['keydown', 'pointermove', 'pointerdown', 'wheel', 'scroll', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, activity, true));
    return () => { clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, activity, true)); };
  }, [ms, enabled]);
  return { idle, reset };
}
