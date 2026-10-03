import type { FilmEntry } from './types';

export const LETTERBOXD_USERNAME = 'moghazy17';
export const LETTERBOXD_URL = `https://letterboxd.com/${LETTERBOXD_USERNAME}/`;
export const LETTERBOXD_RSS = `${LETTERBOXD_URL}rss/`;

function tag(item: string, name: string): string | undefined {
  const match = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!match) return undefined;
  return match[1].trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Parses diary entries out of a Letterboxd RSS feed; lists and other non-film items are skipped. */
export function parseLetterboxdRss(xml: string, limit = 10): FilmEntry[] {
  const films: FilmEntry[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(item, 'letterboxd:filmTitle');
    if (!title) continue;
    const rating = Number(tag(item, 'letterboxd:memberRating'));
    const link = tag(item, 'link');
    films.push({
      title,
      year: Number(tag(item, 'letterboxd:filmYear')) || undefined,
      rating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
      watched: tag(item, 'letterboxd:watchedDate'),
      liked: tag(item, 'letterboxd:memberLike') === 'Yes',
      rewatch: tag(item, 'letterboxd:rewatch') === 'Yes',
      url: link?.startsWith('https://letterboxd.com/') ? link : LETTERBOXD_URL,
    });
    if (films.length >= limit) break;
  }
  return films;
}

export function stars(rating?: number): string {
  if (!rating) return '';
  return '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');
}
