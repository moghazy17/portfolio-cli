import { describe, expect, it } from 'vitest';
import { formatRelative } from '../src/guestbook/time';

describe('relative guestbook time', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  it.each([
    [0, 'just now'], [59, 'just now'], [60, '1 minute ago'], [300, '5 minutes ago'],
    [3600, '1 hour ago'], [10800, '3 hours ago'], [86400, '1 day ago'],
    [259200, '3 days ago'], [2592000, '1 month ago'], [5184000, '2 months ago'],
  ])('%i seconds becomes %s', (seconds, expected) => {
    expect(formatRelative(new Date(now.getTime() - seconds * 1000).toISOString(), now)).toBe(expected);
  });
});
