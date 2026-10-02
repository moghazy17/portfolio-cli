import type { SignReason } from '../types';
import { containsBlockedWord } from './blocklist';

export const GUESTBOOK_LIMITS = { name: 24, message: 140 } as const;

export const SIGN_MESSAGES: Record<SignReason, string> = {
  empty: "Name and message can't be empty.",
  too_long: 'Keep it short: name up to 24 characters, message up to 140.',
  link: "Links aren't allowed in the guestbook.",
  contact: "Please don't share emails or phone numbers here.",
  blocked: "That message can't be posted. Try different words.",
  human_check: "Couldn't confirm you're human. Please try again.",
  rate_limited: "You've already signed today — thanks! Try again tomorrow.",
  daily_cap: 'The guestbook is full for today. Try again tomorrow.',
  unavailable: "Guestbook unavailable right now. Your message wasn't lost — press ↑ to retry.",
  bad_request: 'Could not read that signature. Please try again.',
};

export type GuestbookValidation =
  | { ok: true; name: string; message: string }
  | { ok: false; reason: 'empty' | 'too_long' | 'link' | 'contact' | 'blocked'; message: string };

export function sanitizeGuestbookText(value: string): string {
  return value.normalize('NFKC')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/gu, ' ').trim();
}

export function validateGuestbookEntry(input: { name: string; message: string }): GuestbookValidation {
  const name = sanitizeGuestbookText(input.name);
  const message = sanitizeGuestbookText(input.message);
  const reason = !name || !message ? 'empty'
    : [...name].length > GUESTBOOK_LIMITS.name || [...message].length > GUESTBOOK_LIMITS.message ? 'too_long'
    : /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i.test(`${name} ${message}`) || /(?:\+?\d[\d\s().-]*){7,}/.test(`${name} ${message}`) ? 'contact'
    : /https?:\/\/\S+|www\.\S+|\b[\w-]+\.(?:com|net|org|io|dev|me|ai|co|xyz|app|edu|gov)\b/i.test(`${name} ${message}`) ? 'link'
    : containsBlockedWord(name) || containsBlockedWord(message) ? 'blocked' : null;
  return reason ? { ok: false, reason, message: SIGN_MESSAGES[reason] } : { ok: true, name, message };
}
