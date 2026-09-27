import { describe, expect, it } from 'vitest';
import { content, itemIds } from '../src/content';
import type { Content } from '../src/content/schema';
import { toLines } from '../src/shell/lines';
import { buildFileSystem } from '../src/vfs';

function fixture(): Content {
  const copy = structuredClone(content) as Content;
  copy.resume.projects.push({
    slug: 'fixture-project', name: 'Fixture Project', stack: 'TypeScript',
    graduation: false, startDate: '2025-01', highlights: ['Fixture highlight'],
  });
  copy.writeups['fixture-project'] = {
    featured: false, links: [], body: '# Fixture heading\n\nFixture body\n- Fixture list item',
  };
  return copy;
}

describe('virtual filesystem', () => {
  it('builds sorted root and content-derived file names', () => {
    const data = fixture();
    const fs = buildFileSystem(data);
    expect(fs.root.children.map((node) => node.name)).toEqual([
      'certifications', 'experience', 'projects', 'about.md', 'resume.pdf',
    ]);
    const ids = itemIds(data);
    for (const [folder, kind] of [
      ['projects', 'project'], ['experience', 'experience'], ['certifications', 'certification'],
    ] as const) {
      const result = fs.resolve('/', folder);
      expect(result.node?.kind).toBe('dir');
      if (result.node?.kind === 'dir') {
        expect(result.node.children.map((node) => node.name)).toEqual(ids[kind].map((id) => `${id}.md`).sort());
      }
    }
    expect(buildFileSystem(data)).toBe(fs);
    data.cv.available = false;
    expect(buildFileSystem({ ...data }).root.children.map((node) => node.name)).not.toContain('resume.pdf');
  });

  it('normalizes and resolves paths without throwing', () => {
    const fs = buildFileSystem(fixture());
    expect(fs.resolve('/', '~/PROJECTS//fixture-project.md/').path).toBe('/projects/fixture-project.md');
    expect(fs.resolve('/projects', '../../..').path).toBe('/');
    expect(fs.resolve('/projects', '.').path).toBe('/projects');
    expect(fs.resolve('/projects', '~').path).toBe('/');
    expect(fs.resolve('/projects', '/').path).toBe('/');
    expect(fs.resolve('/', 'missing').error).toBe('ENOENT');
    expect(fs.resolve('/', 'about.md/child').error).toBe('ENOTDIR');
    expect(fs.display('/')).toBe('~');
    expect(fs.display('/projects')).toBe('~/projects');
  });

  it('renders writeups, headings, binary metadata and UTF-8 sizes', () => {
    const fs = buildFileSystem(fixture());
    const project = fs.resolve('/', 'projects/fixture-project.md').node;
    expect(project?.kind).toBe('file');
    if (project?.kind !== 'file') return;
    const output = project.render();
    expect(output).toContainEqual({ type: 'text', content: 'Fixture heading', style: { bold: true } });
    expect(toLines(output).map((line) => line.text)).toContain('Fixture body');
    expect(project.size).toBe(new TextEncoder().encode(toLines(output).map((line) => line.text).join('\n')).length);
    expect(fs.resolve('/', 'resume.pdf').node).toMatchObject({ kind: 'file', binary: true });
  });
});
