import { describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import type { UIMessage } from 'ai';
import { boundHistory, createAssistantStream } from '../src/assistant/server/stream';
import { createAssistantTools, createToolBudget, redactOutput } from '../src/assistant/server/tools';
import { commandRegistry } from '../src/commands/registry';
import { buildInventory } from '../src/inventory/build';

const question: UIMessage = { id: 'q', role: 'user', parts: [{ type: 'text', text: 'Show the projects' }] };
const run = async (tool: { execute?: (args: any, context: any) => Promise<unknown> }, args: object) => tool.execute!(args, {});

describe('assistant command tool', () => {
  it('emits structured output while returning plain text to the model', async () => {
    const onCommand = vi.fn();
    const tools = createAssistantTools({ inventory: async () => null, surface: 'web', onCommand });
    const result = await run(tools.run_command, { commandLine: 'about' });
    expect(result).toMatchObject({ ok: true, commandLine: 'about', text: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain('output');
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ commandLine: 'about', output: expect.any(Array), status: 'ok' }));
  });

  it('rejects disallowed commands and guards a sixth call', async () => {
    const budget = createToolBudget();
    const tools = createAssistantTools({ inventory: async () => null }, budget);
    expect(await run(tools.run_command, { commandLine: 'theme' })).toMatchObject({ ok: false, reason: 'not_allowed' });
    for (let index = 0; index < 4; index++) await run(tools.lookup_tech, { query: 'test' });
    expect(budget.exhausted).toBe(true);
    expect(await run(tools.run_command, { commandLine: 'about' })).toEqual({ budgetExhausted: true });
  });

  it('discards output from a command that unexpectedly produces an effect', async () => {
    const command = commandRegistry.find((item) => item.name === 'about')!;
    const original = command.execute;
    command.execute = async () => ({ output: [{ type: 'text', content: 'hidden' }], openUrl: 'https://example.invalid' });
    try {
      const onCommand = vi.fn();
      const tools = createAssistantTools({ inventory: async () => null, onCommand });
      expect(await run(tools.run_command, { commandLine: 'about' })).toMatchObject({ ok: false, reason: 'effect_blocked' });
      expect(onCommand).not.toHaveBeenCalled();
    } finally {
      command.execute = original;
    }
  });
});

describe('assistant stream', () => {
  it('does not start another model step after abort', async () => {
    const controller = new AbortController();
    const model = new MockLanguageModelV3({ doStream: async () => ({ stream: new ReadableStream({ start(stream) {
      stream.enqueue({ type: 'tool-call', toolCallId: 'abort-call', toolName: 'run_command', input: JSON.stringify({ commandLine: 'about' }) });
      stream.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
      stream.close();
    } }) }) });
    const stream = createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => null, onCommand: () => controller.abort() }, model, signal: controller.signal });
    for await (const part of stream) void part;
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it('cites evidence returned by a tool when its repo appears in the answer', async () => {
    const inventory = buildInventory({ owner: 'example', generatedAt: new Date().toISOString(),
      aliases: { kafka: { label: 'Kafka', category: 'data', aliases: ['kafka-python'] } },
      repos: ['alpha', 'beta'].map((name) => ({ meta: { name, description: null, topics: [], fork: false, archived: false, pushedAt: new Date().toISOString(), htmlUrl: `https://example.invalid/${name}` }, languages: {}, readme: '', manifests: [{ path: 'requirements.txt', content: 'kafka-python', skimmed: false }] })) });
    let step = 0;
    let answer = 'See beta.';
    const model = new MockLanguageModelV3({ doStream: async () => ({ stream: new ReadableStream({ start(controller) {
      if (step++ === 0) {
        controller.enqueue({ type: 'tool-call', toolCallId: 'lookup', toolName: 'lookup_tech', input: JSON.stringify({ query: 'kafka' }) });
        controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
      } else {
        controller.enqueue({ type: 'text-start', id: 't' });
        controller.enqueue({ type: 'text-delta', id: 't', delta: answer });
        controller.enqueue({ type: 'text-end', id: 't' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
      }
      controller.close();
    } }) }) });
    const parts = [];
    for await (const part of createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => inventory }, model })) parts.push(part);
    expect(parts.find((part) => part.type === 'data-sources')).toMatchObject({ data: { commands: [], evidence: [{ repo: 'beta', file: 'requirements.txt' }], repos: [] } });
    step = 0;
    answer = 'Evidence found.';
    const fallbackParts = [];
    for await (const part of createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => inventory }, model })) fallbackParts.push(part);
    expect(fallbackParts.find((part) => part.type === 'data-sources')).toMatchObject({ data: { evidence: [
      { repo: 'alpha', file: 'requirements.txt' }, { repo: 'beta', file: 'requirements.txt' },
    ] } });
  });

  it('keeps only decline on the sixth model step after five calls', async () => {
    let step = 0;
    const model = new MockLanguageModelV3({ doStream: async () => ({
      stream: new ReadableStream({ start(controller) {
        const current = step++;
        if (current < 5) {
          controller.enqueue({ type: 'tool-call', toolCallId: `call-${current}`, toolName: 'run_command', input: JSON.stringify({ commandLine: 'about' }) });
          controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        } else {
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'Done' });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        }
        controller.close();
      } }),
    }) });
    const parts = [];
    for await (const part of createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => null }, model })) parts.push(part);
    expect(model.doStreamCalls).toHaveLength(6);
    expect(model.doStreamCalls[5].tools).toHaveLength(1);
    expect(model.doStreamCalls[5].tools?.[0]).toMatchObject({ name: 'decline' });
    expect(parts.filter((part) => part.type === 'data-command')).toHaveLength(5);
  });

  it('sends command output as data, then a source after the final answer', async () => {
    let step = 0;
    const model = new MockLanguageModelV3({ doStream: async () => ({
      stream: new ReadableStream({ start(controller) {
        if (step++ === 0) {
          controller.enqueue({ type: 'tool-call', toolCallId: 'call-1', toolName: 'run_command', input: JSON.stringify({ commandLine: 'about' }) });
          controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        } else {
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'Summary' });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        }
        controller.close();
      } }),
    }) });
    const parts = [];
    for await (const part of createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => null }, model })) parts.push(part);
    expect(parts.find((part) => part.type === 'data-command')).toMatchObject({ data: { commandLine: 'about', output: expect.any(Array) } });
    expect(parts.find((part) => part.type === 'data-sources')).toMatchObject({ data: { commands: ['about'], evidence: [], repos: [] } });
    expect(parts.some((part) => part.type.startsWith('tool-'))).toBe(false);
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('keeps only text history and forwards text without tool parts', async () => {
    const model = new MockLanguageModelV3({ doStream: async () => ({
      stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'text-start', id: 't' });
        controller.enqueue({ type: 'text-delta', id: 't', delta: 'Answer' });
        controller.enqueue({ type: 'text-end', id: 't' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        controller.close();
      } }),
    }) });
    const history: UIMessage[] = Array.from({ length: 12 }, (_, index) => ({ id: `h${index}`, role: 'user', parts: [
      { type: 'text', text: `turn ${index}` }, { type: 'data-command', data: { output: 'secret' } },
    ] as UIMessage['parts'] }));
    const onFinish = vi.fn();
    const stream = createAssistantStream({ messages: [...history, question], surface: 'web', deps: { inventory: async () => null }, model, onFinish });
    const parts = [];
    for await (const part of stream) parts.push(part);
    expect(parts.some((part) => part.type === 'text-delta' && part.delta === 'Answer')).toBe(true);
    expect(parts.some((part) => part.type.startsWith('tool-'))).toBe(false);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain('secret');
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain('turn 0');
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ text: 'Answer', error: false }));
  });
});

describe('history bounds', () => {
  const text = (message: UIMessage) => (message.parts[0] as { text: string }).text;
  const msg = (id: string, role: 'user' | 'assistant', body: string): UIMessage => ({ id, role, parts: [{ type: 'text', text: body }] });

  it('caps each earlier message and the total, keeping the question intact', () => {
    const question = msg('q', 'user', 'What has he built with RAG?');
    const bounded = boundHistory([msg('a', 'user', 'x'.repeat(100_000)), msg('b', 'assistant', 'y'.repeat(100_000)), question]);
    expect(bounded.at(-1)).toEqual(question);
    for (const message of bounded.slice(0, -1)) expect(text(message).length).toBeLessThanOrEqual(1500);
    expect(bounded.reduce((sum, message) => sum + text(message).length, 0)).toBeLessThanOrEqual(6000);
  });

  it('drops the oldest turns first when the total is too large', () => {
    const turns = Array.from({ length: 9 }, (_, index) => msg(`t${index}`, index % 2 ? 'assistant' : 'user', `${index}`.repeat(1500)));
    const bounded = boundHistory([...turns, msg('q', 'user', 'latest?')]);
    expect(bounded.at(-1)?.id).toBe('q');
    expect(bounded[0].id).not.toBe('t0');
    expect(bounded.map((message) => message.id)).toEqual([...turns.slice(-bounded.length + 1).map((m) => m.id), 'q']);
  });
});

describe('server-side redaction', () => {
  it('redacts a secret split across model text deltas before it leaves the server', async () => {
    const secret = `ghp_${'a'.repeat(36)}`;
    const model = new MockLanguageModelV3({ doStream: async () => ({
      stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'text-start', id: 't' });
        controller.enqueue({ type: 'text-delta', id: 't', delta: `The token is ${secret.slice(0, 10)}` });
        controller.enqueue({ type: 'text-delta', id: 't', delta: `${secret.slice(10)} as found.` });
        controller.enqueue({ type: 'text-end', id: 't' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        controller.close();
      } }),
    }) });
    const onFinish = vi.fn();
    const stream = createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => null }, model, onFinish });
    let emitted = '';
    for await (const part of stream) if (part.type === 'text-delta') emitted += part.delta;
    expect(emitted).toBe('The token is [redacted] as found.');
    expect(onFinish.mock.calls[0][0].text).toBe(emitted);
  });

  it('redacts secrets inside structured command output', () => {
    const secret = `ghp_${'b'.repeat(36)}`;
    const output = redactOutput([{ type: 'table', headers: ['k', 'v'], rows: [['bio', `hi ${secret}`]] } as never]);
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(JSON.stringify(output)).toContain('[redacted]');
  });
});

describe('sources for repository listings', () => {
  it('cites repos returned by list_repos that the answer mentions', async () => {
    const inventory = buildInventory({ owner: 'example', generatedAt: new Date().toISOString(), aliases: {},
      repos: [
        { meta: { name: 'alpha-app', description: null, topics: [], fork: false, archived: false, pushedAt: '2026-09-01T00:00:00Z', htmlUrl: 'https://github.com/example/alpha-app' }, languages: {}, readme: null, manifests: [] },
        { meta: { name: 'beta-app', description: null, topics: [], fork: false, archived: false, pushedAt: '2026-08-01T00:00:00Z', htmlUrl: 'https://github.com/example/beta-app' }, languages: {}, readme: null, manifests: [] },
      ] });
    let call = 0;
    const model = new MockLanguageModelV3({ doStream: async () => ({
      stream: new ReadableStream({ start(controller) {
        if (call++ === 0) {
          controller.enqueue({ type: 'tool-call', toolCallId: 'l1', toolName: 'list_repos', input: '{}' });
          controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        } else {
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'The most recent is alpha-app.' });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
        }
        controller.close();
      } }),
    }) });
    const stream = createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => inventory }, model });
    let sources: { repos: string[] } | undefined;
    for await (const part of stream) if (part.type === 'data-sources') sources = part.data as { repos: string[] };
    expect(sources?.repos).toEqual(['alpha-app']);
  });
});
