import { Ratelimit } from '@upstash/ratelimit';
import { rateLimitedResponse, type SurfaceEventKind } from '@ahmed-moghazy/shared';
import { resolveVisitorIp } from '@ahmed-moghazy/shared/assistant-server';
import { redis } from '../../../lib/redis';
import { recordSurfaceEvent } from '../../../lib/surface-stats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const allowed = new Set<SurfaceEventKind>(['suggestion_taps', 'tours_started', 'tours_completed', 'shortcut_sheet_opens', 'command_sheet_opens']);
const limiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'rl:events' }) : null;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'bad_request' }, { status: 400 }); }
  const kind = body && typeof body === 'object' && 'kind' in body ? body.kind : null;
  if (typeof kind !== 'string' || !allowed.has(kind as SurfaceEventKind)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  const limited = await rateLimitedResponse(limiter, resolveVisitorIp(request.headers, undefined));
  if (limited) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } });
  await recordSurfaceEvent(kind as SurfaceEventKind);
  return new Response(null, { status: 204 });
}
