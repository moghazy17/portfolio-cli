import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { getChatStats } from '../../../lib/chat-log';
import { getQuestionLog } from '../../../lib/question-log';
import { redis } from '../../../lib/redis';

export const dynamic = 'force-dynamic';

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:chat-stats',
    })
  : null;

function callerIp(req: Request): string {
  return req.headers.get('x-real-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

// Private usage report. Call with: Authorization: Bearer <CHAT_STATS_TOKEN>
// Add ?log=1&days=N (1-30) for the anonymous question log instead.
export async function GET(req: Request) {
  // Limit by caller before the token check, so the token can't be guessed at speed.
  if (ratelimit) {
    try {
      const { success } = await ratelimit.limit(callerIp(req));
      if (!success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    } catch (err) {
      console.error('[chat-stats] limiter unavailable, allowing request:', err);
    }
  }

  const token = process.env.CHAT_STATS_TOKEN;
  if (!token || req.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const params = new URL(req.url).searchParams;

  if (params.get('log') === '1') {
    const logDays = Math.min(Math.max(Math.floor(Number(params.get('days'))) || 7, 1), 30);
    try {
      const entries = await getQuestionLog(logDays);
      if (!entries) {
        return NextResponse.json({ error: 'Redis is not configured' }, { status: 503 });
      }
      return NextResponse.json({ entries });
    } catch (err) {
      console.error('[chat-stats] failed to read question log:', err);
      return NextResponse.json({ error: 'Could not reach Redis' }, { status: 503 });
    }
  }

  const days = Math.min(Math.max(Number(params.get('days')) || 7, 1), 90);

  try {
    const stats = await getChatStats(days);
    if (!stats) {
      return NextResponse.json({ error: 'Redis is not configured' }, { status: 503 });
    }
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[chat-stats] failed to read stats:', err);
    return NextResponse.json({ error: 'Could not reach Redis' }, { status: 503 });
  }
}
