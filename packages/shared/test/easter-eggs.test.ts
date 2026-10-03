import { describe, expect, it } from 'vitest';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';
import { parseLetterboxdRss, stars } from '../src/letterboxd';
import type { LiveServices } from '../src/types';

const origin = 'https://example.test';
const text = (output: Awaited<ReturnType<ReturnType<typeof createShell>['run']>>['output']) => toLines(output).map((line) => line.text).join('\n');

const rss = `<rss><channel>
<item><title>Some list</title><link>https://letterboxd.com/x/list/y/</link></item>
<item> <title>The Invite, 2026 - ★★★½</title> <link>https://letterboxd.com/moghazy17/film/the-invite-2026/</link>
<letterboxd:watchedDate>2026-09-04</letterboxd:watchedDate> <letterboxd:rewatch>No</letterboxd:rewatch>
<letterboxd:filmTitle>The Invite</letterboxd:filmTitle> <letterboxd:filmYear>2026</letterboxd:filmYear>
<letterboxd:memberRating>3.5</letterboxd:memberRating> <letterboxd:memberLike>Yes</letterboxd:memberLike></item>
<item> <title>Tom &amp; Jerry</title> <link>https://evil.example/</link>
<letterboxd:rewatch>Yes</letterboxd:rewatch><letterboxd:filmTitle>Tom &amp; Jerry</letterboxd:filmTitle></item>
</channel></rss>`;

describe('letterboxd parsing', () => {
  it('keeps film entries, decodes entities, and pins links to letterboxd', () => {
    const films = parseLetterboxdRss(rss);
    expect(films).toHaveLength(2);
    expect(films[0]).toMatchObject({ title: 'The Invite', year: 2026, rating: 3.5, liked: true, rewatch: false, watched: '2026-09-04' });
    expect(films[1]).toMatchObject({ title: 'Tom & Jerry', rating: undefined, rewatch: true, url: 'https://letterboxd.com/moghazy17/' });
  });

  it('renders half stars', () => {
    expect(stars(3.5)).toBe('★★★½');
    expect(stars(5)).toBe('★★★★★');
    expect(stars(undefined)).toBe('');
  });
});

describe('hidden fan commands', () => {
  it('answers spidey and barca aliases', async () => {
    const shell = createShell({ surface: 'web', origin });
    expect(text((await shell.run('thwip')).output)).toContain('THWIP!');
    expect(text((await shell.run('barça')).output)).toContain('VISCA EL BARÇA');
  });

  it('lists recent films and degrades to the profile link', async () => {
    const live: LiveServices = {
      presence: async () => ({ total: 1, bySurface: {}, at: '' }),
      guestbook: async () => [],
      films: async () => parseLetterboxdRss(rss),
    };
    const shown = text((await createShell({ surface: 'web', origin, live }).run('letterboxd')).output);
    expect(shown).toContain('The Invite (2026)');
    expect(shown).toContain('★★★½');
    const offline = text((await createShell({ surface: 'web', origin }).run('movies')).output);
    expect(offline).toContain('letterboxd.com/moghazy17');
  });

  it('keeps the eggs out of help', async () => {
    const help = text((await createShell({ surface: 'web', origin }).run('help')).output);
    for (const name of ['spidey', 'visca', 'letterboxd']) expect(help).not.toContain(name);
  });
});
