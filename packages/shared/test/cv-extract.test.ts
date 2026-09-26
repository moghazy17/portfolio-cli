import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(() => ({})) },
}));

import {
  ModelExtractionSchema,
  extractCv,
  normalizeExtraction,
  resolveCvSyncModel,
  systemPrompt,
} from '../src/cv-sync/extract';

describe('CV sync model resolution', () => {
  it.each([
    ['', 'gpt-6-sol'],
    ['  ', 'gpt-6-sol'],
    [undefined, 'gpt-6-sol'],
    ['gpt-custom', 'gpt-custom'],
  ])('resolves %j as %s', (value, expected) => {
    expect(resolveCvSyncModel(value)).toBe(expected);
  });
});

describe('CV extraction schema', () => {
  it('requires every object property and rejects additional properties', () => {
    const jsonSchema = z.toJSONSchema(ModelExtractionSchema);

    function checkObjectSchemas(schema: unknown): void {
      if (typeof schema !== 'object' || schema === null) return;
      if (Array.isArray(schema)) {
        schema.forEach(checkObjectSchemas);
        return;
      }

      const node = schema as Record<string, unknown>;
      if (node.type === 'object') {
        const properties = node.properties as Record<string, unknown>;
        expect(node.required).toEqual(Object.keys(properties));
        expect(node.additionalProperties).toBe(false);
      }
      Object.values(node).forEach(checkObjectSchemas);
    }

    checkObjectSchemas(jsonSchema);
  });

  it('normalizes null fields to absent properties at entry and item level', () => {
    const extraction = ModelExtractionSchema.parse({
      basics: {
        _id: null,
        name: 'Ahmed',
        label: 'Engineer',
        summary: 'Summary',
        email: 'ahmed@example.com',
        phone: '123',
        location: { city: 'Cairo', countryCode: 'EG' },
      },
      education: [],
      work: [{
        _id: null,
        _match: null,
        name: 'Company',
        position: 'Engineer',
        startDate: null,
        endDate: null,
        highlights: [{ _id: null, value: 'Built a product' }],
      }],
      projects: [],
      certificates: [],
      skills: [],
      unmapped: [],
    });

    expect(normalizeExtraction(extraction)).toEqual({
      basics: {
        name: 'Ahmed',
        label: 'Engineer',
        summary: 'Summary',
        email: 'ahmed@example.com',
        phone: '123',
        location: { city: 'Cairo', countryCode: 'EG' },
      },
      education: [],
      work: [{
        name: 'Company',
        position: 'Engineer',
        highlights: [{ value: 'Built a product' }],
      }],
      projects: [],
      certificates: [],
      skills: [],
      unmapped: [],
    });
  });
});

describe('CV extraction instructions', () => {
  it('requires matching abbreviations by overlapping dates and separates roles with different dates', () => {
    expect(systemPrompt).toMatch(/abbreviations,\s*acronyms, shortened or expanded names/i);
    expect(systemPrompt).toMatch(/same\s+organisation with different dates[\s\S]*different entries/i);
    expect(systemPrompt).toMatch(/ongoing entry[\s\S]*endDate:\s*null[\s\S]*Never copy the start date into endDate/i);
    expect(systemPrompt).toMatch(/Contact details and profile\/website links[\s\S]*do not report them in unmapped/i);
  });

  it('omits unsupported generation settings', async () => {
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

    expect(vi.mocked(generateText).mock.calls[0][0]).not.toHaveProperty('temperature');
  });
});
