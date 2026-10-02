import { Ratelimit } from '@upstash/ratelimit';
import { rateLimitedResponse } from '@ahmed-moghazy/shared';
import { resolveVisitorIp } from '@ahmed-moghazy/shared/assistant-server';
import { count, heartbeat } from '../../../lib/presence';
import { redis } from '../../../lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const limiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:presence' }) : null;
const headers = { 'Cache-Control': 'no-store' };
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function limited(request: Request): Promise<Response | null> {
  const answer = await rateLimitedResponse(limiter, resolveVisitorIp(request.headers, undefined));
  return answer ? Response.json({ error: 'rate_limited' }, { status: 429, headers: { ...headers, 'Retry-After': String(answer.retryAfter) } }) : null;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'bad_request' }, { status: 400, headers }); }
  if (!body || typeof body !== 'object' || !('sid' in body) || typeof body.sid !== 'string' || !uuidV4.test(body.sid) || !('surface' in body) || body.surface !== 'web') {
    return Response.json({ error: 'bad_request' }, { status: 400, headers });
  }
  if (!redis) return Response.json({ error: 'unavailable' }, { status: 503, headers });
  const rejected = await limited(request);
  if (rejected) return rejected;
  try { return Response.json(await heartbeat(body.sid), { headers }); }
  catch { return Response.json({ error: 'unavailable' }, { status: 503, headers }); }
}

export async function GET(request: Request): Promise<Response> {
  if (!redis) return Response.json({ error: 'unavailable' }, { status: 503, headers });
  const rejected = await limited(request);
  if (rejected) return rejected;
  try { return Response.json(await count(), { headers }); }
  catch { return Response.json({ error: 'unavailable' }, { status: 503, headers }); }
}
