import type { QuestionLogEntry } from '@ahmed-moghazy/shared/assistant-server';
import { redis } from './redis';

export type { QuestionLogEntry };

const KEY_PREFIX = 'assistant:log:';
const RETENTION_DAYS = 30;
const MAX_ENTRIES = 500;
const DAY_MS = 86_400_000;

const dayKey = (date: Date) => KEY_PREFIX + date.toISOString().slice(0, 10); // UTC YYYY-MM-DD

/** Best effort: a failed write is logged and never reaches the visitor. */
export async function logQuestion(entry: QuestionLogEntry): Promise<void> {
  if (!redis) return;

  try {
    const now = new Date(entry.at);
    const day = Number.isNaN(now.getTime()) ? new Date() : now;
    const key = dayKey(day);
    // One fixed expiry per day key, so early entries never outlive the retention window.
    const dayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
    const expireAt = Math.floor((dayStart + RETENTION_DAYS * DAY_MS) / 1000);

    const pipe = redis.pipeline();
    pipe.lpush(key, JSON.stringify(entry));
    pipe.expireat(key, expireAt);
    await pipe.exec();
  } catch (err) {
    console.error('[assistant] failed to log question:', err);
  }
}

/** Entries from the last `days` UTC days, newest first, at most 500. Null when Redis is unset. */
export async function getQuestionLog(days: number): Promise<QuestionLogEntry[] | null> {
  if (!redis) return null;

  const span = Math.min(Math.max(Math.floor(days) || 1, 1), RETENTION_DAYS);
  const keys = Array.from({ length: span }, (_, i) => dayKey(new Date(Date.now() - i * DAY_MS)));
  const pipe = redis.pipeline();
  for (const key of keys) pipe.lrange(key, 0, MAX_ENTRIES - 1);
  const results = await pipe.exec();

  // Each list is newest first and the keys run newest day first, so concatenation stays ordered.
  const entries: QuestionLogEntry[] = [];
  for (const raw of results as unknown[][]) {
    for (const item of raw ?? []) {
      // The client may already have parsed the JSON.
      entries.push(typeof item === 'string' ? JSON.parse(item) : (item as QuestionLogEntry));
    }
  }
  return entries.slice(0, MAX_ENTRIES);
}
