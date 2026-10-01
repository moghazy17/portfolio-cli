import { describe, expect, it, vi } from 'vitest';
import { createShell } from '../src/shell';

describe('shell ask effect', () => {
  it('returns the unknown handler ask effect unchanged', async () => {
    const ask = { question: 'Which technologies are used?' };
    const shell = createShell({ surface: 'web', origin: '', onUnknownCommand: () => ({ output: [], ask }) });
    expect((await shell.run(ask.question)).ask).toBe(ask);
  });

  it('does not produce ask for a known command', async () => {
    const onUnknownCommand = vi.fn(() => ({ output: [], ask: { question: 'unused' } }));
    const shell = createShell({ surface: 'web', origin: '', onUnknownCommand });
    expect((await shell.run('pwd')).ask).toBeUndefined();
    expect(onUnknownCommand).not.toHaveBeenCalled();
  });

  it('preserves ask through effect merging', async () => {
    const ask = { question: 'A synthetic effect' };
    const shell = createShell({ surface: 'web', origin: '', registry: [{
      name: 'fixture', description: '', usage: 'fixture', aliases: [],
      execute: () => ({ output: [], ask }),
    }] });
    expect((await shell.run('fixture && fixture')).ask).toBe(ask);
  });
});
