import { isExcludedRepo } from '../exclusion';
import type { InventorySnapshot } from './types';

interface CurrentRepo {
  name: string;
  fork?: boolean;
  topics?: string[];
}

/** Use the build snapshot alone when the current public repo list is unavailable. */
export function filterSnapshotToCurrentRepos(snapshot: InventorySnapshot, liveRepos: readonly CurrentRepo[] | null): InventorySnapshot {
  if (!liveRepos) return snapshot;
  const allowed = new Set(liveRepos.filter((repo) => !isExcludedRepo(repo)).map((repo) => repo.name));
  const repos = Object.fromEntries(Object.entries(snapshot.repos).filter(([name]) => allowed.has(name)));
  const techs = Object.fromEntries(Object.entries(snapshot.techs)
    .map(([id, tech]) => [id, { ...tech, evidence: tech.evidence.filter((item) => allowed.has(item.repo)) }] as const)
    .filter(([, tech]) => tech.evidence.length));
  return { ...snapshot, repos, techs,
    packages: Object.fromEntries(Object.entries(snapshot.packages).map(([key, items]) => [key, items.filter((item) => allowed.has(item.repo))])),
    readmeMentions: Object.fromEntries(Object.entries(snapshot.readmeMentions).map(([key, items]) => [key, items.filter((item) => allowed.has(item.repo))])),
    stats: { ...snapshot.stats, repoCount: Object.keys(repos).length, techCount: Object.keys(techs).length } };
}
