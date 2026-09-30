import { describe, expect, it, vi } from 'vitest';
import { askAssistant, toRequestMessages } from '../src/assistant/client';
import type { AssistantEvent, AssistantTurn } from '../src/assistant/types';

type Chunk = Record<string, unknown>;

const encoder = new TextEncoder();

function sse(chunks: Chunk[]): string {
  return [...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`), 'data: [DONE]\n\n'].join('');
}

function streamResponse(chunks: Chunk[]): Response {
  return new Response(sse(chunks), { headers: { 'content-type': 'text/event-stream' } });
}

const text = (id: string, ...deltas: string[]): Chunk[] => [
  { type: 'text-start', id },
  ...deltas.map((delta) => ({ type: 'text-delta', id, delta })),
  { type: 'text-end', id },
];

const command = { id: 'c1', commandLine: 'projects | grep -i rag', output: [{ type: 'text', content: 'rag-pipeline' }], status: 'ok' };
const sources = { commands: ['projects | grep -i rag'], evidence: [{ repo: 'demo', file: 'README.md' }], repos: ['demo'] };

async function collect(iterable: AsyncIterable<AssistantEvent>): Promise<AssistantEvent[]> {
  const events: AssistantEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

function ask(fetchImpl: typeof fetch, extra: Partial<Parameters<typeof askAssistant>[0]> = {}) {
  return askAssistant({
    endpoint: '/api/chat', question: 'what RAG work?', history: [], surface: 'web',
    signal: new AbortController().signal, fetch: fetchImpl, ...extra,
  });
}

describe('askAssistant', () => {
  it('maps stream parts to events in order and ends with done', async () => {
    const fetchImpl = vi.fn(async () => streamResponse([
      { type: 'start' },
      { type: 'data-command', data: command },
      { type: 'start-step' },
      ...text('t1', 'Two ', 'systems.'),
      { type: 'data-sources', data: sources },
      { type: 'data-notice', data: { kind: 'stale', message: 'Data may be out of date.' } },
      { type: 'data-decline', data: { category: 'off_topic' } },
      { type: 'data-unknown', data: {} },
      { type: 'tool-input-available', toolCallId: 'x', toolName: 'y', input: {} },
      { type: 'finish' },
    ])) as unknown as typeof fetch;
    const events = await collect(ask(fetchImpl));
    expect(events).toEqual([
      { type: 'command', ...command },
      { type: 'text', delta: 'Two systems.' },
      { type: 'sources', ...sources },
      { type: 'notice', kind: 'stale', message: 'Data may be out of date.' },
      { type: 'declined', category: 'off_topic' },
      { type: 'done' },
    ]);
  });

  it('sanitizes text and redacts a secret split across deltas', async () => {
    const secret = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const fetchImpl = (async () => streamResponse(text('t1', '**Bold** claim. Key ', secret.slice(0, 12), secret.slice(12), ' end.'))) as unknown as typeof fetch;
    const joined = (await collect(ask(fetchImpl)))
      .flatMap((event) => (event.type === 'text' ? [event.delta] : [])).join('');
    expect(joined).toBe('Bold claim. Key [redacted] end.');
    expect(joined).not.toContain('ghp_');
  });

  it('stops without throwing when aborted mid-stream', async () => {
    const controller = new AbortController();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        async start(stream) {
          stream.enqueue(encoder.encode(sse([{ type: 'data-command', data: command }]).replace('data: [DONE]\n\n', '')));
          await gate;
          if (init?.signal?.aborted) {
            stream.error(new DOMException('aborted', 'AbortError'));
            return;
          }
          stream.enqueue(encoder.encode(sse([{ type: 'text-delta', id: 't', delta: 'Never shown.' }])));
          stream.close();
        },
      });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    }) as unknown as typeof fetch;
    const events: AssistantEvent[] = [];
    for await (const event of ask(fetchImpl, { signal: controller.signal })) {
      events.push(event);
      controller.abort();
      release();
    }
    expect(JSON.stringify(events)).not.toContain('Never shown');
    expect(events.at(-1)?.type).not.toBe('done');
  });

  it('turns HTTP failures and network errors into an error notice followed by done', async () => {
    const failures: Array<typeof fetch> = [
      (async () => new Response('{"error":"Forbidden"}', { status: 403 })) as unknown as typeof fetch,
      (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch,
      (async () => { throw new TypeError('network down'); }) as unknown as typeof fetch,
    ];
    for (const fetchImpl of failures) {
      const events = await collect(ask(fetchImpl));
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ type: 'notice', kind: 'error' });
      expect((events[0] as { message: string }).message).not.toMatch(/Forbidden|boom|network down/);
      expect(events[1]).toEqual({ type: 'done' });
    }
  });

  it('turns a stream error part into an error notice', async () => {
    const fetchImpl = (async () => streamResponse([{ type: 'error', errorText: 'internal detail' }])) as unknown as typeof fetch;
    const events = await collect(ask(fetchImpl));
    expect(events[0]).toMatchObject({ type: 'notice', kind: 'error' });
    expect(JSON.stringify(events)).not.toContain('internal detail');
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('sends the surface, the last ten turns and the question', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return streamResponse([]);
    }) as unknown as typeof fetch;
    const history: AssistantTurn[] = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `turn ${i}` }));
    await collect(ask(fetchImpl, { surface: 'ssh', history, headers: { 'X-Test': '1' } }));
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('/api/chat');
    expect(new Headers(requests[0].init.headers).get('x-test')).toBe('1');
    const body = JSON.parse(requests[0].init.body as string);
    expect(body.surface).toBe('ssh');
    expect(body.messages).toHaveLength(11);
    expect(body.messages.map((message: { role: string; parts: Array<{ text: string }> }) => [message.role, message.parts[0].text])).toEqual([
      ...history.slice(2).map((turn) => [turn.role, turn.text]),
      ['user', 'what RAG work?'],
    ]);
  });
});

describe('toRequestMessages', () => {
  it('sends only the last ten messages, as text parts', () => {
    const messages = Array.from({ length: 14 }, (_, index) => ({
      id: `m${index}`, role: index % 2 ? 'assistant' as const : 'user' as const,
      parts: [
        { type: 'text' as const, text: `turn ${index}` },
        { type: 'data-command' as const, data: { output: 'x'.repeat(50_000) } },
      ],
    }));
    const sent = toRequestMessages(messages as never);
    expect(sent.map((message) => message.id)).toEqual(messages.slice(-10).map((message) => message.id));
    expect(JSON.stringify(sent)).not.toContain('data-command');
    expect(JSON.stringify(sent).length).toBeLessThan(2_000);
  });
});
