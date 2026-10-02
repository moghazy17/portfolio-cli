import { describe, expect, it } from 'vitest';
import { SIGN_MESSAGES, validateGuestbookEntry } from '../src/guestbook/validate';

const check = (name: string, message: string) => validateGuestbookEntry({ name, message });

describe('guestbook validation', () => {
  it('normalizes text and removes controls and bidi overrides', () => {
    expect(check('  Ｓａｍ\u202e ', ' hi\nthere\t\u001b[31m ')).toEqual({ ok: true, name: 'Sam', message: 'hi there [31m' });
  });

  it('requires both fields and counts Unicode code points', () => {
    expect(check(' ', 'hi')).toMatchObject({ ok: false, reason: 'empty' });
    expect(check('Sam', '  ')).toMatchObject({ ok: false, reason: 'empty' });
    expect(check('a'.repeat(24), '😀'.repeat(140))).toMatchObject({ ok: true });
    expect(check('a'.repeat(25), 'hi')).toMatchObject({ ok: false, reason: 'too_long' });
    expect(check('Sam', '😀'.repeat(141))).toMatchObject({ ok: false, reason: 'too_long' });
  });

  it.each(['http://x.y', 'www.x', 'example.com', 'foo.dev'])('rejects a link: %s', (message) => {
    expect(check('Sam', message)).toMatchObject({ ok: false, reason: 'link' });
  });

  it('does not treat a single-letter suffix as a link', () => {
    expect(check('Sam', 'a.y')).toMatchObject({ ok: true });
    expect(check('Sam', 'foo.dev')).toMatchObject({ ok: false, reason: 'link' });
  });

  it.each(['a@b.co', '+20 100 123 4567', '(555) 123-4567'])('rejects contact information: %s', (message) => {
    expect(check('Sam', message)).toMatchObject({ ok: false, reason: 'contact' });
  });

  it.each(['2026', 'v1.2'])('allows ordinary numbers: %s', (message) => {
    expect(check('Sam', message)).toMatchObject({ ok: true });
  });

  it.each(['spam', 'SPAM', 'sp4m', 'spppaaammm'])('blocks an abusive word: %s', (message) => {
    expect(check('Sam', message)).toMatchObject({ ok: false, reason: 'blocked' });
  });

  it('checks word boundaries', () => {
    expect(check('Sam', 'spamming')).toMatchObject({ ok: true });
  });

  it('maps every refusal to a message', () => {
    for (const reason of ['empty', 'too_long', 'link', 'contact', 'blocked', 'human_check', 'rate_limited', 'daily_cap', 'unavailable']) {
      expect(SIGN_MESSAGES[reason as keyof typeof SIGN_MESSAGES]).toBeTruthy();
    }
  });
});
