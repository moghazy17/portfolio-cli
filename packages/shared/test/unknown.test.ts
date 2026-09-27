import { describe, expect, it, vi } from 'vitest';
import { createShell } from '../src/shell/shell';

describe('unknown input', () => {
  it('gives the default suggestion and guidance', async () => {
    expect(await createShell({ surface: 'web', origin: '' }).run('projcts')).toEqual({
      output: [
        { type: 'error', content: 'command not found: projcts' },
        { type: 'text', content: 'did you mean `projects`?' },
        { type: 'text', content: 'Type `help` for commands or `chat` to ask the AI.', style: { dim: true } },
      ], status: 'error',
    });
  });

  it('routes natural language directly to the hook', async () => {
    const hook = vi.fn(() => ({ output: [{ type: 'text' as const, content: 'handled' }] }));
    const instance = createShell({ surface: 'web', origin: '', onUnknownCommand: hook });
    for (const raw of ['who are you', "what's his stack?"]) {
      expect((await instance.run(raw)).output).toEqual([{ type: 'text', content: 'handled' }]);
      expect(hook).toHaveBeenLastCalledWith({ raw, word: raw.split(' ')[0], suggestion: undefined }, expect.anything());
    }
    expect((await instance.run('help && foo')).output).toContainEqual({ type: 'error', content: 'foo: command not found' });
    expect(hook).toHaveBeenCalledTimes(2);
    expect((await instance.run('help')).output.length).toBeGreaterThan(0);
    expect(hook).toHaveBeenCalledTimes(2);
  });

  it('recognises commands joined to operators or written with quotes and escapes', async () => {
    const hook = vi.fn(() => ({ output: [{ type: 'text' as const, content: 'handled' }] }));
    const instance = createShell({ surface: 'web', origin: '', onUnknownCommand: hook });
    const spaced = await instance.run('ls | grep md');
    expect(await instance.run('ls|grep md')).toEqual(spaced);
    const help = await instance.run('help');
    for (const line of ['"help"', "'help'", 'he"lp"', 'he\lp']) {
      expect((await instance.run(line)).output).toEqual(help.output);
    }
    expect((await instance.run('help&&about')).output.length).toBeGreaterThan(help.output.length);
    expect(hook).not.toHaveBeenCalled();
    await instance.run('yo|there');
    expect(hook).toHaveBeenLastCalledWith({ raw: 'yo|there', word: 'yo', suggestion: undefined }, expect.anything());
    expect((await instance.run('| grep x')).output).toEqual([{ type: 'error', content: "syntax error: missing command around '|'" }]);
  });
});
