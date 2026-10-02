import { cvData } from '@ahmed-moghazy/shared';
import type { LiveServices, SkillEvidence } from '@ahmed-moghazy/shared';
import { skillEvidence, STALE_AFTER_MS } from '@ahmed-moghazy/shared/assistant-server';
import { getInventory } from './inventory-store';
import { listEntries } from './guestbook';
import { count } from './presence';

export const serverLiveServices: LiveServices = {
  async presence() {
    const value = await count();
    if (!value) throw new Error('Presence unavailable');
    return value;
  },
  async guestbook() {
    const value = await listEntries();
    if (!value) throw new Error('Guestbook unavailable');
    return value;
  },
};

export async function serverSkillEvidence(): Promise<SkillEvidence> {
  const snapshot = await getInventory();
  if (!snapshot || Date.now() - Date.parse(snapshot.generatedAt) > STALE_AFTER_MS) throw new Error('No current inventory');
  return skillEvidence(snapshot, cvData.skills);
}
