import { useEffect, useState } from 'react';
import type { PresenceCount } from '@ahmed-moghazy/shared';

let fallbackId: string | null = null;

function sessionId(): string {
  if (!fallbackId) fallbackId = crypto.randomUUID();
  try {
    const stored = sessionStorage.getItem('presence:sid');
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored;
    sessionStorage.setItem('presence:sid', fallbackId);
  } catch { /* Use the in-memory id. */ }
  return fallbackId;
}

/** Live visitor count with 30 s heartbeats; `enabled` lets a page that already beats skip a second loop. */
export function usePresence(enabled = true): PresenceCount | null {
  const [count, setCount] = useState<PresenceCount | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const sid = sessionId();
    let mounted = true;
    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/presence', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sid, surface: 'web' }), cache: 'no-store',
        });
        if (!response.ok) throw Error('Presence unavailable');
        const value = await response.json() as PresenceCount;
        if (mounted) setCount(value);
      } catch { if (mounted) setCount(null); }
    };
    void beat();
    const timer = window.setInterval(() => { void beat(); }, 30_000);
    const visible = () => { if (document.visibilityState === 'visible') void beat(); };
    document.addEventListener('visibilitychange', visible);
    return () => { mounted = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [enabled]);
  return count;
}
