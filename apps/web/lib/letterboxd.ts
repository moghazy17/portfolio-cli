import { LETTERBOXD_RSS, parseLetterboxdRss } from '@ahmed-moghazy/shared';
import type { FilmEntry } from '@ahmed-moghazy/shared';

const TIMEOUT_MS = 3000;

/** Recent diary entries, cached by Next's fetch cache for an hour. */
export async function recentFilms(): Promise<FilmEntry[]> {
  const response = await fetch(LETTERBOXD_RSS, {
    next: { revalidate: 3600 },
    headers: { 'User-Agent': 'moghazy.me (+https://moghazy.me)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Letterboxd unavailable (${response.status})`);
  return parseLetterboxdRss(await response.text());
}
