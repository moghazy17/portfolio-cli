import { describe, expect, it, vi } from 'vitest';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';
import { commandRegistry } from '../src/commands/registry';
import type { LiveServices } from '../src/types';

const origin = 'https://example.test';
const entries = Array.from({ length: 22 }, (_, index) => ({ id: String(index), name: `Person ${index}`, message: `Message ${index}`, at: new Date(Date.now() - index * 60_000).toISOString() }));
const live: LiveServices = { presence: async () => ({ total: 1, bySurface: { web: 1 }, at: new Date().toISOString() }), guestbook: async () => entries };
const text = (output: Awaited<ReturnType<ReturnType<typeof createShell>['run']>>['output']) => toLines(output).map((line) => line.text).join('\n');

describe('live commands', () => {
  it('shows singular and plural presence', async () => {
    expect(text((await createShell({ surface: 'web', origin, live }).run('who')).output)).toContain('1 person exploring right now');
    const many = { ...live, presence: async () => ({ total: 3, bySurface: { web: 3 }, at: new Date().toISOString() }) };
    expect(text((await createShell({ surface: 'web', origin, live: many }).run('who')).output)).toContain('3 people exploring right now');
  });

  it('runs bare who but routes argument text through unknown-command handling', async () => {
    const presence = vi.fn(live.presence);
    const unknown = vi.fn(() => ({ output: [{ type: 'text' as const, content: 'handled' }] }));
    const shell = createShell({ surface: 'web', origin, live: { ...live, presence }, onUnknownCommand: unknown });

    await shell.run('who');
    expect(presence).toHaveBeenCalledOnce();

    await expect(shell.run('who is he?')).resolves.toMatchObject({ output: [{ type: 'text', content: 'handled' }] });
    expect(unknown).toHaveBeenLastCalledWith({ raw: 'who is he?', word: 'who', suggestion: undefined }, expect.anything());

    await shell.run('who | grep web');
    expect(presence).toHaveBeenCalledTimes(2);
  });

  it('degrades when presence is missing or rejects', async () => {
    for (const service of [undefined, { ...live, presence: async () => { throw Error('offline'); } }]) {
      expect(text((await createShell({ surface: 'web', origin, live: service }).run('who')).output)).toContain('Live count unavailable right now.');
    }
  });

  it('lists 20 recent entries and gives a surface-specific hint', async () => {
    for (const surface of ['web', 'curl'] as const) {
      const output = text((await createShell({ surface, origin, live }).run('guestbook')).output);
      expect(output).toContain('Guestbook');
      expect(output).toContain('Person 0');
      expect(output).toContain('1 minute ago');
      expect(output).toContain('Person 19');
      expect(output).not.toContain('Person 20');
      expect(output).toContain(surface === 'web' ? 'sign "your message"' : origin);
    }
  });

  it('handles empty and unavailable guestbooks', async () => {
    expect(text((await createShell({ surface: 'web', origin, live: { ...live, guestbook: async () => [] } }).run('guestbook')).output)).toContain('No entries yet');
    expect(text((await createShell({ surface: 'web', origin }).run('guestbook')).output)).toContain('Guestbook unavailable right now.');
  });

  it('signs locally and leaves I/O to the host', async () => {
    const result = await createShell({ surface: 'web', origin }).run('sign "hi" --name Sam');
    expect(result.sign).toEqual({ name: 'Sam', message: 'hi' });
    expect(text(result.output)).toContain("Checking you're human");
    expect((await createShell({ surface: 'web', origin }).run('sign "hi"')).sign).toBeUndefined();
    expect(text((await createShell({ surface: 'web', origin }).run('sign "hi"')).output)).toContain('Please add your name');
    const invalid = await createShell({ surface: 'web', origin }).run('sign "http://example.com" --name Sam');
    expect(invalid.status).toBe('error');
    expect(invalid.sign).toBeUndefined();
    expect(text((await createShell({ surface: 'curl', origin }).run('sign "hi" --name Sam')).output)).toContain('interactive terminal');
  });

  it('marks only read commands assistant-safe', () => {
    expect(commandRegistry.find((item) => item.name === 'who')?.assistant).toBe(true);
    expect(commandRegistry.find((item) => item.name === 'guestbook')?.assistant).toBe(true);
    expect(commandRegistry.find((item) => item.name === 'sign')?.assistant).toBeFalsy();
  });
});
