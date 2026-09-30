import { describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import type { UIMessage } from 'ai';
import { createAssistantStream } from '../src/assistant/server/stream';
import { createAssistantTools, createToolBudget } from '../src/assistant/server/tools';
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

  it('removes all tools from the sixth model step after five calls', async () => {
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
    expect(model.doStreamCalls[5].tools).toEqual([]);
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
