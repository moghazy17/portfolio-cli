import type { GuestbookEntry, LiveServices, PresenceCount, SkillEvidence } from '@ahmed-moghazy/shared';

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
};

export async function fetchSkillEvidence(signal: AbortSignal): Promise<SkillEvidence> {
  const response = await fetch('/api/skills', { signal });
  if (!response.ok) throw new Error(`Skill evidence unavailable (${response.status})`);
  const data = await response.json() as { evidence: SkillEvidence };
  return data.evidence;
}
