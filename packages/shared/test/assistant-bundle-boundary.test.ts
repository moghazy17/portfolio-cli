import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(__dirname, '../src');
const entry = join(sourceRoot, 'index.ts');
const forbiddenPackage = /^(?:zod|octokit|smol-toml|@ai-sdk\/(?:openai|google)|@upstash\/)/;
const importPattern = /(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g;

function resolveSource(from: string, specifier: string): string {
  const target = resolve(dirname(from), specifier.replace(/\.js$/, ''));
  const candidates = [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts'), join(target, 'index.tsx')];
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!found) throw new Error(`Cannot resolve ${specifier} from ${from}`);
  return found;
}

describe('shared main entry bundle boundary', () => {
  it('cannot reach server-only files or dependencies', () => {
    const pending = [entry];
    const seen = new Set<string>();
    const violations: string[] = [];

    while (pending.length) {
      const file = pending.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const location = relative(sourceRoot, file).replaceAll('\\', '/');
      if (/^(?:assistant\/server|inventory)\//.test(location)) violations.push(location);

      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(importPattern)) {
        if (/^(?:import|export)\s+type\b/.test(match[0])) continue;
        const specifier = match[1];
        if (forbiddenPackage.test(specifier)) violations.push(`${location}: ${specifier}`);
        if (specifier.startsWith('.')) pending.push(resolveSource(file, specifier));
      }
    }

    expect(violations).toEqual([]);
  });
});
