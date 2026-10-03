export interface BarcaFixture {
  opponent: string;
  home: boolean;
  competition: string;
  /** Kickoff as an ISO UTC timestamp. */
  kickoff: string;
}

export const BARCA_TEAM_ID = 81;
export const BARCA_FIXTURES_URL = 'https://www.fcbarcelona.com/en/football/first-team/schedule';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function name(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseFootballDataMatches(json: unknown, now: Date): BarcaFixture | null {
  const matches = object(json)?.matches;
  if (!Array.isArray(matches)) return null;

  let next: BarcaFixture | null = null;
  let nextTime = Infinity;
  for (const entry of matches) {
    const match = object(entry);
    if (!match || (match.status !== 'SCHEDULED' && match.status !== 'TIMED')) continue;
    if (typeof match.utcDate !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(match.utcDate)) continue;
    const kickoff = new Date(match.utcDate);
    const time = kickoff.getTime();
    if (!Number.isFinite(time) || time <= now.getTime() || time >= nextTime) continue;

    const homeTeam = object(match.homeTeam);
    const awayTeam = object(match.awayTeam);
    const competition = name(object(match.competition)?.name);
    if (!homeTeam || !awayTeam || !competition) continue;
    if (!Number.isInteger(homeTeam.id) || !Number.isInteger(awayTeam.id)) continue;
    const home = homeTeam.id === BARCA_TEAM_ID;
    if (home === (awayTeam.id === BARCA_TEAM_ID)) continue;
    const opponent = home ? awayTeam : homeTeam;
    const opponentName = name(opponent.shortName) ?? name(opponent.name);
    if (!opponentName) continue;

    nextTime = time;
    next = { opponent: opponentName, home, competition, kickoff: kickoff.toISOString() };
  }
  return next;
}

function calendarDay(date: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}

export function formatFixture(fixture: BarcaFixture, options: { now: Date; timeZone?: string }): {
  match: string;
  competition: string;
  kickoff: string;
  relative: string;
} {
  const date = new Date(fixture.kickoff);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: options.timeZone, weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const days = Math.round((calendarDay(date, options.timeZone) - calendarDay(options.now, options.timeZone)) / 86_400_000);
  return {
    match: fixture.home ? `FC Barcelona vs ${fixture.opponent}` : `${fixture.opponent} vs FC Barcelona`,
    competition: fixture.competition,
    kickoff: `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`,
    relative: days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`,
  };
}
