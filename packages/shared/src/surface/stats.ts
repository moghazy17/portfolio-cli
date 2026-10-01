export type SurfaceEventKind = 'curl_requests' | 'curl_rate_limited' | 'deep_links';

export interface SurfaceStatsClient {
  hincrby(key: string, field: SurfaceEventKind, n: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, unknown> | null>;
}

const STATS_TTL = 60 * 60 * 24 * 90;

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function statsKey(now: Date): string {
  return `surface:stats:${dateKey(now)}`;
}

export async function recordSurfaceEvent(
  client: SurfaceStatsClient | null,
  kind: SurfaceEventKind,
  now = new Date(),
): Promise<void> {
  if (!client) return;
  const key = statsKey(now);
  try {
    if (await client.hincrby(key, kind, 1) === 1) await client.expire(key, STATS_TTL);
  } catch (error) {
    console.error('[surface] failed to record event:', error);
  }
}

export async function readSurfaceStats(
  client: SurfaceStatsClient | null,
  days: number,
  now = new Date(),
): Promise<{ daily: Array<{ date: string; curl_requests: number; curl_rate_limited: number; deep_links: number }> } | null> {
  if (!client) return null;
  const dates = Array.from({ length: Math.max(0, days) }, (_, index) =>
    new Date(now.getTime() - index * 86_400_000),
  );
  try {
    const values = await Promise.all(dates.map((date) => client.hgetall(statsKey(date))));
    return {
      daily: dates.map((date, index) => {
        const counts = values[index] ?? {};
        return {
          date: dateKey(date),
          curl_requests: Number(counts.curl_requests ?? 0),
          curl_rate_limited: Number(counts.curl_rate_limited ?? 0),
          deep_links: Number(counts.deep_links ?? 0),
        };
      }),
    };
  } catch (error) {
    console.error('[surface] failed to read stats:', error);
    return null;
  }
}
