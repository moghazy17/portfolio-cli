import { describe, expect, it } from 'vitest';
import { createAssistantTools } from '../src/assistant/server/tools';

const run = async (entry: { execute?: (args: any, context: any) => Promise<unknown> }, args: object) => entry.execute!(args, {});

describe('assistant run_command services', () => {
  it('gives read-only live commands the data the host provides', async () => {
    const tools = createAssistantTools({
      inventory: async () => null,
      commandServices: {
        live: {
          presence: async () => ({ total: 4, bySurface: { web: 4 }, at: '2026-10-02T00:00:00Z' }),
          guestbook: async () => [{ id: 'a1', name: 'Mira', message: 'Lovely terminal', at: '2026-10-01T00:00:00Z' }],
        },
      },
    });
    expect(JSON.stringify(await run(tools.run_command, { commandLine: 'guestbook' }))).toContain('Lovely terminal');
    expect(JSON.stringify(await run(tools.run_command, { commandLine: 'who' }))).toContain('4 people');
  });

  it('reports the live commands as unavailable without services', async () => {
    const tools = createAssistantTools({ inventory: async () => null });
    expect(JSON.stringify(await run(tools.run_command, { commandLine: 'guestbook' }))).toContain('unavailable');
  });
});
