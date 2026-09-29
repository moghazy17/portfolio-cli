import { describe, expect, it } from 'vitest';
import { createShell } from '../src/shell/shell';
import { createAssistantUnknownHandler } from '../src/assistant/handler';
import type { Surface } from '../src/types';

function shell(surface: Surface = 'web') {
  return createShell({ surface, origin: '', onUnknownCommand: createAssistantUnknownHandler() });
}

const notFound = (word: string) => ({ type: 'error', content: `command not found: ${word}` });

describe('assistant unknown-input handler', () => {
  it('falls back to not-found on the curl surface', async () => {
    const result = await shell('curl').run('what is his stack');
    expect(result.ask).toBeUndefined();
    expect(result.output[0]).toEqual(notFound('what'));
  });

  it('keeps the did-you-mean suggestion for a single mistyped word', async () => {
    const result = await shell().run('projcts');
    expect(result.ask).toBeUndefined();
    expect(result.output).toContainEqual({ type: 'text', content: 'did you mean `projects`?' });
  });

  it('asks about a single unknown word that has no suggestion', async () => {
    const result = await shell().run('kafka');
    expect(result.ask).toEqual({ question: 'kafka' });
    expect(result.output).toEqual([]);
  });

  it('never pipes unknown input into the assistant', async () => {
    const result = await shell().run('who is he | grep python');
    expect(result.ask).toBeUndefined();
    expect(result.output[0]).toEqual(notFound('who'));
  });

  it('ignores a pipe inside quotes but not an apostrophe', async () => {
    expect((await shell().run('what does "a|b" mean')).ask).toEqual({ question: 'what does "a|b" mean' });
    expect((await shell().run("what's 'a|b' mean")).ask).toEqual({ question: "what's 'a|b' mean" });
    const piped = await shell().run("what's a|b mean");
    expect(piped.ask).toBeUndefined();
    expect(piped.output[0]).toEqual(notFound("what's"));
  });

  it('rejects a question over 500 characters without asking', async () => {
    const result = await shell().run(`why ${'x'.repeat(497)}`);
    expect(result.ask).toBeUndefined();
    expect(result.status).toBe('error');
    expect(result.output).toEqual([{ type: 'error', content: 'question too long (max 500 characters)' }]);
    expect((await shell().run(`why ${'x'.repeat(496)}`)).ask).toBeDefined();
  });

  it('asks with the trimmed question', async () => {
    const result = await shell().run('  what RAG work has he done?  ');
    expect(result).toMatchObject({ output: [], ask: { question: 'what RAG work has he done?' } });
  });

  it('runs a known command with arguments instead of reaching the handler', async () => {
    const result = await shell().run('projects rag');
    expect(result.ask).toBeUndefined();
  });
});
