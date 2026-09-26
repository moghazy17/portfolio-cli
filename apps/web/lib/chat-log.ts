import { redis } from './redis';
import { APICallError, RetryError } from 'ai';

// requests       — every chat message that reached the model call
// rate_limited   — blocked by our own per-IP limiter (Upstash)
// quota_exceeded — the model provider rejected the request for quota or rate limits
// error          — any other model/provider failure
export type ChatEventKind = 'requests' | 'rate_limited' | 'quota_exceeded' | 'error';

const STATS_PREFIX = 'chat:stats:';
const EVENTS_KEY = 'chat:events';
const STATS_TTL = 60 * 60 * 24 * 90; // keep daily counters for 90 days
const MAX_EVENTS = 200;

function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
}

export function classifyError(error: unknown): { kind: ChatEventKind; status?: number; message: string } {
  // streamText retries retryable failures (like 429) and wraps them in RetryError
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  const status = APICallError.isInstance(cause) ? cause.statusCode : undefined;
  const data = APICallError.isInstance(cause) ? cause.data : undefined;
  const providerCode = typeof data === 'object' && data !== null && 'error' in data
    && typeof data.error === 'object' && data.error !== null && 'code' in data.error
    ? data.error.code
    : undefined;
  const isQuotaError = status === 429
    || providerCode === 'insufficient_quota'
    || providerCode === 'rate_limit_exceeded';
  const message = cause instanceof Error ? cause.message : String(cause);
  return { kind: isQuotaError ? 'quota_exceeded' : 'error', status, message: message.slice(0, 300) };
}

export async function logChatEvent(
  kind: ChatEventKind,
  detail?: { status?: number; message?: string },
): Promise<void> {
  if (kind !== 'requests') {
    console.error(`[chat] ${kind}`, detail ?? '');
  }
  if (!redis) return;

  const statsKey = STATS_PREFIX + today();
  try {
    const pipe = redis.pipeline();
    pipe.hincrby(statsKey, kind, 1);
    pipe.expire(statsKey, STATS_TTL);
    if (kind !== 'requests') {
      pipe.lpush(EVENTS_KEY, JSON.stringify({ at: new Date().toISOString(), kind, ...detail }));
      pipe.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
    }
    await pipe.exec();
  } catch (err) {
    // Logging must never break chat
    console.error('[chat] failed to record event:', err);
  }
}

export async function getChatStats(days: number) {
  if (!redis) return null;

  const dates = Array.from({ length: days }, (_, i) =>
    new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
  );
  const pipe = redis.pipeline();
  for (const d of dates) pipe.hgetall(STATS_PREFIX + d);
  pipe.lrange(EVENTS_KEY, 0, 49);
  const results = await pipe.exec();

  const daily = dates.map((date, i) => {
    const counts = (results[i] ?? {}) as Record<string, number>;
    return {
      date,
      requests: Number(counts.requests ?? 0),
      rate_limited: Number(counts.rate_limited ?? 0),
      quota_exceeded: Number(counts.quota_exceeded ?? 0),
      error: Number(counts.error ?? 0),
    };
  });
  const recentEvents = results[dates.length] as unknown[];

  return { daily, recentEvents };
}
