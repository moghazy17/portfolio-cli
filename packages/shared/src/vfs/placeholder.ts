import type { FileSystem } from '../types';

export const placeholderFs: FileSystem = {
  root: { kind: 'dir', name: '/', path: '/', children: [] },
  resolve: () => ({ path: '/', error: 'ENOENT' }),
  display: (path) => path === '/' ? '~' : `~${path}`,
};
