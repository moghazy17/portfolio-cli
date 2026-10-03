import type { BarcaFixture, FilmEntry, GuestbookEntry, LiveServices, PresenceCount, SkillEvidenceDetails } from '@ahmed-moghazy/shared';

export const liveServices: LiveServices = {
  async presence(signal: AbortSignal): Promise<PresenceCount> {
    const response = await fetch('/api/presence', { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Presence unavailable (${response.status})`);
    return response.json() as Promise<PresenceCount>;
  },
  async guestbook(signal: AbortSignal): Promise<GuestbookEntry[]> {
    const response = await fetch('/api/guestbook', { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Guestbook unavailable (${response.status})`);
    const result = await response.json() as { entries: GuestbookEntry[] };
    return result.entries;
  },
  async films(signal: AbortSignal): Promise<FilmEntry[]> {
    const response = await fetch('/api/letterboxd', { signal });
    if (!response.ok) throw new Error(`Films unavailable (${response.status})`);
    return ((await response.json()) as { films: FilmEntry[] }).films;
  },
  async fixture(signal: AbortSignal): Promise<BarcaFixture | null> {
    const response = await fetch('/api/barca', { signal });
    if (!response.ok) throw new Error(`Fixture unavailable (${response.status})`);
    return ((await response.json()) as { fixture: BarcaFixture | null }).fixture;
  },
};

export async function fetchSkillEvidence(signal: AbortSignal): Promise<SkillEvidenceDetails> {
  const response = await fetch('/api/skills?v=3', { signal });
  if (!response.ok) throw new Error(`Skill evidence unavailable (${response.status})`);
  const data = await response.json() as Partial<SkillEvidenceDetails>;
  return { evidence: data.evidence ?? {}, repos: data.repos ?? {} };
}
