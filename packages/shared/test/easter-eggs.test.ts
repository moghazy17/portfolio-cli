import { describe, expect, it } from 'vitest';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';
import { parseLetterboxdRss, stars } from '../src/letterboxd';
import { formatFixture, parseFootballDataMatches, type BarcaFixture } from '../src/barca';
import type { LiveServices } from '../src/types';

const origin = 'https://example.test';
const text = (output: Awaited<ReturnType<ReturnType<typeof createShell>['run']>>['output']) => toLines(output).map((line) => line.text).join('\n');
const fixture: BarcaFixture = { opponent: 'Sevilla FC', home: true, competition: 'La Liga', kickoff: '2026-10-04T21:00:00.000Z' };
const liveWithFixture = (value: BarcaFixture | null): LiveServices => ({
  presence: async () => ({ total: 1, bySurface: {}, at: '' }),
  guestbook: async () => [],
  fixture: async () => value,
});

describe('Barcelona fixtures', () => {
  const team = (id: number, name: string, shortName?: string) => ({ id, name, shortName });
  const match = (utcDate: string, status: string, homeTeam: object, awayTeam: object) => ({
    utcDate, status, homeTeam, awayTeam, competition: { name: 'La Liga' },
  });

  it('chooses the earliest future scheduled or timed match and reads both sides', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const matches = [
      match('2026-10-03T10:00:00Z', 'SCHEDULED', team(81, 'FC Barcelona'), team(1, 'Old')),
      match('2026-10-04T18:00:00Z', 'FINISHED', team(81, 'FC Barcelona'), team(2, 'Finished')),
      match('2026-10-09T20:00:00Z', 'SCHEDULED', team(81, 'FC Barcelona'), team(3, 'Later', 'Later FC')),
      match('2026-10-05T20:00:00Z', 'TIMED', team(4, 'Athletic Club', 'Athletic'), team(81, 'FC Barcelona')),
      match('2026-10-04T21:00:00Z', 'SCHEDULED', team(81, 'FC Barcelona'), team(5, 'Sevilla FC')),
    ];
    expect(parseFootballDataMatches({ matches }, now)).toEqual(fixture);
    expect(parseFootballDataMatches({ matches: matches.slice(0, 4) }, now)).toEqual({
      opponent: 'Athletic', home: false, competition: 'La Liga', kickoff: '2026-10-05T20:00:00.000Z',
    });
  });

  it('returns null for malformed responses and invalid matches', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    expect(parseFootballDataMatches(null, now)).toBeNull();
    expect(parseFootballDataMatches({ matches: 'bad' }, now)).toBeNull();
    expect(parseFootballDataMatches({ matches: [match('bad', 'SCHEDULED', team(81, 'FC Barcelona'), team(5, 'Sevilla FC'))] }, now)).toBeNull();
    expect(parseFootballDataMatches({ matches: [match('2026-10-04T21:00:00Z', 'SCHEDULED', team(9, 'A'), team(5, 'B'))] }, now)).toBeNull();
    expect(parseFootballDataMatches({ matches: [match('2026-10-04T21:00:00Z', 'SCHEDULED', team(81, 'FC Barcelona'), { name: 'Unknown' })] }, now)).toBeNull();
  });

  it('formats UTC kickoff and calendar-day relative dates across midnight', () => {
    const now = new Date('2026-10-03T23:30:00Z');
    const formatted = formatFixture(fixture, { now, timeZone: 'UTC' });
    expect(formatted).toEqual({ match: 'FC Barcelona vs Sevilla FC', competition: 'La Liga', kickoff: 'Sun 4 Oct, 21:00', relative: 'tomorrow' });
    expect(formatFixture({ ...fixture, kickoff: '2026-10-03T23:50:00Z' }, { now, timeZone: 'UTC' }).relative).toBe('today');
    expect(formatFixture({ ...fixture, kickoff: '2026-10-06T00:05:00Z' }, { now, timeZone: 'UTC' }).relative).toBe('in 3 days');
    expect(formatFixture({ ...fixture, kickoff: '2026-10-04T01:00:00Z' }, { now, timeZone: 'America/New_York' }).relative).toBe('today');
  });
});

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
    const spidey = await shell.run('thwip');
    const visca = await shell.run('barça');
    expect(text(spidey.output)).toContain('THWIP!');
    expect(spidey.sequence).toHaveLength(4);
    expect(spidey.fx).toBe('web');
    expect(text(visca.output)).toContain('VISCA EL BARÇA');
    expect(visca.fx).toBe('confetti');
    expect(text(visca.output)).toContain('Fixture unavailable');
    expect(text(visca.output)).toContain('https://www.fcbarcelona.com/en/football/first-team/schedule');
    expect(text(visca.output)).toContain('Força Barça!');
    expect(`${text(spidey.output)}\n${text(visca.output)}`).not.toMatch(/data|model|pandas|\bML\b|work|hire/i);
  });

  it('shows a live fixture and labels curl time UTC', async () => {
    const web = await createShell({ surface: 'web', origin, live: liveWithFixture(fixture) }).run('visca');
    const curl = await createShell({ surface: 'curl', origin, live: liveWithFixture(fixture) }).run('fcb');
    expect(text(web.output)).toContain('FC Barcelona vs Sevilla FC');
    expect(text(web.output)).toContain('La Liga');
    expect(text(web.output)).toContain('your time');
    expect(text(web.output)).toContain('Força Barça!');
    expect(text(curl.output)).toContain('Sun 4 Oct, 21:00 (UTC)');
    expect(web.fx).toBe('confetti');
    expect(curl.fx).toBe('confetti');
    expect(`${text(web.output)}\n${text(curl.output)}`).not.toMatch(/data|model|pandas|\bML\b|work|hire/i);
  });

  it('falls back when the fixture service returns null or throws', async () => {
    const nullResult = await createShell({ surface: 'web', origin, live: liveWithFixture(null) }).run('visca');
    const throwing: LiveServices = { ...liveWithFixture(null), fixture: async () => { throw new Error('offline'); } };
    const errorResult = await createShell({ surface: 'web', origin, live: throwing }).run('visca');
    for (const result of [nullResult, errorResult]) {
      expect(text(result.output)).toContain('Fixture unavailable');
      expect(text(result.output)).toContain('Força Barça!');
      expect(result.fx).toBe('confetti');
    }
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
    expect((await createShell({ surface: 'web', origin, live }).run('films')).fx).toBe('films');
    expect(shown).not.toMatch(/model|evaluation/i);
    const offline = text((await createShell({ surface: 'web', origin }).run('movies')).output);
    expect(offline).toContain('letterboxd.com/moghazy17');
  });

  it('keeps the eggs out of help', async () => {
    const help = text((await createShell({ surface: 'web', origin }).run('help')).output);
    for (const name of ['spidey', 'visca', 'letterboxd']) expect(help).not.toContain(name);
  });
});
