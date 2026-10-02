import type { NextRequest } from 'next/server';

export const VIEW_COOKIE = 'view';

export type View = 'gui' | 'terminal';

const SEEN_KEY = 'gui:seen';

export function setViewCookie(view: View): void {
  try {
    document.cookie = `${VIEW_COOKIE}=${view}; Max-Age=31536000; Path=/; SameSite=Lax`;
  } catch {
    // Cookies can be blocked; the visitor just lands on the terminal next time.
  }
}

export function readViewCookie(request: NextRequest): View | undefined {
  const value = request.cookies.get(VIEW_COOKIE)?.value;
  return value === 'gui' || value === 'terminal' ? value : undefined;
}

/** Remembers that the visitor has used a view switch, so the terminal's GUI button stops shouting. */
export function markGuiSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage can be blocked; the button stays prominent.
  }
}

export function hasSeenGui(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
