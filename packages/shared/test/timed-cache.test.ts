import { describe, expect, it, vi } from 'vitest';
import { createTimedCache } from '../src/timed-cache';

describe('timed cache', () => {
  it('coalesces concurrent cold requests', async () => {
    let finish: (value: number) => void = () => {};
    const fetcher = vi.fn(() => new Promise<number>((resolve) => { finish = resolve; }));
    const cache = createTimedCache(fetcher, { freshnessMs: 600_000, cooldownMs: 60_000, timeoutMs: 5_000 });
    const signal = new AbortController().signal;
    const calls = Array.from({ length: 12 }, () => cache.get(signal));
    expect(fetcher).toHaveBeenCalledOnce();
    finish(42);
    expect(await Promise.all(calls)).toEqual(Array(12).fill(42));
    expect(await cache.get(signal)).toBe(42);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('holds failed cold calls during cooldown', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(async () => { throw new Error('offline'); });
      const cache = createTimedCache(fetcher, { freshnessMs: 600_000, cooldownMs: 60_000, timeoutMs: 5_000 });
      const signal = new AbortController().signal;
      await expect(cache.get(signal)).rejects.toThrow('temporarily unavailable');
      await expect(cache.get(signal)).rejects.toThrow('temporarily unavailable');
      expect(fetcher).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(60_000);
      await expect(cache.get(signal)).rejects.toThrow('temporarily unavailable');
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('serves stale data after a failed refresh', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn().mockResolvedValueOnce(42).mockRejectedValueOnce(new Error('offline'));
      const cache = createTimedCache<number>(fetcher, { freshnessMs: 600_000, cooldownMs: 60_000, timeoutMs: 5_000 });
      const signal = new AbortController().signal;
      expect(await cache.get(signal)).toBe(42);
      await vi.advanceTimersByTimeAsync(600_000);
      expect(await cache.get(signal)).toBe(42);
      expect(await cache.get(signal)).toBe(42);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out an unresponsive fetch', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn((_signal: AbortSignal) => new Promise<number>(() => {}));
      const cache = createTimedCache(fetcher, { freshnessMs: 600_000, cooldownMs: 60_000, timeoutMs: 5_000 });
      const promise = cache.get(new AbortController().signal);
      const assertion = expect(promise).rejects.toThrow('temporarily unavailable');
      await vi.advanceTimersByTimeAsync(5_000);
      await assertion;
      expect(fetcher.mock.calls[0][0].aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a shared refresh alive when one caller goes away', async () => {
    let finish: (value: number) => void = () => {};
    const fetcher = vi.fn((_signal: AbortSignal) => new Promise<number>((resolve) => { finish = resolve; }));
    const cache = createTimedCache(fetcher, { freshnessMs: 600_000, cooldownMs: 60_000, timeoutMs: 5_000 });
    const leaving = new AbortController();
    const first = cache.get(leaving.signal);
    const second = cache.get(new AbortController().signal);
    leaving.abort();
    await expect(first).rejects.toThrow('temporarily unavailable');
    expect(fetcher.mock.calls[0][0].aborted).toBe(false);
    finish(7);
    expect(await second).toBe(7);
    expect(await cache.get(new AbortController().signal)).toBe(7);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
