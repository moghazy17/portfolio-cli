import { nextFixture } from '../../../lib/barca';

export const revalidate = 21600;

export async function GET(): Promise<Response> {
  try {
    return Response.json({ fixture: await nextFixture() }, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
