import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/load';

const repoRoot = resolve(import.meta.dirname, '../../..');

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  }))).flat();
}

describe('content ownership', () => {
  it('keeps portfolio facts out of application source', async () => {
    const loaded = await loadContent(repoRoot);
    const content = loaded.content!;
    const { basics } = content.resume;
    const firstName = basics.name.split(/\s+/)[0];
    const needles = [
      basics.name,
      basics.label,
      `${basics.location.city}, ${basics.location.countryCode}`,
      basics.location.city,
      basics.email,
      basics.phone,
      ...content.resume.work.map((entry) => entry.name),
      ...content.resume.projects.map((entry) => entry.name),
      content.resume.education[0].institution,
      ...content.resume.work.flatMap((entry) => entry.highlights.map((text) => text.slice(0, 40))),
      ...content.resume.projects.flatMap((entry) => entry.highlights.map((text) => text.slice(0, 40))),
      content.site.description,
      content.site.ogDescription,
      content.site.twitterDescription,
    ];
    const roots = [
      join(repoRoot, 'packages', 'shared', 'src'),
      ...['app', 'components', 'hooks', 'lib'].map((dir) => join(repoRoot, 'apps', 'web', dir)),
    ];
    const violations: string[] = [];
    for (const file of (await Promise.all(roots.map(sourceFiles))).flat()) {
      if (file.endsWith(join('content', 'generated.ts'))) continue;
      let source = await readFile(file, 'utf8');
      if (file.endsWith(join('src', 'ascii.ts'))) {
        source = source.replace(/export const ASCII_BANNER = `[\s\S]*?`;\r?\n/, '');
      }
      const lines = source.split(/\r?\n/);
      for (const needle of needles) {
        lines.forEach((line, index) => {
          if (line.includes(needle)) violations.push(`${file}:${index + 1}: ${needle}`);
        });
      }
      lines.forEach((line, index) => {
        if (new RegExp(`\\b${firstName}\\b`).test(line)) {
          violations.push(`${file}:${index + 1}: ${firstName}`);
        }
      });
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
