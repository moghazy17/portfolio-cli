import { describe, expect, it } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import type { UIMessage } from 'ai';
import { profile } from '../src/content';
import { createAssistantStream } from '../src/assistant/server/stream';
import { createAssistantTools, createToolBudget } from '../src/assistant/server/tools';

const question: UIMessage = { id: 'q', role: 'user', parts: [{ type: 'text', text: 'Question' }] };
const cases = [
  ['off_topic', `I only answer questions about ${profile.firstName}'s work — try \`has he used Kafka?\` or type \`help\`.`],
  ['personal', `That's best asked to ${profile.firstName} directly — run \`contact\` for how to reach him.`],
  ['instructions', `I can't share or change my instructions, but I'm happy to answer questions about ${profile.firstName}'s work.`],
] as const;

describe('decline', () => {
  it.each(cases)('stops and emits the fixed %s response', async (category, expected) => {
    const model = new MockLanguageModelV3({ doStream: async () => ({ stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: 'tool-call', toolCallId: 'decline-1', toolName: 'decline', input: JSON.stringify({ category }) });
      controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
      controller.close();
    } }) }) });
    const parts = [];
    for await (const part of createAssistantStream({ messages: [question], surface: 'web', deps: { inventory: async () => null }, model })) parts.push(part);
    expect(model.doStreamCalls).toHaveLength(1);
    const declineIndex = parts.findIndex((part) => part.type === 'data-decline');
    const textIndex = parts.findIndex((part) => part.type === 'text-delta');
    expect(parts[declineIndex]).toMatchObject({ data: { category } });
    expect(declineIndex).toBeLessThan(textIndex);
    expect(parts.filter((part) => part.type === 'text-delta').map((part) => part.delta).join('')).toBe(expected);
  });

  it('does not consume the budget', async () => {
    const budget = createToolBudget();
    const tools = createAssistantTools({ inventory: async () => null }, budget);
    for (let i = 0; i < 5; i++) await tools.lookup_tech.execute!({ query: 'test' }, {} as never);
    expect(budget.exhausted).toBe(true);
    expect(await tools.decline.execute!({ category: 'off_topic' }, {} as never)).toEqual({ ok: true });
    expect(budget.used).toBe(5);
  });
});
