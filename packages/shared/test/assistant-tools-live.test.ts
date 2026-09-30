import { describe, expect, it, vi } from 'vitest';
import { createAssistantTools } from '../src/assistant/server/tools';
import type { AssistantDeps } from '../src/assistant/server/tools';

const now = new Date('2026-09-30T00:00:00Z');
const repo = (name: string, pushedAt = '2026-09-29T00:00:00Z', topics: string[] = [], fork = false) =>
  ({ name, pushedAt, topics, fork, archived: false });
const live = {
  currentRepos: vi.fn(async () => [repo('alpha', '2026-09-28T00:00:00Z'), repo('lagging'), repo('hidden', undefined, ['portfolio-exclude']), repo('forked', undefined, [], true)]),
  recentActivity: vi.fn(async () => [
    { repo: 'alpha', lastActivity: '2026-09-28T00:00:00Z', pushes: 2, kinds: ['push' as const] },
    { repo: 'hidden', lastActivity: '2026-09-29T00:00:00Z', pushes: 1, kinds: ['push' as const] },
    { repo: 'forked', lastActivity: '2026-09-29T00:00:00Z', pushes: 1, kinds: ['push' as const] },
  ]),
  repo: vi.fn(async (name: string) => name === 'lagging' ? { ...repo(name), url: 'https://example.invalid/lagging', description: 'text', languages: ['Go'], readmeExcerpt: 'README' } : null),
  searchCode: vi.fn(async () => [
    { repo: 'alpha', path: 'src/a.ts', fragment: `token = ${'x'.repeat(20)} ${'a'.repeat(200)}` },
    { repo: 'hidden', path: 'src/h.ts', fragment: 'private' },
  ]),
};
const deps = (): AssistantDeps => ({ inventory: async () => null, live });
const run = async (entry: { execute?: (args: any, context: any) => Promise<unknown> }, args: object) => entry.execute!(args, {});

describe('live assistant tools', () => {
  it('uses current pushes for recency and filters excluded and forked repos', async () => {
    const result = await run(createAssistantTools(deps(), undefined, () => now).recent_activity, {}) as { activity: Array<{ repo: string; lastActivity: string }> };
    expect(result.activity.map((item) => item.repo)).toEqual(['lagging', 'alpha']);
    expect(result.activity[0].lastActivity).toBe('2026-09-29T00:00:00Z');
  });
  it('keeps only the newest ten pushes inside 30 days', async () => {
    const many = Array.from({ length: 12 }, (_, index) => repo(`r${index}`, `2026-09-${String(29 - index).padStart(2, '0')}T00:00:00Z`));
    many.push(repo('old', '2026-08-01T00:00:00Z'));
    const tools = createAssistantTools({ ...deps(), live: { ...live, currentRepos: async () => many } }, undefined, () => now);
    const result = await run(tools.recent_activity, {}) as { activity: Array<{ repo: string }> };
    expect(result.activity).toHaveLength(10);
    expect(result.activity.map((item) => item.repo)).toEqual(Array.from({ length: 10 }, (_, index) => `r${index}`));
  });
  it('falls back to live details and hides excluded repositories', async () => {
    const tools = createAssistantTools(deps());
    expect(await run(tools.get_repo, { name: 'lagging' })).toMatchObject({ name: 'lagging', untrusted_text: 'text\nREADME' });
    expect(await run(tools.get_repo, { name: 'hidden' })).toEqual({ notFound: true });
  });
  it('validates, limits, filters and redacts code search', async () => {
    const tools = createAssistantTools(deps());
    expect(await run(tools.search_code, { terms: 'x!bad' })).toMatchObject({ invalidTerms: true });
    expect(await run(tools.search_code, { terms: 'x'.repeat(65) })).toMatchObject({ invalidTerms: true });
    const result = await run(tools.search_code, { terms: 'worker' }) as { hits: Array<{ repo: string; untrusted_text: string }> };
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].untrusted_text).not.toContain('xxxxxxxx');
    expect(result.hits[0].untrusted_text.length).toBeLessThanOrEqual(160);
    expect(await run(tools.search_code, { terms: 'other' })).toEqual({ alreadyUsed: true });
  });
  it('reports rate limits and failures', async () => {
    const limited = createAssistantTools({ ...deps(), live: { ...live, searchCode: async () => ({ rateLimited: true as const }) } });
    expect(await run(limited.search_code, { terms: 'worker' })).toEqual({ rateLimited: true });
    const failed = createAssistantTools({ ...deps(), live: { ...live, currentRepos: async () => { throw new Error('offline'); } } });
    expect(await run(failed.recent_activity, {})).toEqual({ unavailable: true, what: 'github' });
  });
});

describe('degraded live GitHub', () => {
  const snapshotRepo = (name: string) => ({ meta: { name, description: null, topics: [], fork: false, archived: false,
    pushedAt: '2026-09-01T00:00:00Z', htmlUrl: `https://github.com/example/${name}` }, languages: {}, readme: null,
    manifests: [{ path: 'requirements.txt', content: 'kafka-python', skimmed: false }] });

  it('answers from the snapshot when the live repo list fails', async () => {
    const { buildInventory } = await import('../src/inventory/build');
    const inventory = buildInventory({ owner: 'example', generatedAt: '2026-09-01T00:00:00Z',
      aliases: { kafka: { label: 'Kafka', category: 'data', aliases: ['kafka-python'] } }, repos: [snapshotRepo('Stream-App')] });
    const failing = { ...live, currentRepos: async () => { throw new Error('GitHub API error (HTTP 503)'); } };
    const tools = createAssistantTools({ inventory: async () => inventory, live: failing });
    expect(await run(tools.lookup_tech, { query: 'kafka' })).toMatchObject({ evidence: [{ repo: 'Stream-App', file: 'requirements.txt' }] });
    expect(await run(tools.get_repo, { name: 'stream-app' })).toMatchObject({ name: 'Stream-App' });
  });

  it('resolves a repo name typed in a different case', async () => {
    const tools = createAssistantTools(deps());
    expect(await run(tools.get_repo, { name: 'LAGGING' })).toMatchObject({ name: 'lagging' });
  });
});
