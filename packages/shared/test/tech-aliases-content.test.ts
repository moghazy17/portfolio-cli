import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadContent } from '../src/content/load';
import { validateContent } from '../src/content/validate';

describe('technology alias content', () => {
  const root = resolve(import.meta.dirname, '../../..');
  it('validates the real aliases', async () => {
    expect(validateContent(await loadContent(root)).filter((issue) => issue.severity === 'error')).toEqual([]);
  });
  it.each([
    ['duplicate alias', 'alpha:\n  label: Alpha\n  category: data\n  aliases: [shared]\nbeta:\n  label: Beta\n  category: data\n  aliases: [shared]', 'both alpha and beta'],
    ['invalid id', 'Bad ID:\n  label: Bad\n  category: data\n  aliases: []', 'Invalid'],
    ['two globs', 'alpha:\n  label: Alpha\n  category: data\n  aliases: ["a*b*c"]', 'glob'],
    ['upper case', 'alpha:\n  label: Alpha\n  category: data\n  aliases: [UPPER]', 'lower-case'],
  ])('%s is rejected', async (_name, aliases, message) => {
    const dir = await mkdtemp(join(tmpdir(), 'portfolio-alias-'));
    try {
      const contentDir = join(dir, 'content');
      await mkdir(contentDir);
      for (const file of ['resume.yaml', 'site.yaml']) await writeFile(join(contentDir, file), await readFile(join(root, 'content', file)));
      await writeFile(join(contentDir, 'tech-aliases.yaml'), aliases);
      expect(validateContent(await loadContent(dir)).map((issue) => issue.message).join(' ')).toContain(message);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
