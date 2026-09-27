import { describe, expect, it } from 'vitest';
import { content, itemIds } from '../src/content';
import { projectsCommand } from '../src/commands/cv';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';

const shell = () => createShell({ surface: 'web', origin: 'https://example.test' });
const lines = (output: Awaited<ReturnType<ReturnType<typeof shell>['run']>>['output']) => toLines(output).map((line) => line.text);

describe('filesystem commands', () => {
  it('updates cwd, prompt, and reports cd errors without changing cwd', async () => {
    const sh = shell();
    expect(lines((await sh.run('pwd')).output)).toEqual(['/']);
    expect(lines((await sh.run('cd projects && pwd')).output)).toEqual(['/projects']);
    expect(sh.prompt().cwd).toBe('~/projects');
    for (const command of ['cd nowhere', 'cd ~/about.md', 'cd a b']) {
      expect((await sh.run(command)).status).toBe('error');
      expect(lines((await sh.run('pwd')).output)).toEqual(['/projects']);
    }
    expect(lines((await sh.run('cd nowhere')).output)).toEqual(['cd: no such file or directory: nowhere']);
    expect(lines((await sh.run('cd ~/about.md')).output)).toEqual(['cd: not a directory: ~/about.md']);
    expect(lines((await sh.run('cd a b')).output)).toEqual(['cd: too many arguments']);
    for (const command of ['cd', 'cd ~', 'cd /']) {
      await sh.run(command);
      expect(sh.prompt().cwd).toBe('~');
      await sh.run('cd projects');
    }
  });

  it('lists one styled entry per line with flags, files, headers and pipe counts', async () => {
    const sh = shell();
    const plain = await sh.run('ls');
    expect(lines(plain.output)).toEqual(['certifications/', 'experience/', 'projects/', 'about.md', 'resume.pdf']);
    expect(plain.output[0]).toMatchObject({ type: 'text', style: { color: 'primary' } });
    expect(lines((await sh.run('ls -a')).output).slice(0, 2)).toEqual(['./', '../']);
    expect(lines((await sh.run('ls -l')).output)).toEqual(expect.arrayContaining([expect.stringMatching(/^d  -  projects\/$/), expect.stringMatching(/^-  pdf  resume\.pdf$/)]));
    expect(lines((await sh.run('ls about.md')).output)).toEqual(['about.md']);
    expect(lines((await sh.run('ls projects experience')).output)).toEqual(expect.arrayContaining(['projects:', 'experience:', '']));
    expect(lines((await sh.run('ls | wc -l')).output).map((line) => line.trim())).toEqual(['5']);
    const missing = await sh.run('ls missing projects');
    expect(missing.status).toBe('error');
    expect(lines(missing.output)).toContain("ls: cannot access 'missing': No such file or directory");
    expect(lines(missing.output)).toContain('projects:');
  });

  it('cats structured sections, reports errors and draws a tree', async () => {
    const sh = shell();
    const id = itemIds(content).project[0];
    const project = content.resume.projects[0];
    const cat = await sh.run(`cat projects/${id}.md`);
    expect(cat.output[0]).toEqual(projectsCommand([project.slug]).output[1]);
    expect(lines(cat.output).join('\n')).toContain(project.name);
    expect(lines((await sh.run('cat')).output)).toEqual(['usage: cat <path…>']);
    expect(lines((await sh.run('cat projects')).output)).toEqual(['cat: projects: Is a directory']);
    expect(lines((await sh.run('cat missing.md')).output)).toEqual(['cat: missing.md: No such file or directory']);
    expect(lines((await sh.run('cat resume.pdf')).output)).toEqual(["resume.pdf: PDF document — run 'resume' to download it"]);
    expect(lines((await sh.run('cat about.md | grep -i data')).output).length).toBeGreaterThan(0);
    const tree = lines((await sh.run('tree')).output);
    expect(tree[0]).toBe('~');
    expect(tree.join('\n')).toContain('├── ');
    expect(tree.join('\n')).toContain('└── ');
    expect(tree.at(-1)).toMatch(/^3 directories, \d+ files$/);
  });

  it('completes paths and directories', () => {
    const sh = shell();
    expect(sh.complete('cat pro').replacement).toBe('projects/');
    expect(sh.complete('cd ~/exp').replacement).toBe('~/experience/');
    expect(sh.complete('cd ~/about').candidates).toEqual([]);
  });
});
