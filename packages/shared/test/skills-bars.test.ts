import { describe, expect, it, vi } from 'vitest';
import { createShell } from '../src/shell/shell';
import { cvData } from '../src/content';
import { themes } from '../src/theme';
import { toLines } from '../src/shell/lines';

const options = { surface: 'web' as const, origin: 'https://example.test' };

describe('skills evidence bars', () => {
  it('scales counts and keeps the textual pipe output', async () => {
    const labels = cvData.skills.flatMap((cat) => cat.skills);
    const evidence = Object.fromEntries(labels.map((label) => [label, 0]));
    evidence[labels[0]] = 6;
    evidence[labels[1]] = 1;
    const shell = createShell({ ...options, skillEvidence: async () => evidence });
    const result = await shell.run('skills');
    const progress = result.output.flatMap((node) => node.type === 'section' ? node.children : []).filter((node) => node.type === 'progress');
    expect(progress).toHaveLength(labels.length);
    expect(progress[0]).toMatchObject({ type: 'progress', value: 1, note: '6 repos', reveal: true });
    expect(progress[1]).toMatchObject({ type: 'progress', value: 1 / 6, note: '1 repo', reveal: true });
    expect(progress[2]).toMatchObject({ type: 'progress', value: 0, note: 'no public repos', reveal: true });
    expect(toLines(result.output).at(-1)?.text).toBe('Bars: public GitHub repos using each skill (nightly).');
    const piped = await shell.run(`skills | grep -i ${labels[0].split(' ')[0]}`);
    expect(toLines(piped.output).some((line) => line.text.includes('6 repos'))).toBe(true);
  });

  it('preserves the plain list without evidence or when it fails', async () => {
    const plain = await createShell(options).run('skills');
    const rejected = await createShell({ ...options, skillEvidence: async () => { throw new Error('offline'); } }).run('skills');
    expect(rejected.output).toEqual(plain.output);
    vi.useFakeTimers();
    try {
      const pending = createShell({ ...options, skillEvidence: async () => new Promise(() => {}) }).run('skills');
      await vi.advanceTimersByTimeAsync(2001);
      expect((await pending).output).toEqual(plain.output);
    } finally { vi.useRealTimers(); }
  });

  it('offers the CRT theme', async () => {
    expect((await createShell(options).run('theme crt')).theme).toBe('crt');
    expect(themes.crt.effects?.crt).toBe(true);
  });
});
