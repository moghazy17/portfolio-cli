import type { Line } from '../types';

export type FilterFlags = Record<string, string | boolean>;

export const MAX_GREP_PATTERN_LENGTH = 100;

export function grepLines(lines: Line[], pattern: string, flags: FilterFlags): { lines: Line[]; status: 'ok' | 'error'; showItems: boolean; error?: string } {
  const ignoreCase = Boolean(flags['ignore-case']);
  let test: (text: string) => boolean;
  if (flags['extended-regexp']) {
    if (pattern.length > MAX_GREP_PATTERN_LENGTH) {
      return { lines: [], status: 'error', showItems: false, error: `grep: pattern too long (max ${MAX_GREP_PATTERN_LENGTH} characters)` };
    }
    let regex: RegExp;
    try { regex = new RegExp(pattern, ignoreCase ? 'i' : ''); } catch {
      return { lines: [], status: 'error', showItems: false, error: `grep: invalid regular expression '${pattern}'` };
    }
    test = (text) => regex.test(text);
  } else {
    const needle = ignoreCase ? pattern.toLowerCase() : pattern;
    test = (text) => (ignoreCase ? text.toLowerCase() : text).includes(needle);
  }
  const matches = lines.filter((line) => {
    const found = test(line.text);
    return flags['invert-match'] ? !found : found;
  });
  return {
    lines: flags.count ? [{ text: String(matches.length) }] : matches,
    status: matches.length ? 'ok' : 'error',
    showItems: !flags.count && !flags['no-filename'],
  };
}

export function headLines(lines: Line[], count = 10): Line[] {
  return lines.slice(0, count);
}

export function tailLines(lines: Line[], count = 10): Line[] {
  return count === 0 ? [] : lines.slice(-count);
}

export function wcLines(lines: Line[], flags: FilterFlags): Line[] {
  const all = !flags.lines && !flags.words && !flags.chars;
  const counts = [
    (all || flags.lines) && lines.length,
    (all || flags.words) && lines.reduce((sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length, 0),
    (all || flags.chars) && lines.reduce((sum, line) => sum + line.text.length + 1, 0),
  ].filter((count): count is number => typeof count === 'number');
  return [{ text: counts.map((count) => String(count).padStart(7)).join(' ') }];
}

export function sortLines(lines: Line[], flags: FilterFlags): Line[] {
  const sorted = lines.map((line, index) => ({ line, index })).sort((a, b) => {
    const order = a.line.text < b.line.text ? -1 : a.line.text > b.line.text ? 1 : 0;
    return (flags.reverse ? -order : order) || a.index - b.index;
  }).map(({ line }) => line);
  if (!flags.unique) return sorted;
  return sorted.filter((line, index) => index === 0 || line.text !== sorted[index - 1].text);
}
