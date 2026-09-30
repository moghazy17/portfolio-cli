import { describe, expect, it } from 'vitest';
import { buildInventory } from '../src/inventory/build';
import { lookupTech, listRepos } from '../src/inventory/lookup';

const snapshot = buildInventory({ owner: 'example', generatedAt: '2026-01-01T00:00:00.000Z',
  aliases: { kafka: { label: 'Apache Kafka', category: 'data', aliases: ['kafka-python'] }, qdrant: { label: 'Vector Database', category: 'ai', aliases: ['qdrant-client'] } },
  repos: [
    { meta: { name: 'alpha', description: null, topics: ['data'], fork: false, archived: false, pushedAt: '2026-01-01T00:00:00.000Z', htmlUrl: 'https://github.com/example/alpha' }, languages: {}, readme: null, manifests: [{ path: 'requirements.txt', content: 'kafka-python\nunknown-lib', skimmed: false }] },
    { meta: { name: 'beta', description: null, topics: ['ai'], fork: false, archived: false, pushedAt: '2025-01-01T00:00:00.000Z', htmlUrl: 'https://github.com/example/beta' }, languages: {}, readme: 'qdrant', manifests: [] },
  ] });

describe('inventory lookup', () => {
  it('matches ids, labels, packages and fuzzy names', () => {
    expect(lookupTech(snapshot, 'kafka').matchedVia).toBe('id');
    expect(lookupTech(snapshot, 'Apache Kafka').matchedVia).toBe('alias');
    expect(lookupTech(snapshot, 'kafka-python').matchedVia).toBe('alias');
    expect(lookupTech(snapshot, 'unknown-lib').matchedVia).toBe('package');
    expect(lookupTech(snapshot, 'kafak').matchedVia).toBe('fuzzy');
    const withVectorEvidence = buildInventory({ owner: 'example', generatedAt: '2026-01-01T00:00:00.000Z',
      aliases: { qdrant: { label: 'Vector Database', category: 'ai', aliases: ['qdrant-client'] } },
      repos: [{ meta: { name: 'gamma', description: null, topics: [], fork: false, archived: false,
        pushedAt: '2026-01-01T00:00:00.000Z', htmlUrl: 'https://github.com/example/gamma' },
      languages: {}, readme: null, manifests: [{ path: 'requirements.txt', content: 'qdrant-client', skimmed: false }] }] });
    expect(lookupTech(withVectorEvidence, 'vector database').matchedTech?.id).toBe('qdrant');
  });
  it('never treats a substring of a package name as evidence', () => {
    // "unknown-lib" contains "lib" and "own"; neither is a technology the owner used.
    for (const query of ['lib', 'own', 'kaf', 'python']) {
      const result = lookupTech(snapshot, query);
      expect(result.evidence, query).toEqual([]);
      expect(result.matchedTech, query).toBeNull();
    }
  });
  it('resolves a package alias to its technology', () => {
    const result = lookupTech(snapshot, 'kafka-python');
    expect(result.matchedTech?.id).toBe('kafka');
    expect(result.evidence[0].repo).toBe('alpha');
  });
  it('finds README-only technologies by label or alias, not just id', () => {
    const readmeOnly = buildInventory({ owner: 'example', generatedAt: '2026-01-01T00:00:00.000Z',
      aliases: { postgres: { label: 'PostgreSQL', category: 'data', aliases: ['psycopg2'] } },
      repos: [{ meta: { name: 'delta', description: null, topics: [], fork: false, archived: false,
        pushedAt: '2026-01-01T00:00:00.000Z', htmlUrl: 'https://github.com/example/delta' },
      languages: {}, readme: 'Stores notes in PostgreSQL.', manifests: [] }] });
    for (const query of ['postgres', 'PostgreSQL', 'psycopg2']) {
      expect(lookupTech(readmeOnly, query).readmeOnly.map((entry) => entry.repo), query).toEqual(['delta']);
    }
  });
  it('separates readme mentions and marks old snapshots stale', () => {
    const result = lookupTech(snapshot, 'qdrant', new Date('2026-03-01'));
    expect(result.evidence).toEqual([]);
    expect(result.readmeOnly[0].repo).toBe('beta');
    expect(result.stale).toBe(true);
  });
  it('filters repo listings', () => {
    expect(listRepos(snapshot, { tech: 'kafka' }).repos.map((repo) => repo.name)).toEqual(['alpha']);
    expect(listRepos(snapshot, { topic: 'ai' }).repos.map((repo) => repo.name)).toEqual(['beta']);
    expect(listRepos(snapshot, { activeWithinDays: 30, now: new Date('2026-01-10') }).total).toBe(1);
    expect(listRepos(snapshot, { limit: 100 }).repos.length).toBeLessThanOrEqual(10);
  });
});
