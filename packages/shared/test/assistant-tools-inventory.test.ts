import { describe, expect, it } from 'vitest';
import { capResult, createAssistantTools, createToolBudget } from '../src/assistant/server/tools';
import { buildInventory } from '../src/inventory/build';
import type { AssistantLive } from '../src/assistant/server/tools';

const snapshot = buildInventory({ owner: 'example', generatedAt: '2026-01-01T00:00:00.000Z',
  aliases: { kafka: { label: 'Kafka', category: 'data', aliases: ['kafka-python'] } }, repos: [
    { meta: { name: 'alpha', description: 'quoted description', topics: [], fork: false, archived: false, pushedAt: '2026-01-01T00:00:00.000Z', htmlUrl: 'https://github.com/example/alpha' }, languages: {}, readme: 'quoted README', manifests: [{ path: 'requirements.txt', content: 'kafka-python', skimmed: false }] },
  ] });
const run = async (tool: { execute?: (args: any, context: any) => Promise<unknown> }, args: object) => tool.execute!(args, {});
const live = (topics: string[], fork = false): AssistantLive => ({
  currentRepos: async () => [{ name: 'alpha', fork, topics, pushedAt: '2026-01-01T00:00:00Z', archived: false }],
  recentActivity: async () => [], repo: async () => null, searchCode: async () => [],
});

describe('inventory assistant tools', () => {
  it('caps serialized results and marks truncation', () => {
    const result = capResult({ untrusted_text: 'x'.repeat(3000) });
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(2000);
  });
  it('returns evidence and frames third-party text', async () => {
    const tools = createAssistantTools({ inventory: async () => snapshot });
    const result = await run(tools.get_repo, { name: 'alpha' });
    expect(result).toMatchObject({ name: 'alpha', untrusted_text: 'quoted description\nquoted README' });
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(2000);
    expect(await run(tools.lookup_tech, { query: 'kafka' })).toMatchObject({ totalRepos: 1 });
    expect(await run(tools.list_repos, {})).toMatchObject({ total: 1 });
  });
  it('uses one not-found shape for unknown and excluded repositories', async () => {
    const tools = createAssistantTools({ inventory: async () => snapshot });
    expect(await run(tools.get_repo, { name: 'missing' })).toEqual({ notFound: true });
    expect(await run(tools.get_repo, { name: 'hidden' })).toEqual({ notFound: true });
    const liveTools = createAssistantTools({ inventory: async () => snapshot,
      live: live(['portfolio-exclude']) });
    expect(await run(liveTools.get_repo, { name: 'alpha' })).toEqual({ notFound: true });
    const forkTools = createAssistantTools({ inventory: async () => snapshot,
      live: live([], true) });
    expect(await run(forkTools.get_repo, { name: 'alpha' })).toEqual({ notFound: true });
  });
  it('reports unavailable inventory and enforces five calls', async () => {
    const tools = createAssistantTools({ inventory: async () => null }, createToolBudget());
    expect(await run(tools.lookup_tech, { query: 'kafka' })).toEqual({ unavailable: true, what: 'inventory' });
    for (let i = 0; i < 4; i++) await run(tools.list_repos, {});
    expect(await run(tools.list_repos, {})).toEqual({ budgetExhausted: true });
  });
});
