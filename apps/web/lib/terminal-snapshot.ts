import type { TerminalEntry } from '../hooks/useTerminal';

export interface TerminalSnapshot {
  history: TerminalEntry[];
  cwd: string;
  prompt: string;
}

// Client-side navigation keeps this module alive, so the terminal can pick up where it left off
// after a trip to /gui. A full page load starts empty.
let snapshot: TerminalSnapshot | null = null;

export function saveSnapshot(next: TerminalSnapshot): void {
  snapshot = next;
}

/** Reads the snapshot without consuming it, so a re-rendered or re-mounted terminal sees the same one. */
export function peekSnapshot(): TerminalSnapshot | null {
  return snapshot;
}

export function takeSnapshot(): TerminalSnapshot | null {
  const taken = snapshot;
  snapshot = null;
  return taken;
}
