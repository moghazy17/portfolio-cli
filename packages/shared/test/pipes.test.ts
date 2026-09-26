import { describe, expect, it, vi } from 'vitest';
import { content, cvData, itemIds } from '../src/content';
import { commandRegistry } from '../src/commands/registry';
import { toLines } from '../src/shell/lines';
import { createShell } from '../src/shell/shell';
import type { CommandDefinition } from '../src/types';

const shell = () => createShell({ surface: 'web', origin: 'https://example.test' });

describe('shell pipelines', () => {
  it('keeps item ids on matching skill and project lines', async () => {
    const skill = cvData.skills[0].skills[0];
    const projectWord = cvData.projects[0].techStack.split(/\W+/).find(Boolean)!;
    const skillResult = await shell().run(`skills | grep -i ${skill}`);
    const projectResult = await shell().run(`projects | grep ${projectWord}`);
    expect(skillResult.output[0]).toMatchObject({ type: 'lines', showItems: true });
    expect(toLines(skillResult.output).some((line) => line.item === itemIds(content).skill[0])).toBe(true);
    expect(toLines(projectResult.output).some((line) => line.item === content.resume.projects[0].slug)).toBe(true);
  });

  it('runs head, tail, wc, sort and chained filters', async () => {
    const source = await shell().run('projects');
    const count = toLines(source.output).length;
    expect(toLines((await shell().run('projects | head -n 3')).output)).toHaveLength(3);
    expect(toLines((await shell().run('projects | tail -n 2')).output)).toHaveLength(2);
    expect(toLines((await shell().run('projects | wc -l')).output)[0].text).toBe(String(count).padStart(7));
    expect((await shell().run('skills | sort')).status).toBe('ok');
    const word = cvData.experience[0].company.split(/\W+/).find(Boolean)!;
    expect((await shell().run(`experience | grep -i ${word} | wc -l`)).output[0]).toMatchObject({ type: 'lines', showItems: false });
    expect((await shell().run(`experience | grep -i ${word} | head -n 1`)).output[0]).toMatchObject({ type: 'lines', showItems: true });
    expect((await shell().run(`experience | grep -i ${word} | sort`)).output[0]).toMatchObject({ type: 'lines', showItems: true });
  });

  it('drops effects from a piped producer and merges chain outputs and effects', async () => {
    expect((await shell().run('theme dracula | wc -l')).theme).toBeUndefined();
    const chained = await shell().run('theme dracula && welcome');
    expect(chained).toMatchObject({ theme: 'dracula', welcome: true, status: 'ok' });
    expect(chained.output.length).toBeGreaterThan(1);
    expect((await shell().run('grep x && welcome')).welcome).toBeUndefined();
  });

  it('cancels before or during async work and handles throwing handlers', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await shell().run('help', { signal: controller.signal })).toEqual({ output: [], cancelled: true });
    const during = new AbortController();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const custom: CommandDefinition = { name: 'slow', aliases: [], description: '', usage: 'slow', execute: async () => {
      await pending;
      return { output: [{ type: 'text', content: 'late' }] };
    } };
    const running = createShell({ surface: 'web', origin: '', registry: [...commandRegistry, custom] }).run('slow', { signal: during.signal });
    during.abort();
    release();
    expect(await running).toEqual({ output: [], cancelled: true });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing: CommandDefinition = { ...custom, name: 'throwing', execute: () => { throw new Error('boom'); } };
    expect(await createShell({ surface: 'web', origin: '', registry: [...commandRegistry, throwing] }).run('throwing')).toMatchObject({ output: [{ type: 'error', content: 'throwing: something went wrong' }], status: 'error' });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('reports usage, option and surface failures and tracks the session status', async () => {
    const instance = shell();
    expect(await instance.run('projects | grep')).toMatchObject({ output: [{ type: 'error', content: 'usage: grep [-i] [-v] [-c] [-h] <pattern>' }], status: 'error' });
    expect(instance.session.lastStatus).toBe('error');
    expect(await instance.run('projects | head -n bad')).toMatchObject({ output: [{ type: 'error', content: "head: invalid number of lines: 'bad'" }], status: 'error' });
    expect(await instance.run('projects | grep -z x')).toMatchObject({ output: [{ type: 'error', content: "grep: unknown option '-z'" }, { type: 'text', content: 'usage: grep [-i] [-v] [-c] [-h] <pattern>' }], status: 'error' });
    expect(await instance.run('projects --help')).toMatchObject({ output: [{ type: 'text', content: 'usage: projects' }, { type: 'text', content: "See 'man projects' for details." }], status: 'ok' });
    expect(instance.session.lastStatus).toBe('ok');
    expect(instance.prompt()).toEqual({ user: 'visitor', host: 'portfolio', cwd: '~' });
    expect(createShell({ surface: 'web', origin: '', initialCwd: '/projects' }).prompt()).toEqual({ user: 'visitor', host: 'portfolio', cwd: '~/projects' });
    const restricted: CommandDefinition = { name: 'restricted', aliases: [], description: '', usage: 'restricted', surfaces: ['ssh'], execute: () => ({ output: [] }) };
    expect(await createShell({ surface: 'web', origin: '', registry: [...commandRegistry, restricted] }).run('restricted')).toMatchObject({ output: [{ type: 'error', content: 'restricted: not available on this surface' }], status: 'error' });
  });
});
