import { describe, expect, it } from 'vitest';
import { createShell } from '../src/shell/shell';
import { askAssistant, createAssistantUnknownHandler, formatSourcesLine } from '../src/assistant';
import type { AssistantEvent } from '../src/assistant';
import type { Surface } from '../src/types';

const recorded = [
  { type: 'data-command', data: { id: 'c1', commandLine: 'projects | grep -i rag', output: [{ type: 'text', content: 'rag-pipeline' }], status: 'ok' } },
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: 'One **match** found.' },
  { type: 'text-end', id: 't' },
  { type: 'data-sources', data: { commands: ['projects | grep -i rag'], evidence: [{ repo: 'demo', file: 'README.md' }], repos: ['demo'] } },
];

const body = [...recorded.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`), 'data: [DONE]\n\n'].join('');

async function session(surface: Surface) {
  const shell = createShell({ surface, origin: '', onUnknownCommand: createAssistantUnknownHandler() });
  const routing = await Promise.all(
    ['what RAG work has he done?', 'projcts', 'who is he | grep python', 'projects rag'].map(async (line) => {
      const result = await shell.run(line);
      return { line, ask: result.ask, status: result.status, output: result.output };
    }),
  );
  const requests: unknown[] = [];
  const events: AssistantEvent[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
  }) as unknown as typeof fetch;
  for await (const event of askAssistant({
    endpoint: 'https://example.test/api/chat', question: 'what RAG work has he done?', history: [],
    surface: surface === 'ssh' ? 'ssh' : 'web', signal: new AbortController().signal, fetch: fetchImpl,
  })) events.push(event);
  const sources = events.find((event) => event.type === 'sources');
  return { routing, events, requests, line: sources?.type === 'sources' ? formatSourcesLine(sources) : '' };
}

describe('assistant web and ssh parity', () => {
  it('routes, streams and cites identically on both surfaces', async () => {
    const web = await session('web');
    const ssh = await session('ssh');
    expect(ssh.routing).toEqual(web.routing);
    expect(ssh.events).toEqual(web.events);
    expect(ssh.line).toBe(web.line);
    expect(web.line).toBe('sources: projects | grep -i rag · demo/README.md · demo');
    expect(web.events.at(-1)).toEqual({ type: 'done' });
    expect(web.routing[0].ask).toEqual({ question: 'what RAG work has he done?' });
    expect(web.routing[1].ask).toBeUndefined();
    expect(web.routing[2].ask).toBeUndefined();
    expect(web.routing[3].ask).toBeUndefined();
    expect((web.requests[0] as { surface: string }).surface).toBe('web');
    expect((ssh.requests[0] as { surface: string }).surface).toBe('ssh');
  });
});
