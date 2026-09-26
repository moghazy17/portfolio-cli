import { commandRegistry } from '../commands/registry';
import type { CommandDefinition } from '../types';

export function osaDistance(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}

export function suggestCommand(word: string, registry: CommandDefinition[] = commandRegistry): string | undefined {
  if (/\s/.test(word)) return undefined;
  let best: string | undefined;
  let smallest = Infinity;
  for (const def of registry) {
    if (def.hidden) continue;
    for (const candidate of [def.name, ...def.aliases]) {
      if (candidate.length === 1 && word.toLowerCase() !== candidate.toLowerCase()) continue;
      const distance = osaDistance(word, candidate);
      if (distance <= (candidate.length <= 4 ? 1 : 2) && distance < smallest) {
        best = def.name;
        smallest = distance;
      }
    }
  }
  return best;
}
