import { describe, expect, it } from 'vitest';
import { content, itemIds } from '../src/content';
import { commandRegistry } from '../src/commands/registry';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';
import { renderManPage } from '../src/commands/man';

describe('registry and content coverage', () => {
  it('makes every content item discoverable and readable', async () => {
    const sh = createShell({ surface: 'web', origin: '' });
    const ids = itemIds(content);
    for (const [folder, names, titles] of [
      ['projects', ids.project, content.resume.projects.map((item) => item.name)],
      ['experience', ids.experience, content.resume.work.map((item) => item.name)],
      ['certifications', ids.certification, content.resume.certificates.map((item) => item.name)],
    ] as const) {
      const listing = toLines((await sh.run(`ls ${folder}`)).output).map((line) => line.text);
      for (const [index, id] of names.entries()) {
        expect(listing).toContain(`${id}.md`);
        const output = toLines((await sh.run(`cat ${folder}/${id}.md`)).output).map((line) => line.text).join('\n');
        expect(output).toContain(titles[index]);
      }
    }
  });

  it('has unique lowercase names and aliases without whitespace', () => {
    const names = commandRegistry.flatMap((def) => [def.name, ...def.aliases]);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toBe(name.toLowerCase());
      expect(name).not.toMatch(/\s/);
    }
  });

  it('provides a substantial manual page for every visible command', () => {
    for (const def of commandRegistry.filter((entry) => !entry.hidden)) {
      expect(def.man?.description.trim()).not.toBe('');
      expect(def.man?.examples.length).toBeGreaterThanOrEqual(1);
      expect(renderManPage(def).length).toBeGreaterThanOrEqual(3);
    }
  });
});
