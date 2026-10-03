import { describe, expect, it } from 'vitest';
import {
  commandRegistry,
  content,
  executeCommand,
  getMenuItems,
} from '../src/index';

// Intentional snapshot exceptions to update deliberately when changed: help listing/tip,
// sudo hint text, unknown-command text, rm <non-root path>, and --help on commands.

function normalize<T>(value: T): T {
  const clone = structuredClone(value);
  const result = clone as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (!['output', 'clear', 'mode', 'openUrl'].includes(key)) delete result[key];
  }

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== 'object') return;

    const record = node as Record<string, unknown>;
    if (record.type === 'section') delete record.item;
    if (record.type === 'table' && Array.isArray(record.rows)) {
      record.rows = record.rows.filter((row) =>
        !Array.isArray(row) || !/^(ls|cd|pwd|cat|tree|man|resume)(\s|$)/.test(String(row[0])));
    }
    Object.values(record).forEach(visit);
  }

  visit(clone);
  return clone;
}

describe('legacy command output', () => {
  const legacyCommands = new Set([
    'help', 'about', 'education', 'experience', 'projects', 'skills',
    'certifications', 'contact', 'open', 'timeline', 'theme', 'welcome',
    'whoami', 'github', 'chat', 'clear', 'sudo', 'rm', 'neofetch', 'hello', 'exit',
  ]);
  for (const command of commandRegistry) {
    if (!legacyCommands.has(command.name)) continue;
    const inputs = [command.name, ...command.aliases].filter(
      (input) => input !== 'rm -rf /',
    );

    for (const input of inputs) {
      if (input === 'github' || input === 'gh') continue;

      it(`snapshots ${input}`, async () => {
        const result = await executeCommand(input);

        if (['hello', 'hi', 'hey'].includes(input)) {
          expect(result.output.map((node) => node.type)).toMatchSnapshot();
          return;
        }

        expect(normalize(result)).toMatchSnapshot();
      });
    }
  }

  it('snapshots rm -rf /', async () => {
    expect(normalize(await executeCommand('rm -rf /'))).toMatchSnapshot();
  });

  const firstWorkSlug = content.resume.work[0].slug;
  const firstProjectSlug = content.resume.projects[0].slug;
  const firstSkillCategory = content.resume.skills[0].name
    .toLowerCase()
    .split(/\s+/)[0];
  const argumentCases = [
    `experience ${firstWorkSlug}`,
    'experience zzz',
    `projects ${firstProjectSlug}`,
    'projects zzz',
    `skills ${firstSkillCategory}`,
    'skills zzz',
    'theme',
    'theme dracula',
    'theme zzz',
    'open',
    'open github',
    'open zzz',
    'sudo',
    'sudo hire ahmed',
    'projcts',
  ];

  for (const input of argumentCases) {
    it(`snapshots ${input}`, async () => {
      expect(normalize(await executeCommand(input))).toMatchSnapshot();
    });
  }

  it('snapshots menu items', () => {
    expect(getMenuItems().map((item) => item.value)).toEqual([
      'help', 'about', 'education', 'experience', 'projects', 'skills',
      'certifications', 'contact', 'timeline', 'github', 'gui', 'tour', 'guestbook', 'resume',
    ]);
    expect(getMenuItems()).toMatchSnapshot();
  });

  it('returns theme and welcome effects', async () => {
    expect((await executeCommand('theme dracula')).theme).toBe('dracula');
    expect((await executeCommand('theme zzz')).theme).toBeUndefined();
    expect((await executeCommand('home')).welcome).toBe(true);
  });
});
