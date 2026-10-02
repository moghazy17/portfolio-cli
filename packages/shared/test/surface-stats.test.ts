import { describe, expect, it, vi } from 'vitest';
import { readSurfaceStats, recordSurfaceEvent, type SurfaceStatsClient } from '../src/surface/stats';

class RecordingClient implements SurfaceStatsClient {
  writes: Array<{ key: string; field: string; amount: number }> = [];
  expirations: Array<{ key: string; seconds: number }> = [];
  values = new Map<string, Record<string, unknown>>();

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    this.writes.push({ key, field, amount });
    const values = this.values.get(key) ?? {};
    const next = Number(values[field] ?? 0) + amount;
    values[field] = next;
    this.values.set(key, values);
    return next;
  }

  async expire(key: string, seconds: number): Promise<unknown> {
    this.expirations.push({ key, seconds });
    return 1;
  }

  async hgetall(key: string): Promise<Record<string, unknown> | null> {
    return this.values.get(key) ?? null;
  }
}

describe('surface stats', () => {
  it('uses daily aggregate keys and fixed counter fields only', async () => {
    const client = new RecordingClient();
    const now = new Date('2026-10-01T12:00:00.000Z');

    await recordSurfaceEvent(client, 'curl_requests', now);
    await recordSurfaceEvent(client, 'curl_rate_limited', now);
    await recordSurfaceEvent(client, 'deep_links', now);
    await recordSurfaceEvent(client, 'gui_visits', now);
    await recordSurfaceEvent(client, 'guestbook_signed', now);
    await recordSurfaceEvent(client, 'guestbook_rejected', now);
    await recordSurfaceEvent(client, 'suggestion_taps', now);
    await recordSurfaceEvent(client, 'tours_started', now);
    await recordSurfaceEvent(client, 'tours_completed', now);
    await recordSurfaceEvent(client, 'shortcut_sheet_opens', now);

    expect(client.writes.map((write) => write.key)).toEqual(Array(10).fill('surface:stats:2026-10-01'));
    expect(new Set(client.writes.map((write) => write.key))).toEqual(new Set(['surface:stats:2026-10-01']));
    expect(client.writes.every((write) => /^surface:stats:\d{4}-\d{2}-\d{2}$/.test(write.key))).toBe(true);
    expect(new Set(client.writes.map((write) => write.field))).toEqual(new Set(['curl_requests', 'curl_rate_limited', 'deep_links', 'gui_visits', 'guestbook_signed', 'guestbook_rejected', 'suggestion_taps', 'tours_started', 'tours_completed', 'shortcut_sheet_opens']));
    expect(client.writes.every((write) => !/(?:\d{1,3}\.){3}\d{1,3}|\/|\?/.test(`${write.key}:${write.field}`))).toBe(true);
  });

  it('sets a TTL once per day', async () => {
    const client = new RecordingClient();
    await recordSurfaceEvent(client, 'deep_links', new Date('2026-10-01T12:00:00.000Z'));
    await recordSurfaceEvent(client, 'deep_links', new Date('2026-10-01T13:00:00.000Z'));
    await recordSurfaceEvent(client, 'deep_links', new Date('2026-10-02T00:00:00.000Z'));

    expect(client.expirations).toEqual([
      { key: 'surface:stats:2026-10-01', seconds: 60 * 60 * 24 * 90 },
      { key: 'surface:stats:2026-10-02', seconds: 60 * 60 * 24 * 90 },
    ]);
  });

  it('fails open when recording fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client: SurfaceStatsClient = {
      hincrby: async () => { throw new Error('unavailable'); },
      expire: async () => 1,
      hgetall: async () => null,
    };

    await expect(recordSurfaceEvent(client, 'deep_links')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('[surface] failed to record event:', expect.any(Error));
    error.mockRestore();
  });

  it('reads zero-filled UTC daily aggregates', async () => {
    const client = new RecordingClient();
    await recordSurfaceEvent(client, 'curl_requests', new Date('2026-10-01T12:00:00.000Z'));

    await expect(readSurfaceStats(client, 2, new Date('2026-10-02T12:00:00.000Z'))).resolves.toEqual({
      daily: [
        { date: '2026-10-02', curl_requests: 0, curl_rate_limited: 0, deep_links: 0, gui_visits: 0, guestbook_signed: 0, guestbook_rejected: 0, suggestion_taps: 0, tours_started: 0, tours_completed: 0, shortcut_sheet_opens: 0, presence_peak: 0 },
        { date: '2026-10-01', curl_requests: 1, curl_rate_limited: 0, deep_links: 0, gui_visits: 0, guestbook_signed: 0, guestbook_rejected: 0, suggestion_taps: 0, tours_started: 0, tours_completed: 0, shortcut_sheet_opens: 0, presence_peak: 0 },
      ],
    });
  });

  it('does nothing without a Redis client', async () => {
    await expect(recordSurfaceEvent(null, 'deep_links')).resolves.toBeUndefined();
    await expect(readSurfaceStats(null, 1)).resolves.toBeNull();
  });
});
