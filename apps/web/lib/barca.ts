import { parseFootballDataMatches } from '@ahmed-moghazy/shared';
import type { BarcaFixture } from '@ahmed-moghazy/shared';

const MATCHES_URL = 'https://api.football-data.org/v4/teams/81/matches?status=SCHEDULED,TIMED';

/** Next FC Barcelona fixture, cached by Next's fetch cache for six hours. */
export async function nextFixture(): Promise<BarcaFixture | null> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return null;
  const response = await fetch(MATCHES_URL, {
    headers: { 'X-Auth-Token': token },
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Fixtures unavailable (${response.status})`);
  return parseFootballDataMatches(await response.json(), new Date());
}
