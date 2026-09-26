import { describe, expect, it } from 'vitest';
import type { Line } from '../src/types';
import { grepLines, headLines, tailLines, wcLines, sortLines } from '../src/shell/filters';

const lines: Line[] = [
  { text: 'a.b alpha', item: 'one', style: { bold: true } },
  { text: 'axb BETA', item: 'two' },
  { text: 'alpha beta' },
];

describe('filters', () => {
  it('matches literal text, carries styles and item metadata, and counts', () => {
    expect(grepLines(lines, 'a.b', {})).toEqual({ lines: [lines[0]], status: 'ok', showItems: true });
    expect(grepLines(lines, 'beta', { 'ignore-case': true })).toMatchObject({ lines: [lines[1], lines[2]] });
    expect(grepLines(lines, 'alpha', { 'invert-match': true })).toMatchObject({ lines: [lines[1]] });
    expect(grepLines(lines, 'alpha', { count: true })).toMatchObject({ lines: [{ text: '2' }], showItems: false });
    expect(grepLines(lines, 'alpha', { 'no-filename': true })).toMatchObject({ showItems: false });
    expect(grepLines(lines, 'missing', {})).toMatchObject({ lines: [], status: 'error' });
  });

  it('selects first and last lines with a valid count', () => {
    expect(headLines(lines, 2)).toEqual(lines.slice(0, 2));
    expect(tailLines(lines, 2)).toEqual(lines.slice(1));
    expect(headLines(lines)).toEqual(lines);
    expect(tailLines(lines)).toEqual(lines);
    expect(headLines(lines, 0)).toEqual([]);
  });

  it('prints GNU-style count columns', () => {
    expect(wcLines(lines, {})).toEqual([{ text: '      3       6      30' }]);
    expect(wcLines(lines, { lines: true })).toEqual([{ text: '      3' }]);
    expect(wcLines(lines, { words: true })).toEqual([{ text: '      6' }]);
    expect(wcLines(lines, { chars: true })).toEqual([{ text: '     30' }]);
  });

  it('sorts by code point, stably removes duplicates, and keeps styles', () => {
    const input: Line[] = [{ text: 'b', style: { bold: true } }, { text: 'A' }, { text: 'b' }];
    expect(sortLines(input, {})).toEqual([input[1], input[0], input[2]]);
    expect(sortLines(input, { reverse: true, unique: true })).toEqual([input[0], input[1]]);
  });
});
