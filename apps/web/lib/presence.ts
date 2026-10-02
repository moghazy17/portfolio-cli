import type { PresenceCount } from '@ahmed-moghazy/shared';
import { redis } from './redis';

const key = 'presence:web';
const windowMs = 60_000;

function result(total: number, now: number): PresenceCount {
  return { total, bySurface: { web: total }, at: new Date(now).toISOString() };
}

export async function heartbeat(sid: string): Promise<PresenceCount | null> {
  if (!redis) return null;
  const now = Date.now();
  const values = await redis.pipeline()
    .zadd(key, { score: now, member: sid })
    .zremrangebyscore(key, '-inf', now - windowMs)
    .zcard(key)
    .expire(key, 120)
    .exec();
  const total = Number(values[2]);
  const statsKey = `surface:stats:${new Date(now).toISOString().slice(0, 10)}`;
  await redis.eval(
    "local old=tonumber(redis.call('HGET', KEYS[1], 'presence_peak') or '0'); if tonumber(ARGV[1]) > old then redis.call('HSET', KEYS[1], 'presence_peak', ARGV[1]); redis.call('EXPIRE', KEYS[1], 7776000); end; return 1",
    [statsKey], [total],
  );
  return result(total, now);
}

export async function count(): Promise<PresenceCount | null> {
  if (!redis) return null;
  const now = Date.now();
  const values = await redis.pipeline().zremrangebyscore(key, '-inf', now - windowMs).zcard(key).exec();
  return result(Number(values[1]), now);
}
