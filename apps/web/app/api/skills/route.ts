import { Ratelimit } from '@upstash/ratelimit';
import { cvData, rateLimitedResponse } from '@ahmed-moghazy/shared';
import { resolveVisitorIp, skillEvidence, STALE_AFTER_MS } from '@ahmed-moghazy/shared/assistant-server';
import { getInventory } from '../../../lib/inventory-store';
import { redis } from '../../../lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'rl:skills' })
  : null;

export async function GET(request: Request): Promise<Response> {
  const limited = await rateLimitedResponse(limiter, resolveVisitorIp(request.headers, undefined));
  if (limited) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } });
  const snapshot = await getInventory();
  if (!snapshot || !Number.isFinite(Date.parse(snapshot.generatedAt)) || Date.now() - Date.parse(snapshot.generatedAt) > STALE_AFTER_MS) {
    return Response.json({ error: 'no_inventory' }, { status: 404 });
  }
  return Response.json({ evidence: skillEvidence(snapshot, cvData.skills), generatedAt: snapshot.generatedAt }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
