import { NextResponse } from 'next/server';
import { getChatStats } from '../../../lib/chat-log';

export const dynamic = 'force-dynamic';

// Private usage report. Call with: Authorization: Bearer <CHAT_STATS_TOKEN>
export async function GET(req: Request) {
  const token = process.env.CHAT_STATS_TOKEN;
  if (!token || req.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 7, 1), 90);

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
