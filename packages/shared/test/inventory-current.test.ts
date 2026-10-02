import { describe, expect, it } from 'vitest';
import { buildInventory } from '../src/inventory/build';
import { filterSnapshotToCurrentRepos } from '../src/inventory/current';
import { skillEvidenceWithRepos } from '../src/inventory/skills';

const names = ['public', 'made-private', 'newly-excluded'];
const snapshot = buildInventory({
  owner: 'example', generatedAt: '2026-01-01T00:00:00Z',
  aliases: { kafka: { label: 'Kafka', category: 'data', aliases: ['kafka-python'] } },
  repos: names.map((name) => ({
    meta: { name, description: null, topics: [], fork: false, archived: false,
      pushedAt: '2026-01-01T00:00:00Z', htmlUrl: `https://github.com/example/${name}` },
    languages: {}, readme: 'Kafka', manifests: [{ path: 'requirements.txt', content: 'kafka-python', skimmed: false }],
  })),
});
const skills = [{ name: 'Data', skills: ['Kafka'] }];

describe('filterSnapshotToCurrentRepos', () => {
  it('removes private and newly excluded repos from counts and repo names together', () => {
    const current = filterSnapshotToCurrentRepos(snapshot, [
      { name: 'public', fork: false, topics: [] },
      { name: 'newly-excluded', fork: false, topics: ['portfolio-exclude'] },
    ]);
    expect(Object.keys(current.repos)).toEqual(['public']);
    expect(current.stats.repoCount).toBe(1);
    expect(current.techs.kafka.evidence.map((item) => item.repo)).toEqual(['public']);
    expect(current.readmeMentions.kafka.map((item) => item.repo)).toEqual(['public']);
    expect(skillEvidenceWithRepos(current, skills)).toEqual({ evidence: { Kafka: 1 }, repos: { Kafka: ['public'] } });
  });

  it('uses the build snapshot when the live repo list is unavailable', () => {
    const fallback = filterSnapshotToCurrentRepos(snapshot, null);
    expect(fallback).toBe(snapshot);
    expect(skillEvidenceWithRepos(fallback, skills)).toEqual({ evidence: { Kafka: 3 }, repos: { Kafka: [...names].sort() } });
  });
});
