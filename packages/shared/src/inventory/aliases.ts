import type { TechAliasMap } from './types';

export function compileAliases(map: TechAliasMap) {
  const techs = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  const patterns = Object.entries(techs).flatMap(([id, entry]) =>
    [id, ...entry.aliases].map((alias) => ({
      id,
      pattern: new RegExp(`^${alias.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '[^\\s]*')}$`, 'i'),
    })));
  return {
    techs,
    resolve(name: string): string | null {
      return patterns.find(({ pattern }) => pattern.test(name.trim()))?.id ?? null;
    },
  };
}
