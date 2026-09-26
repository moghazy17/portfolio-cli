import { Ratelimit } from '@upstash/ratelimit';
import { NextResponse } from 'next/server';
import { content, contentVersion, generatedAt } from '@ahmed-moghazy/shared';
import { redis } from '../../../lib/redis';

export const dynamic = 'force-dynamic';

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'ratelimit:content',
    })
  : null;

const etag = `"${contentVersion}"`;
const cacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export async function GET(request: Request) {
  if (ratelimit) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    try {
      const result = await ratelimit.limit(ip);
      if (!result.success) {
        const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
        return NextResponse.json(
          { error: 'rate_limited' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        );
      }
    } catch (error) {
      console.error('Content rate limiter unavailable, allowing request:', error);
    }
  }

  const headers = {
    ETag: etag,
    'Cache-Control': cacheControl,
  };
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return NextResponse.json(
    { version: contentVersion, generatedAt, content },
    { headers },
  );
}
