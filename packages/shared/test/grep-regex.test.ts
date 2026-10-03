import { describe, expect, it } from 'vitest';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';
import { validateAssistantCommandLine } from '../src/assistant/allowlist';
import { commandRegistry } from '../src/commands/registry';

const run = async (line: string) => {
  const result = await createShell({ surface: 'web', origin: '' }).run(line);
  return { status: result.status, text: toLines(result.output).map((item) => item.text).join('\n') };
};

describe('grep -E', () => {
  it('matches alternatives inside a quoted pattern, combined with -i', async () => {
    const { status, text } = await run('skills | grep -iE "langchain|pandas"');
    expect(status).toBe('ok');
    expect(text).toMatch(/LangChain/);
    expect(text).toMatch(/Pandas/);
  });

  it('keeps literal matching without -E', async () => {
    expect((await run('skills | grep "langchain|pandas"')).status).toBe('error');
  });

  it('reports an invalid or oversized expression instead of throwing', async () => {
    expect((await run('skills | grep -E "("')).text).toContain('invalid regular expression');
    expect((await run(`skills | grep -E "${'a'.repeat(101)}"`)).text).toContain('pattern too long');
  });

  it('is a command line the assistant may run', () => {
    expect(validateAssistantCommandLine('experience | grep -iE "rag|langgraph"', commandRegistry)).toEqual({ ok: true });
  });
});
