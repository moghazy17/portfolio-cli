import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { commandRegistry } from '../src/commands/registry';
import { createShell } from '../src/shell/shell';
import { themes } from '../src/theme';

const shell = createShell({ surface: 'web', origin: '' });
const visible = commandRegistry.filter((def) => !def.hidden && def.kind !== 'filter').map((def) => def.name);
const filters = commandRegistry.filter((def) => !def.hidden && def.kind === 'filter').map((def) => def.name);

function uniquePrefix(value: string, values: string[]): string {
  for (let length = 1; length <= value.length; length++) {
    const prefix = value.slice(0, length);
    if (values.filter((candidate) => candidate.toLowerCase().startsWith(prefix.toLowerCase())).length === 1) return prefix;
  }
  return value;
}

describe('shell completion', () => {
  it('groups aliases under canonical visible command names', () => {
    expect(shell.complete('pro')).toEqual({ start: 0, end: 3, candidates: ['projects'], replacement: 'projects ' });
    expect(shell.complete('t').candidates).toEqual(visible.filter((name) => name.startsWith('t')));
    expect(shell.complete('t').candidates).toContain('theme');
    expect(shell.complete('t').candidates).toContain('timeline');
    expect(shell.complete('')).toEqual({ start: 0, end: 0, candidates: visible });
    expect(shell.complete('projects | ').candidates).toEqual(filters);
    expect(shell.complete('projects && ').candidates).toEqual(visible);
  });

  it('completes positional arguments from content and command data', () => {
    const sources = [
      ['projects', content.resume.projects.map((item) => item.slug)],
      ['experience', content.resume.work.map((item) => item.slug)],
      ['skills', content.resume.skills.map((item) => item.name)],
      ['theme', Object.keys(themes)],
      ['open', ['github', 'linkedin']],
    ] as const;
    for (const [command, values] of sources) {
      const value = values.find((item) => values.filter((candidate) => candidate.toLowerCase().startsWith(item.toLowerCase())).length === 1)!;
      const prefix = uniquePrefix(value, [...values]);
      const line = `${command} ${prefix}`;
      expect(shell.complete(line).candidates).toContain(value);
      expect(shell.complete(line).replacement).toBe(value.includes(' ') ? `"${value}" ` : `${value} `);
    }
  });

  it('handles quotes, multiple matches, missing matches and cursor position', () => {
    const spaced = content.resume.skills.find((item) => item.name.includes(' '));
    expect(spaced).toBeDefined();
    const names = content.resume.skills.map((item) => item.name);
    const prefix = uniquePrefix(spaced!.name, names);
    expect(shell.complete(`skills "${prefix}`)).toMatchObject({ start: 7, replacement: `"${spaced!.name}" ` });
    const multiple = shell.complete('t');
    expect(multiple.candidates.length).toBeGreaterThan(1);
    expect(multiple.replacement).toBeUndefined();
    // A slug that is a prefix of another (e.g. act / act-intern) completes to the shared stem without a space.
    const slugs = content.resume.work.map((item) => item.slug);
    const stem = slugs.find((slug) => slugs.some((other) => other !== slug && other.startsWith(slug)))!;
    expect(shell.complete(`experience ${stem.slice(0, 1)}`).replacement).toBe(stem);
    expect(shell.complete('projects zzz')).toEqual({ start: 9, end: 12, candidates: [] });
    expect(shell.complete('pro later', 3)).toEqual({ start: 0, end: 3, candidates: ['projects'], replacement: 'projects ' });
  });
});
