import { describe, expect, it } from 'vitest';
import { CvSyncError } from '../src/cv-sync/error';
import { renderPrBody, renderStepSummary, renderTitle } from '../src/cv-sync/report';
import type { AppliedChange } from '../src/cv-sync/types';

describe('CV reports', () => {
  it('renders ordered non-empty PR sections and counts', () => {
    const changes: AppliedChange[] = [
      { kind: 'added', path: 'work[1]', value: 'Acme' },
      { kind: 'updated', path: 'basics.summary', from: 'Before', to: 'After' },
      { kind: 'removed', path: 'skills[0].keywords[1]', value: 'Old' },
      { kind: 'possible-rename', path: 'work[0]', cvLabel: 'ACT', resumeLabel: 'Advanced Computer Technology (ACT)' },
      { kind: 'new-project-review', path: 'projects[2]', label: 'New project' },
      { kind: 'kept-not-in-cv', path: 'projects[4]', label: 'Star-Schema Data Warehouse' },
      { kind: 'not-mapped', heading: 'Languages', text: 'Arabic, English' },
    ];
    const body = renderPrBody(changes, { sourcePath: 'content/cv/incoming/new.pdf' });
    expect(body).toContain('**Summary:** 1 added · 1 updated · 1 removed · 2 needs a look');
    const headings = [
      '### Added', '### Updated', '### Removed', '### ⚠ Needs a look',
      '#### Possible rename', '#### New project', '### Not in CV', '### In CV',
    ];
    let offset = -1;
    for (const heading of headings) {
      const next = body.indexOf(heading);
      expect(next).toBeGreaterThan(offset);
      offset = next;
    }
    expect(body).not.toContain('#### Protected, not matched in CV');
    expect(renderTitle('changes', 3, 'new.pdf')).toBe('CV update: 3 changes from new.pdf');
    expect(renderTitle('pdf-only', 0, 'new.pdf')).toBe('CV update: PDF only (new.pdf)');
  });

  it.each([
    ['NO_INPUT', 'No PDF in content/cv/incoming/.'],
    ['UNREADABLE', 'The CV could not be read'],
    ['EXTRACTION_FAILED', 'The AI extraction failed after 2 attempts:'],
    ['INVALID_RESULT', 'The updated resume failed validation:'],
  ] as const)('starts %s summaries with the contract message', (code, prefix) => {
    expect(renderStepSummary(new CvSyncError(code, 'detail')).startsWith(prefix)).toBe(true);
  });

  it('reports the successful empty push outcome', () => {
    expect(renderStepSummary({ outcome: 'nothing', changes: [] })).toBe('Nothing to process\n');
  });
});
