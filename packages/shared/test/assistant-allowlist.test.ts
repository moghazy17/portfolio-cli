import { afterEach, describe, expect, it, vi } from 'vitest';
import { commandRegistry } from '../src/commands/registry';
import { createShell } from '../src/shell/shell';
import { validateAssistantCommandLine } from '../src/assistant/allowlist';
import type { CommandDefinition } from '../src/types';
import { fetchGitHubData } from '../src/github';

const effectKeys = ['clear', 'mode', 'openUrl', 'theme', 'welcome', 'download', 'sequence', 'ask'];

afterEach(() => vi.unstubAllGlobals());

describe('assistant command allowlist', () => {
  it('omits excluded repositories from every GitHub aggregate', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes('/repos?')
        ? [
            { name: 'visible', stargazers_count: 2, language: 'Python', fork: false, topics: [] },
            { name: 'hidden', stargazers_count: 100, language: 'Rust', fork: false, topics: ['portfolio-exclude'] },
          ]
        : { public_repos: 2, followers: 0, following: 0, bio: null, created_at: '2020-01-01' },
    })));
    const stats = await fetchGitHubData();
    expect(stats.ownRepos.map((repo) => repo.name)).toEqual(['visible']);
    expect(stats.topRepos.map((repo) => repo.name)).toEqual(['visible']);
    expect(stats.topLanguages).toEqual([{ language: 'Python', count: 1 }]);
    expect(stats.totalStars).toBe(2);
  });
  it('accepts read-only commands, pipelines and aliases', () => {
    for (const line of ['projects', 'projects | grep -i rag | head -n 3', 'cat about.md', 'proj | wc -l', 'who', 'guestbook']) {
      expect(validateAssistantCommandLine(line, commandRegistry)).toEqual({ ok: true });
    }
  });

  it('rejects commands with effects or side effects', () => {
    for (const line of ['theme dracula', 'cd projects', 'resume', 'sudo hire-me', 'chat', 'clear', 'open github', 'sign "hi" --name Sam']) {
      const result = validateAssistantCommandLine(line, commandRegistry);
      expect(result).toMatchObject({ ok: false, reason: 'not-allowed' });
    }
  });

  it('rejects chains, deep pipelines, unknown commands and overlong lines', () => {
    expect(validateAssistantCommandLine('projects && clear', commandRegistry)).toMatchObject({ ok: false, reason: 'chain' });
    expect(validateAssistantCommandLine('projects && projects', commandRegistry)).toMatchObject({ ok: false, reason: 'chain' });
    expect(validateAssistantCommandLine('projects | grep a | sort | head | tail', commandRegistry)).toMatchObject({ ok: false, reason: 'too-many-stages' });
    expect(validateAssistantCommandLine('projects | grep a | sort | head', commandRegistry)).toEqual({ ok: true });
    expect(validateAssistantCommandLine('nonsense', commandRegistry)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(validateAssistantCommandLine('projects | grep "unterminated', commandRegistry)).toMatchObject({ ok: false, reason: 'syntax' });
    expect(validateAssistantCommandLine('', commandRegistry)).toMatchObject({ ok: false });
    expect(validateAssistantCommandLine(`grep ${'a'.repeat(200)}`, commandRegistry)).toMatchObject({ ok: false, reason: 'too-long' });
    expect(validateAssistantCommandLine(`projects | grep ${'a'.repeat(183)}`, commandRegistry)).toEqual({ ok: true });
  });

  it('rejects a hidden command even when it is flagged', () => {
    const registry: CommandDefinition[] = [
      { name: 'secret', description: '', usage: 'secret', aliases: [], hidden: true, assistant: true, execute: () => ({ output: [] }) },
    ];
    expect(validateAssistantCommandLine('secret', registry)).toMatchObject({ ok: false, reason: 'not-allowed' });
  });

  it('flags exactly the documented set of commands', () => {
    expect(commandRegistry.filter((def) => def.assistant).map((def) => def.name).sort()).toMatchInlineSnapshot(`
      [
        "about",
        "cat",
        "certifications",
        "contact",
        "education",
        "experience",
        "github",
        "grep",
        "guestbook",
        "head",
        "help",
        "ls",
        "man",
        "projects",
        "pwd",
        "skills",
        "sort",
        "tail",
        "timeline",
        "tree",
        "wc",
        "who",
        "whoami",
      ]
    `);
  });

  it('never returns effect fields from an allowed command', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    for (const def of commandRegistry.filter((entry) => entry.assistant)) {
      for (const line of [def.name, `${def.name} --help`]) {
        const result = await createShell({ surface: 'web', origin: '' }).run(line);
        for (const key of effectKeys) expect(result, `${line} -> ${key}`).not.toHaveProperty(key);
      }
    }
  });
});
