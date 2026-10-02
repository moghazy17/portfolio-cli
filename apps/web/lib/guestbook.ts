import { createHash, webcrypto } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { sanitizeGuestbookText, SIGN_MESSAGES, validateGuestbookEntry } from '@ahmed-moghazy/shared';
import type { GuestbookEntry, SignReason, SignResult } from '@ahmed-moghazy/shared';
import { redis } from './redis';
import { recordSurfaceEvent } from './surface-stats';
import { verifyTurnstile } from './turnstile';

const key = 'guestbook:v1';
const visitorLimiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(1, '1 d'), prefix: 'rl:guestbook' }) : null;
const siteLimiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(200, '1 d'), prefix: 'rl:guestbook-all' }) : null;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function refusal(reason: SignReason): SignResult {
  if (reason !== 'unavailable') void recordSurfaceEvent('guestbook_rejected');
  return { ok: false, reason, message: SIGN_MESSAGES[reason] };
}

function parseEntry(raw: unknown): GuestbookEntry | null {
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value) || !('message' in value) || !('at' in value)
      || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.message !== 'string' || typeof value.at !== 'string') return null;
    return { id: value.id, name: sanitizeGuestbookText(value.name), message: sanitizeGuestbookText(value.message), at: value.at };
  } catch { return null; }
}

export async function listEntries(limit = 20): Promise<GuestbookEntry[] | null> {
  if (!redis) return null;
  const raw = await redis.lrange(key, 0, Math.min(200, Math.max(0, limit)) - 1);
  return raw.map(parseEntry).filter((entry): entry is GuestbookEntry => entry !== null);
}

export async function signEntry(input: { name: string; message: string; token: string; ip: string }): Promise<SignResult> {
  const checked = validateGuestbookEntry(input);
  if (!checked.ok) return refusal(checked.reason);
  if (!await verifyTurnstile(input.token, input.ip)) return refusal('human_check');
  if (!visitorLimiter || !siteLimiter || !redis || (process.env.NODE_ENV === 'production' && !process.env.GUESTBOOK_SALT)) return refusal('unavailable');
  try {
    const identity = createHash('sha256').update((process.env.GUESTBOOK_SALT ?? 'local-guestbook-salt') + input.ip).digest('hex');
    const visitor = await visitorLimiter.limit(identity);
    if (visitor.reason === 'timeout') return refusal('unavailable');
    if (!visitor.success) return refusal('rate_limited');
    const site = await siteLimiter.limit('all');
    if (site.reason === 'timeout') return refusal('unavailable');
    if (!site.success) return refusal('daily_cap');
  } catch (error) {
    console.error('[guestbook] limiter unavailable:', error);
    return refusal('unavailable');
  }
  const bytes = new Uint8Array(12);
  webcrypto.getRandomValues(bytes);
  const entry: GuestbookEntry = {
    id: Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(''),
    name: checked.name, message: checked.message, at: new Date().toISOString(),
  };
  try {
    await redis.pipeline().lpush(key, JSON.stringify(entry)).ltrim(key, 0, 199).exec();
    await recordSurfaceEvent('guestbook_signed');
    return { ok: true, entry };
  } catch (error) {
    console.error('[guestbook] write failed:', error);
    return refusal('unavailable');
  }
}

export async function deleteEntry(id: string): Promise<boolean | null> {
  if (!redis) return null;
  const raw = await redis.lrange<string>(key, 0, 199);
  const match = raw.find((item) => parseEntry(item)?.id === id);
  if (match === undefined) return false;
  await redis.lrem(key, 1, match);
  return true;
}
