import type { CommandOutput, FileSystem, VfsDir, VfsFile, VfsNode } from '../types';
import type { Content } from '../content/schema';
import { itemIds } from '../content/items';
import { aboutCommand, certificationSection, experienceSection, projectSection } from '../commands/cv';
import { toLines } from '../shell/lines';
import { display, normalize } from './path';

const cache = new WeakMap<Content, FileSystem>();
const encoder = new TextEncoder();

function sortChildren(dir: VfsDir): void {
  dir.children.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1);
}

function makeFile(name: string, path: string, render: () => CommandOutput[], binary = false): VfsFile {
  return {
    kind: 'file', name, path, render, ...(binary && { binary }),
    size: binary ? 0 : encoder.encode(toLines(render()).map((line) => line.text).join('\n')).length,
  };
}

function writeupLines(body: string): CommandOutput[] {
  return body.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const heading = line.match(/^#+\s+(.*)$/);
    return heading
      ? { type: 'text' as const, content: heading[1], style: { bold: true } }
      : { type: 'text' as const, content: line };
  });
}

export function buildFileSystem(data: Content): FileSystem {
  const cached = cache.get(data);
  if (cached) return cached;
  const root: VfsDir = { kind: 'dir', name: '/', path: '/', children: [] };
  const folders = Object.fromEntries(['certifications', 'experience', 'projects'].map((name) => [
    name, { kind: 'dir', name, path: `/${name}`, children: [] } as VfsDir,
  ])) as Record<'certifications' | 'experience' | 'projects', VfsDir>;
  root.children.push(...Object.values(folders));
  root.children.push(makeFile('about.md', '/about.md', () => aboutCommand(data).output));
  if (data.cv.available) root.children.push(makeFile('resume.pdf', '/resume.pdf', () => [], true));
  const ids = itemIds(data);
  data.resume.projects.forEach((project, index) => {
    const name = `${ids.project[index]}.md`;
    folders.projects.children.push(makeFile(name, `/projects/${name}`, () => [
      projectSection(index, data),
      ...(data.writeups[project.slug] ? writeupLines(data.writeups[project.slug].body) : []),
    ]));
  });
  data.resume.work.forEach((_, index) => {
    const name = `${ids.experience[index]}.md`;
    folders.experience.children.push(makeFile(name, `/experience/${name}`, () => [experienceSection(index, data)]));
  });
  data.resume.certificates.forEach((_, index) => {
    const name = `${ids.certification[index]}.md`;
    folders.certifications.children.push(makeFile(name, `/certifications/${name}`, () => [certificationSection(index, data)]));
  });
  for (const dir of [root, ...Object.values(folders)]) sortChildren(dir);
  const fs: FileSystem = {
    root, display,
    resolve(cwd, input) {
      const path = normalize(cwd, input);
      let node: VfsNode = root;
      for (const segment of path.split('/').filter(Boolean)) {
        if (node.kind !== 'dir') return { path, error: 'ENOTDIR' };
        const child: VfsNode | undefined = node.children.find((item) => item.name.toLowerCase() === segment.toLowerCase());
        if (!child) return { path, error: 'ENOENT' };
        node = child;
      }
      return { node, path: node.path };
    },
  };
  cache.set(data, fs);
  return fs;
}
