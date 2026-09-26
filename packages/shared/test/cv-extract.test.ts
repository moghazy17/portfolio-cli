import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(() => ({})) },
}));

import { extractCv, resolveCvSyncModel, systemPrompt } from '../src/cv-sync/extract';

describe('CV sync model resolution', () => {
  it.each([
    ['', 'gemini-2.5-flash'],
    ['  ', 'gemini-2.5-flash'],
    [undefined, 'gemini-2.5-flash'],
    ['gemini-custom', 'gemini-custom'],
  ])('resolves %j as %s', (value, expected) => {
    expect(resolveCvSyncModel(value)).toBe(expected);
  });
});

describe('CV extraction instructions', () => {
  it('requires matching abbreviations by overlapping dates and separates roles with different dates', () => {
    expect(systemPrompt).toMatch(/abbreviations,\s*acronyms, shortened or expanded names/i);
    expect(systemPrompt).toMatch(/same\s+organisation with different dates[\s\S]*different entries/i);
  });

  it('uses deterministic generation settings', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ output: {} } as never);

    await extractCv({
      pdfPath: 'test/fixtures/cv/corrupt.pdf',
      pdfText: '',
      current: {
        basics: {
          name: '', label: '', summary: '', email: '', phone: '', location: { city: '', countryCode: '' },
        },
        education: [], work: [], projects: [], certificates: [], skills: [],
      } as never,
    });

    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0 }));
  });
});
