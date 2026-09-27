import { describe, expect, it } from 'vitest';
import type { Content } from '../src/content/schema';
import { itemIds, slugify } from '../src/content/items';

function fixture(): Content {
  return {
    resume: {
      projects: [{ slug: 'first-project' }, { slug: 'second-project' }],
      work: [{ slug: 'north', position: 'Senior Engineer' }, { slug: 'south', position: 'Lead Developer' }],
      certificates: [{ name: 'Cloud Expert' }, { name: 'Data Expert' }],
      skills: [{ name: 'TypeScript' }, { name: 'Testing' }],
    },
  } as Content;
}

describe('item identity', () => {
  it('uses project slugs and work slug plus position', () => {
    const ids = itemIds(fixture());
    expect(ids.project).toEqual(['first-project', 'second-project']);
    expect(ids.experience).toEqual(['north-senior-engineer', 'south-lead-developer']);
    expect(ids.certification).toEqual(['cloud-expert', 'data-expert']);
    expect(ids.skill).toEqual(['typescript', 'testing']);
  });

  it('normalizes diacritics, punctuation, length, and empty names', () => {
    expect(slugify('  Café + Résumé!!  ')).toBe('cafe-resume');
    expect(slugify('a\u1ab0b')).toBe('ab');
    expect(slugify('A'.repeat(60) + '-tail')).toBe('a'.repeat(60));
    expect(slugify('a'.repeat(59) + '-tail')).toBe('a'.repeat(59));

    const content = fixture();
    content.resume.certificates = [{ name: '!!!' }, { name: '???' }] as Content['resume']['certificates'];
    content.resume.skills = [{ name: '✨' }] as Content['resume']['skills'];
    expect(itemIds(content).certification).toEqual(['certification-1', 'certification-2']);
    expect(itemIds(content).skill).toEqual(['skill-1']);
  });

  it('suffixes collisions in content order and returns stable parallel arrays', () => {
    const content = fixture();
    content.resume.certificates = [
      { name: 'Café' },
      { name: 'Cafe!' },
      { name: 'cafe' },
    ] as Content['resume']['certificates'];
    content.resume.skills = [{ name: 'A' }, { name: 'A' }] as Content['resume']['skills'];
    const first = itemIds(content);

    expect(first.certification).toEqual(['cafe', 'cafe-2', 'cafe-3']);
    expect(first.skill).toEqual(['a', 'a-2']);
    expect(first).toEqual(itemIds(content));
    expect(first.project).toHaveLength(content.resume.projects.length);
    expect(first.experience).toHaveLength(content.resume.work.length);
    expect(first.certification).toHaveLength(content.resume.certificates.length);
    expect(first.skill).toHaveLength(content.resume.skills.length);
  });
});
