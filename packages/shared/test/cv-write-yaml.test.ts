import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { applyToDocument } from '../src/cv-sync/write-yaml';

describe('CV YAML writer', () => {
  it('edits nodes while preserving comments, order, and protected forms', () => {
    const source = `# heading
work:
  - slug: one # stable
    name: Old
    position: { value: Keep me, manual: true }
    highlights:
      - Existing
skills: [] # untouched
`;
    const document = parseDocument(source);
    const output = applyToDocument(document, [
      {
        kind: 'updated', path: 'work[0].name', from: 'Old', to: 'New',
        operation: { type: 'set', path: ['work', 0, 'name'], value: 'New' },
      },
      {
        kind: 'added', path: 'work[0].highlights[1]', value: 'Added',
        operation: { type: 'add', path: ['work', 0, 'highlights'], value: 'Added' },
      },
    ]);
    expect(output).toContain('# heading');
    expect(output).toContain('slug: one # stable');
    expect(output).toContain('position: { value: Keep me, manual: true }');
    expect(output.indexOf('slug:')).toBeLessThan(output.indexOf('name:'));
    expect(output).toContain('skills: [] # untouched');
    expect(output).toBe(`# heading
work:
  - slug: one # stable
    name: New
    position: { value: Keep me, manual: true }
    highlights:
      - Existing
      - Added
skills: [] # untouched
`);
    const sourceLines = source.trimEnd().split('\n');
    const outputLines = output.trimEnd().split('\n');
    const untouched = sourceLines.filter((line) => outputLines.includes(line));
    expect(untouched).toContain('skills: [] # untouched');
    expect(untouched).toContain('    position: { value: Keep me, manual: true }');
  });
});
