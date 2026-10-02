import { Ratelimit } from '@upstash/ratelimit';
import { rateLimitedResponse, SIGN_MESSAGES } from '@ahmed-moghazy/shared';
import type { SignReason } from '@ahmed-moghazy/shared';
import { resolveVisitorIp } from '@ahmed-moghazy/shared/assistant-server';
import { listEntries, signEntry } from '../../../lib/guestbook';
import { redis } from '../../../lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const readLimiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:guestbook-read' }) : null;
const headers = { 'Cache-Control': 'no-store' };
const fail = (reason: SignReason, status: number) => Response.json({ ok: false, reason, message: SIGN_MESSAGES[reason] }, { status, headers });

export async function GET(request: Request): Promise<Response> {
  if (!redis) return Response.json({ error: 'unavailable' }, { status: 503, headers });
  const limited = await rateLimitedResponse(readLimiter, resolveVisitorIp(request.headers, undefined));
  if (limited) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { ...headers, 'Retry-After': String(limited.retryAfter) } });
  try { return Response.json({ entries: await listEntries() }, { headers }); }
  catch { return Response.json({ error: 'unavailable' }, { status: 503, headers }); }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2048) return fail('bad_request', 400);
    body = JSON.parse(raw);
  } catch { return fail('bad_request', 400); }
  if (!body || typeof body !== 'object' || !('name' in body) || !('message' in body)
    || typeof body.name !== 'string' || typeof body.message !== 'string'
    || !('turnstileToken' in body) || typeof body.turnstileToken !== 'string') return fail('bad_request', 400);
  const result = await signEntry({ name: body.name, message: body.message, token: body.turnstileToken, ip: resolveVisitorIp(request.headers, undefined) });
  if (result.ok) return Response.json(result, { status: 201, headers });
  const status = result.reason === 'human_check' ? 403
    : ['empty', 'too_long', 'link', 'contact', 'blocked'].includes(result.reason) ? 422
    : ['rate_limited', 'daily_cap'].includes(result.reason) ? 429 : 503;
  return Response.json(result, { status, headers });
}
