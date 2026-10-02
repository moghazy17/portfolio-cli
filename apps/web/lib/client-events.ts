import type { SurfaceEventKind } from '@ahmed-moghazy/shared';

export function recordClientEvent(kind: Extract<SurfaceEventKind, 'suggestion_taps' | 'tours_started' | 'tours_completed' | 'shortcut_sheet_opens'>): void {
  try {
    void fetch('/api/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }), keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Metrics must never interrupt the terminal.
  }
}
