export type SurfaceEventKind = 'curl_requests' | 'curl_rate_limited' | 'deep_links' | 'gui_visits' | 'guestbook_signed' | 'guestbook_rejected'
  | 'suggestion_taps' | 'tours_started' | 'tours_completed' | 'shortcut_sheet_opens' | 'command_sheet_opens';

export interface SurfaceDay {
  date: string;
  curl_requests: number;
  curl_rate_limited: number;
  deep_links: number;
  gui_visits: number;
  guestbook_signed: number;
  guestbook_rejected: number;
  suggestion_taps: number;
  tours_started: number;
  tours_completed: number;
  shortcut_sheet_opens: number;
  command_sheet_opens: number;
  presence_peak: number;
}

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
): Promise<{ daily: SurfaceDay[] } | null> {
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
          gui_visits: Number(counts.gui_visits ?? 0),
          guestbook_signed: Number(counts.guestbook_signed ?? 0),
          guestbook_rejected: Number(counts.guestbook_rejected ?? 0),
          suggestion_taps: Number(counts.suggestion_taps ?? 0),
          tours_started: Number(counts.tours_started ?? 0),
          tours_completed: Number(counts.tours_completed ?? 0),
          shortcut_sheet_opens: Number(counts.shortcut_sheet_opens ?? 0),
          command_sheet_opens: Number(counts.command_sheet_opens ?? 0),
          presence_peak: Number(counts.presence_peak ?? 0),
        };
      }),
    };
  } catch (error) {
    console.error('[surface] failed to read stats:', error);
    return null;
  }
}
