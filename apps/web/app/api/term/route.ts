import { Ratelimit } from '@upstash/ratelimit';
import { parseAddress, rateLimitedResponse, runTextRequest, wantsColor } from '@ahmed-moghazy/shared';
import { resolveVisitorIp } from '@ahmed-moghazy/shared/assistant-server';
import { after } from 'next/server';
import { getGitHubStatsCached } from '../../../lib/github-stats';
import { redis } from '../../../lib/redis';
import { recordSurfaceEvent } from '../../../lib/surface-stats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:curl' })
  : null;

const textHeaders = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'User-Agent',
};

export async function GET(request: Request): Promise<Response> {
  const limited = await rateLimitedResponse(limiter, resolveVisitorIp(request.headers, undefined));
  if (limited) {
    after(() => recordSurfaceEvent('curl_rate_limited'));
    return new Response(limited.body, {
      status: limited.status,
      headers: { ...textHeaders, 'Retry-After': String(limited.retryAfter) },
    });
  }

  const url = new URL(request.url);
  const search = url.search;
  const path = url.searchParams.get('__path') ?? (url.pathname === '/api/term' ? '/' : url.pathname);
  after(() => recordSurfaceEvent('curl_requests'));
  const parsedAddress = parseAddress(path, search);
  const address = parsedAddress.kind === 'command' && parsedAddress.line.includes('\uFFFD')
    ? { kind: 'invalid' as const, reason: 'undecodable' as const }
    : parsedAddress;
  const response = await runTextRequest({
    address,
    color: wantsColor(search),
    origin: url.origin,
    github: getGitHubStatsCached,
  });
  return new Response(response.body, { status: response.status, headers: textHeaders });
}
