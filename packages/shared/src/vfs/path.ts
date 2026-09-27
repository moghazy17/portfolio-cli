import type { VfsPath } from '../types';

export function normalize(cwd: VfsPath, input: string): VfsPath {
  const raw = input === '~' ? '/' : input.startsWith('~/') ? input.slice(1) : input || '.';
  const segments = raw.startsWith('/') ? [] : cwd.split('/').filter(Boolean);
  for (const segment of raw.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

export function display(path: VfsPath): string {
  return path === '/' ? '~' : `~${path}`;
}
