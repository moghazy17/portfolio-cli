import { describe, expect, it } from 'vitest';
import { buildInventory } from '../src/inventory/build';
import { checkInvariants } from '../src/inventory/schema';
import type { BuildInput } from '../src/inventory/build';

const date = '2026-09-01T00:00:00.000Z';
const repo = (name: string, extra: Partial<BuildInput['repos'][number]> = {}): BuildInput['repos'][number] => ({
  meta: { name, description: null, topics: [], fork: false, archived: false, pushedAt: date, htmlUrl: `https://github.com/example/${name}` },
  languages: { Python: 95, Rust: 5, Ruby: 1 }, readme: null, manifests: [], ...extra,
});
const aliases: BuildInput['aliases'] = { kafka: { label: 'Kafka', category: 'data', aliases: ['kafka-python'] }, python: { label: 'Python', category: 'language', aliases: [] } };

describe('inventory builder', () => {
  const input: BuildInput = { owner: 'example', generatedAt: date, aliases, repos: [
    repo('normal-b', { manifests: [{ path: 'requirements.txt', content: 'kafka-python', skimmed: false }] }),
    repo('normal-a', { manifests: [{ path: 'requirements.txt', content: 'kafka-python', skimmed: false }, { path: 'pyproject.toml', content: '[project]\ndependencies=["kafka-python"]', skimmed: false }] }),
    repo('old-archive', { meta: { ...repo('old-archive').meta, archived: true, pushedAt: '2020-01-01T00:00:00.000Z' } }),
    repo('fork-only', { meta: { ...repo('fork-only').meta, fork: true } }),
    repo('hidden-only', { meta: { ...repo('hidden-only').meta, topics: ['portfolio-exclude'] }, manifests: [{ path: 'requirements.txt', content: 'kafka-python', skimmed: false }] }),
    repo('readme-only', { readme: 'Kafka is mentioned here.' }),
  ] };
  it('filters, sorts, and keeps README mentions separate', () => {
    const first = buildInventory(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(buildInventory(input)));
    expect(Object.keys(first.repos)).toEqual(['normal-a', 'normal-b', 'old-archive', 'readme-only']);
    expect(JSON.stringify(first)).not.toContain('hidden-only');
    expect(JSON.stringify(first)).not.toContain('fork-only');
    expect(first.techs.kafka.evidence).toHaveLength(2);
    expect(first.techs.kafka.evidence[0].file).toBe('pyproject.toml');
    expect(first.repos['readme-only'].techs).not.toContain('kafka');
    expect(first.readmeMentions.kafka).toContainEqual({ repo: 'readme-only', lastActivity: date });
    expect(first.repos['normal-a'].languages.map((language) => language.name)).not.toContain('Ruby');
    expect(checkInvariants(first)).toEqual([]);
  });
  it('counts README mentions only as whole words', () => {
    const built = buildInventory({ owner: 'example', generatedAt: date,
      aliases: { java: { label: 'Java', category: 'language', aliases: [] }, go: { label: 'Go', category: 'language', aliases: [] } },
      repos: [
        repo('script-app', { languages: {}, readme: 'Written in JavaScript with a MongoDB store.' }),
        repo('jvm-app', { languages: {}, readme: 'A small Java service.' }),
        repo('w-edge', { languages: {}, readme: 'w/java and Go;wiring' }),
      ] });
    expect(built.readmeMentions.java?.map((entry) => entry.repo).sort()).toEqual(['jvm-app', 'w-edge']);
    expect(built.readmeMentions.go?.map((entry) => entry.repo)).toEqual(['w-edge']);
  });

  it('ignores everyday words that happen to be technology ids', () => {
    const built = buildInventory({ owner: 'example', generatedAt: date,
      aliases: {
        go: { label: 'Go', category: 'language', aliases: [] },
        git: { label: 'Git', category: 'tooling', aliases: [] },
        'next.js': { label: 'Next.js', category: 'web', aliases: ['next'] },
      },
      repos: [repo('notes', { languages: {}, readme: "Let's go! Run git clone first. Next steps: read the docs." })] });
    expect(built.readmeMentions).toEqual({});
  });

  it('indexes every name of a technology for lookups', () => {
    const built = buildInventory({ owner: 'example', generatedAt: date,
      aliases: { postgres: { label: 'PostgreSQL', category: 'data', aliases: ['psycopg2', 'pg-*'] } }, repos: [] });
    expect(built.aliasIndex).toEqual({ postgres: 'postgres', postgresql: 'postgres', psycopg2: 'postgres' });
  });
  it('rejects corruption and oversized snapshots', () => {
    const bad = buildInventory(input);
    bad.techs.kafka.evidence[0].repo = 'missing-repo';
    expect(checkInvariants(bad).length).toBeGreaterThan(0);
    bad.repos['normal-a'].description = 'x'.repeat(900_001);
    expect(checkInvariants(bad)).toContain('snapshot exceeds size cap');
  });
});
