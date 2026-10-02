import { createHash, timingSafeEqual } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { rateLimitedResponse } from '@ahmed-moghazy/shared';
import { resolveVisitorIp } from '@ahmed-moghazy/shared/assistant-server';
import { deleteEntry } from '../../../../lib/guestbook';
import { redis } from '../../../../lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const limiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:guestbook-admin' }) : null;
const digest = (value: string) => createHash('sha256').update(value).digest();
const headers = { 'Cache-Control': 'no-store' };

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return Response.json({ error: 'not_found' }, { status: 404, headers });
  const limited = await rateLimitedResponse(limiter, resolveVisitorIp(request.headers, undefined));
  if (limited) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { ...headers, 'Retry-After': String(limited.retryAfter) } });
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ') || !timingSafeEqual(digest(bearer.slice(7)), digest(token))) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  if (!redis) return Response.json({ error: 'unavailable' }, { status: 503, headers });
  try {
    const deleted = await deleteEntry((await context.params).id);
    return deleted ? new Response(null, { status: 204, headers }) : Response.json({ error: 'not_found' }, { status: 404, headers });
  } catch { return Response.json({ error: 'unavailable' }, { status: 503, headers }); }
}
