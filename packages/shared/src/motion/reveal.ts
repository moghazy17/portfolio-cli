import type { CommandOutput } from '../types';
import { toLines } from '../shell/lines';

export const TYPE_MAX_LINES = 40;
export const TYPE_MAX_MS = 1500;

export function shouldType(output: CommandOutput[]): boolean {
  const lines = toLines(output);
  return lines.length > 0 && lines.length <= TYPE_MAX_LINES;
}
