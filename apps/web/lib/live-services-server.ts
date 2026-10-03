import { cvData } from '@ahmed-moghazy/shared';
import type { LiveServices, SkillEvidenceDetails } from '@ahmed-moghazy/shared';
import { filterSnapshotToCurrentRepos, skillEvidenceWithRepos, STALE_AFTER_MS } from '@ahmed-moghazy/shared/assistant-server';
import type { InventorySnapshot, LiveRepo } from '@ahmed-moghazy/shared/assistant-server';
import { getInventory } from './inventory-store';
import { createLiveGitHub } from './github-live';
import { listEntries } from './guestbook';
import { count } from './presence';
import { recentFilms } from './letterboxd';

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
  films: recentFilms,
};

const CURRENT_REPOS_TIMEOUT_MS = 1500;

export async function currentSkillSnapshot(snapshot: InventorySnapshot): Promise<InventorySnapshot> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const liveRepos = await Promise.race<LiveRepo[] | null>([
      createLiveGitHub().currentRepos(),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), CURRENT_REPOS_TIMEOUT_MS); }),
    ]);
    return filterSnapshotToCurrentRepos(snapshot, liveRepos);
  } catch {
    return snapshot;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function serverSkillEvidence(): Promise<SkillEvidenceDetails> {
  const snapshot = await getInventory();
  if (!snapshot || Date.now() - Date.parse(snapshot.generatedAt) > STALE_AFTER_MS) throw new Error('No current inventory');
  return skillEvidenceWithRepos(await currentSkillSnapshot(snapshot), cvData.skills);
}
