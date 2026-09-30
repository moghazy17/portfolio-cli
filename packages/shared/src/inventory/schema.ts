import { z } from 'zod';
import { isExcludedRepo, MAX_SNAPSHOT_BYTES } from './constants';
import type { InventorySnapshot } from './types';

const evidence = z.object({
  repo: z.string(), file: z.string(), lastActivity: z.iso.datetime(),
  kind: z.enum(['manifest', 'build', 'container', 'workflow', 'language']), match: z.string(),
});
export const InventorySnapshotSchema = z.object({
  version: z.literal(1), generatedAt: z.iso.datetime(), owner: z.string(),
  repos: z.record(z.string(), z.object({
    name: z.string(), url: z.string(), description: z.string().nullable(),
    topics: z.array(z.string()), languages: z.array(z.object({ name: z.string(), share: z.number().min(0).max(1) })),
    lastActivity: z.iso.datetime(), archived: z.boolean(), readmeExcerpt: z.string().nullable(),
    techs: z.array(z.string()), evidenceFiles: z.array(z.string()), skimmed: z.array(z.string()),
  })),
  techs: z.record(z.string(), z.object({
    id: z.string(), label: z.string(), category: z.enum(['language', 'ai', 'data', 'web', 'infra', 'tooling', 'other']),
    evidence: z.array(evidence),
  })),
  packages: z.record(z.string(), z.array(evidence)),
  readmeMentions: z.record(z.string(), z.array(z.object({ repo: z.string(), lastActivity: z.iso.datetime() }))),
  stats: z.object({ repoCount: z.number(), techCount: z.number(), topLanguages: z.array(z.object({
    name: z.string(), bytesShare: z.number(), repos: z.number(),
  })) }),
});

const sorted = (values: string[]) => values.every((value, index) => index === 0 || values[index - 1].localeCompare(value) <= 0);
export function checkInvariants(snapshot: InventorySnapshot): string[] {
  const errors: string[] = [];
  if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_SNAPSHOT_BYTES) errors.push('snapshot exceeds size cap');
  if (snapshot.stats.repoCount !== Object.keys(snapshot.repos).length) errors.push('repo count mismatch');
  if (snapshot.stats.techCount !== Object.keys(snapshot.techs).length) errors.push('tech count mismatch');
  for (const key of ['repos', 'techs', 'packages', 'readmeMentions'] as const) {
    if (!sorted(Object.keys(snapshot[key]))) errors.push(`${key} keys are unsorted`);
  }
  for (const [name, repo] of Object.entries(snapshot.repos)) {
    if (repo.name !== name || isExcludedRepo(repo)) errors.push(`invalid repo ${name}`);
    if (!sorted(repo.techs) || !sorted(repo.topics) || !sorted(repo.evidenceFiles) || !sorted(repo.skimmed)) errors.push(`unsorted repo ${name}`);
    if (repo.languages.some((language) => language.share < 0.05)) errors.push(`small language share ${name}`);
  }
  for (const [id, tech] of Object.entries(snapshot.techs)) {
    if (id !== tech.id || tech.evidence.length === 0) errors.push(`invalid technology ${id}`);
    const seen = new Set<string>();
    for (const item of tech.evidence) {
      if (!snapshot.repos[item.repo] || seen.has(item.repo)) errors.push(`invalid evidence ${id}`);
      seen.add(item.repo);
    }
    if (tech.evidence.some((item, index) => index > 0 && tech.evidence[index - 1].lastActivity < item.lastActivity)) errors.push(`unsorted evidence ${id}`);
  }
  for (const entries of Object.values(snapshot.packages)) {
    for (const item of entries) if (!snapshot.repos[item.repo]) errors.push('orphan package evidence');
  }
  for (const entries of Object.values(snapshot.readmeMentions)) {
    for (const item of entries) if (!snapshot.repos[item.repo]) errors.push('orphan readme mention');
  }
  return errors;
}
