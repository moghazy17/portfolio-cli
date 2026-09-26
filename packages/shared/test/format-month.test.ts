import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/load';
import { formatMonth } from '../src/content/view';

const repoRoot = resolve(import.meta.dirname, '../../..');
const displayMonthPattern = /^(Jan|Feb|Mar|Apr|May|June|July|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

describe('formatMonth', () => {
  it('formats all twelve months', () => {
    expect(Array.from({ length: 12 }, (_, index) => formatMonth(`2026-${String(index + 1).padStart(2, '0')}`)))
      .toEqual([
        'Jan 2026',
        'Feb 2026',
        'Mar 2026',
        'Apr 2026',
        'May 2026',
        'June 2026',
        'July 2026',
        'Aug 2026',
        'Sep 2026',
        'Oct 2026',
        'Nov 2026',
        'Dec 2026',
      ]);
  });

  it('formats every date in the real resume content', async () => {
    const loaded = await loadContent(repoRoot);
    expect(loaded.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(loaded.content).toBeDefined();

    const resume = loaded.content!.resume;
    const dated = [
      ...resume.education,
      ...resume.work,
      ...resume.projects,
      ...resume.certificates,
    ];

    for (const entry of dated) {
      expect(formatMonth(entry.startDate)).toMatch(displayMonthPattern);
      expect(entry.endDate ? formatMonth(entry.endDate) : 'Present')
        .toMatch(/^(Jan|Feb|Mar|Apr|May|June|July|Aug|Sep|Oct|Nov|Dec) \d{4}$|^Present$/);
    }
  });
});
