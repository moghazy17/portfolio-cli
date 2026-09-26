import { describe, expect, it } from 'vitest';
import legacy from './fixtures/legacy-cvdata.json';
import { formatMonth } from '../src/content/view';

const monthNumbers: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  June: '06',
  July: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

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

  it('round-trips every legacy display date', () => {
    const dated = [
      legacy.education,
      ...legacy.experience,
      ...legacy.projects,
      ...legacy.certifications,
    ];
    const values = dated.flatMap((entry) => [entry.startDate, entry.endDate]);
    expect(values).toHaveLength(26);
    expect(values).toContain('Present');
    const datedValues = values.filter((date) => date !== 'Present');
    expect(datedValues).toHaveLength(25);
    for (const value of datedValues) {
      const [month, year] = value.split(' ');
      expect(formatMonth(`${year}-${monthNumbers[month]}`)).toBe(value);
    }
  });
});
