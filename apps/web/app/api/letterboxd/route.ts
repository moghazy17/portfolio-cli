import { recentFilms } from '../../../lib/letterboxd';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  try {
    return Response.json({ films: await recentFilms() }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
