import { afterEach, describe, expect, it, vi } from 'vitest';

const compare = vi.hoisted(() => vi.fn());

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  compare.mockImplementation(actual.timingSafeEqual);
  return { ...actual, timingSafeEqual: compare };
});

import { resolveVisitorIp } from '../src/assistant/server/identity';

const TOKEN = 'relay-secret-value';

describe('resolveVisitorIp', () => {
  afterEach(() => compare.mockClear());

  it('uses the relay IP when the bearer token matches', () => {
    const h = new Headers({
      authorization: `Bearer ${TOKEN}`,
      'x-assistant-client-ip': '203.0.113.7',
      'x-real-ip': '198.51.100.1',
    });
    expect(resolveVisitorIp(h, TOKEN)).toBe('203.0.113.7');
  });

  it('accepts an IPv6 relay address', () => {
    const h = new Headers({ authorization: `Bearer ${TOKEN}`, 'x-assistant-client-ip': '2001:db8::1' });
    expect(resolveVisitorIp(h, TOKEN)).toBe('2001:db8::1');
  });

  it('ignores the header when the bearer token is wrong', () => {
    const h = new Headers({
      authorization: 'Bearer not-the-secret-vv',
      'x-assistant-client-ip': '203.0.113.7',
      'x-real-ip': '198.51.100.1',
    });
    expect(resolveVisitorIp(h, TOKEN)).toBe('198.51.100.1');
  });

  it('ignores the header when the bearer token is missing', () => {
    const h = new Headers({ 'x-assistant-client-ip': '203.0.113.7', 'x-real-ip': '198.51.100.1' });
    expect(resolveVisitorIp(h, TOKEN)).toBe('198.51.100.1');
  });

  it('falls back to the first x-forwarded-for hop without x-real-ip', () => {
    const h = new Headers({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' });
    expect(resolveVisitorIp(h, TOKEN)).toBe('198.51.100.2');
  });

  it('disables the relay when the token is unset', () => {
    const h = new Headers({
      authorization: 'Bearer ',
      'x-assistant-client-ip': '203.0.113.7',
      'x-real-ip': '198.51.100.1',
    });
    expect(resolveVisitorIp(h, undefined)).toBe('198.51.100.1');
    expect(resolveVisitorIp(h, '')).toBe('198.51.100.1');
  });

  it('ignores a relay header value that is not an IP', () => {
    const h = new Headers({
      authorization: `Bearer ${TOKEN}`,
      'x-assistant-client-ip': 'not-an-ip',
      'x-real-ip': '198.51.100.1',
    });
    expect(resolveVisitorIp(h, TOKEN)).toBe('198.51.100.1');
  });

  it('returns a stable placeholder when no address is available', () => {
    expect(resolveVisitorIp(new Headers(), TOKEN)).toBe('unknown');
  });

  it('compares tokens with timingSafeEqual over equal-length buffers', () => {
    const h = new Headers({ authorization: 'Bearer short', 'x-assistant-client-ip': '203.0.113.7' });
    resolveVisitorIp(h, TOKEN);
    expect(compare).toHaveBeenCalledTimes(1);
    const [a, b] = compare.mock.calls[0] as [Buffer, Buffer];
    expect(a.length).toBe(b.length);
  });
});
