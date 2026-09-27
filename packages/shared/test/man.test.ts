import { describe, expect, it } from 'vitest';
import { commandRegistry } from '../src/commands/registry';
import { createShell } from '../src/shell/shell';

const shell = () => createShell({ surface: 'web', origin: 'https://example.test' });

describe('man command', () => {
  it('renders derived manual pages and resolves aliases', async () => {
    const sh = shell();
    const projects = await sh.run('man projects');
    expect(projects.output.filter((node) => node.type === 'section').map((node) => node.title))
      .toEqual(expect.arrayContaining(['NAME', 'SYNOPSIS', 'DESCRIPTION', 'EXAMPLES', 'ALIASES']));
    expect(projects.output).toContainEqual(expect.objectContaining({
      type: 'section', title: 'ALIASES', children: [{ type: 'text', content: 'proj' }],
    }));
    expect((await sh.run('man exp')).output).toEqual((await sh.run('man experience')).output);
    expect((await sh.run('man man')).status).toBe('ok');
  });

  it('lists filter options and completes visible command names', async () => {
    const sh = shell();
    const grep = await sh.run('man grep');
    const options = grep.output.find((node) => node.type === 'section' && node.title === 'OPTIONS');
    expect(options).toMatchObject({
      children: [{ type: 'table', rows: expect.arrayContaining([
        expect.arrayContaining(['-i, --ignore-case']),
        expect.arrayContaining(['-v, --invert-match']),
        expect.arrayContaining(['-c, --count']),
        expect.arrayContaining(['-h, --no-filename']),
      ]) }],
    });
    expect(sh.complete('man pro').replacement).toBe('projects ');
    expect(commandRegistry.find((def) => def.name === 'man')?.menu).not.toBe(true);
  });

  it('reports missing and unavailable manual pages', async () => {
    const sh = shell();
    expect(await sh.run('man')).toMatchObject({
      status: 'error',
      output: [
        { type: 'text', content: 'What manual page do you want?' },
        { type: 'text', content: "For example, try 'man projects'." },
      ],
    });
    for (const name of ['sudo', 'mkdir', 'nope']) {
      expect(await sh.run(`man ${name}`)).toMatchObject({
        status: 'error', output: [{ type: 'error', content: `No manual entry for ${name}` }],
      });
    }
  });
});
