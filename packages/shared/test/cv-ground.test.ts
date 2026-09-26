import { describe, expect, it } from 'vitest';
import { findUngrounded } from '../src/cv-sync/ground';
import { normalizeText } from '../src/cv-sync/pdf';

describe('CV grounding', () => {
  it('normalizes PDF line breaks, whitespace, quotes, and dashes', () => {
    expect(normalizeText('recur-\nsive   “text” ‘item’ – one — two'))
      .toBe('recursive "text" \'item\' - one - two');
  });

  it('marks paraphrases but not verbatim values', () => {
    const changes = [
      { kind: 'added' as const, path: 'skills[0].keywords[0]', value: 'Recursive systems' },
      { kind: 'updated' as const, path: 'work[0].position', from: 'Engineer', to: 'Built APIs' },
      { kind: 'updated' as const, path: 'work[0].startDate', from: '2025-01', to: '2026-08' },
    ];
    const result = findUngrounded(
      changes,
      'Recursive systems. August 2026. Created application interfaces.',
    );
    expect(result).toEqual([
      { kind: 'not-grounded', path: 'work[0].position', value: 'Built APIs' },
    ]);
  });
});
