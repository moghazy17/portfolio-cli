import { describe, expect, it } from 'vitest';
import type { CommandOutput } from '../src/types';
import { toLines } from '../src/shell/lines';

describe('toLines', () => {
  it('splits text and errors into styled lines', () => {
    expect(toLines([
      { type: 'text', content: 'one\ntwo', style: { bold: true } },
      { type: 'error', content: 'bad\ninput' },
    ])).toEqual([
      { text: 'one', style: { bold: true } },
      { text: 'two', style: { bold: true } },
      { text: 'bad', style: { color: 'error' } },
      { text: 'input', style: { color: 'error' } },
    ]);
  });

  it('marks section titles and passes the nearest section item to children', () => {
    expect(toLines([{
      type: 'section', title: 'Outer', item: 'outer', children: [
        { type: 'text', content: 'parent' },
        { type: 'section', title: 'Inner', item: 'inner', children: [{ type: 'text', content: 'child' }] },
        { type: 'section', title: 'Inherited', children: [{ type: 'text', content: 'same' }] },
      ],
    }])).toEqual([
      { text: 'Outer', style: { bold: true, color: 'accent' }, item: 'outer' },
      { text: 'parent', item: 'outer' },
      { text: 'Inner', style: { bold: true, color: 'accent' }, item: 'inner' },
      { text: 'child', item: 'inner' },
      { text: 'Inherited', style: { bold: true, color: 'accent' }, item: 'outer' },
      { text: 'same', item: 'outer' },
    ]);
  });

  it('formats ordered and unordered lists', () => {
    expect(toLines([
      { type: 'list', items: ['alpha', 'beta'], style: { dim: true } },
      { type: 'list', items: ['first', 'second'], ordered: true },
    ])).toEqual([
      { text: '▸ alpha', style: { dim: true } },
      { text: '▸ beta', style: { dim: true } },
      { text: '1. first' },
      { text: '2. second' },
    ]);
  });

  it('pads table columns across headers and rows', () => {
    expect(toLines([{
      type: 'table', headers: ['Name', 'Role'], rows: [['A', 'Engineer'], ['Longer', 'PM']],
    }])).toEqual([
      { text: 'Name    Role' },
      { text: 'A       Engineer' },
      { text: 'Longer  PM' },
    ]);
  });

  it('handles ascii, links, dividers, progress, and line passthrough', () => {
    const output: CommandOutput[] = [
      { type: 'ascii', content: 'a\nb', style: { color: 'primary' } },
      { type: 'link', text: 'Site', url: 'https://example.test' },
      { type: 'divider' },
      { type: 'progress', label: 'Loading', value: 0.456 },
      { type: 'lines', lines: [{ text: 'ready', item: 'x', style: { bold: true } }] },
    ];
    expect(toLines(output)).toEqual([
      { text: 'a', style: { color: 'primary' } },
      { text: 'b', style: { color: 'primary' } },
      { text: 'Site: https://example.test', href: 'https://example.test' },
      { text: 'Loading  46%' },
      { text: 'ready', item: 'x', style: { bold: true } },
    ]);
  });

  it('renders progress notes as twelve-cell bars and keeps percentages without notes', () => {
    expect(toLines([
      { type: 'progress', label: 'Empty', value: 0, note: 'no public repos' },
      { type: 'progress', label: 'Partial', value: 0.67, note: '4 repos' },
      { type: 'progress', label: 'Full', value: 1, note: '6 repos' },
      { type: 'progress', label: 'Zero', value: 0 },
      { type: 'progress', label: 'Complete', value: 1 },
    ])).toEqual([
      { text: 'Empty  ░░░░░░░░░░░░  no public repos' },
      { text: 'Partial  ████████░░░░  4 repos' },
      { text: 'Full  ████████████  6 repos' },
      { text: 'Zero  0%' },
      { text: 'Complete  100%' },
    ]);
  });
});
