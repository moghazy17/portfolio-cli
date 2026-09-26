import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { ResumeInput } from '../src/content/schema';
import { ExtractionSchema } from '../src/cv-sync/extract';
import { mergeCv } from '../src/cv-sync/merge';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const fixtureDir = resolve(import.meta.dirname, 'fixtures', 'cv');
const current = parse(await readFile(resolve(repoRoot, 'content', 'resume.yaml'), 'utf8')) as ResumeInput;
const same = ExtractionSchema.parse(JSON.parse(await readFile(resolve(fixtureDir, 'same-as-current.extraction.json'), 'utf8')));
const edge = ExtractionSchema.parse(JSON.parse(await readFile(resolve(fixtureDir, 'edge-cases.extraction.json'), 'utf8')));

describe('deterministic CV merge', () => {
  it('keeps fields omitted by the extraction, except an end date implied as Present', () => {
    const extraction = structuredClone(same) as any;
    delete extraction.education[0].faculty;
    delete extraction.education[0].location;
    delete extraction.work[1].endDate;
    extraction.work[1].startDate = current.work[1].startDate;
    expect(() => ExtractionSchema.parse(extraction)).not.toThrow();

    const result = mergeCv(current, extraction);

    expect(result.next.education[0].faculty).toBe(current.education[0].faculty);
    expect(result.next.education[0].location).toBe(current.education[0].location);
    expect(result.next.work[1].endDate).toBeUndefined();
    expect(result.changes).toContainEqual(expect.objectContaining({
      kind: 'removed', path: 'work[1].endDate', value: current.work[1].endDate,
    }));
  });

  it('adds duplicate item and entry references instead of overwriting the first update', () => {
    const itemExtraction = structuredClone(same) as any;
    itemExtraction.work[0].highlights = [
      { _id: 'w0.h0', value: 'First CV bullet.' },
      { _id: 'w0.h0', value: 'Second CV bullet.' },
    ];
    const itemResult = mergeCv(current, itemExtraction);
    expect(itemResult.next.work[0].highlights).toContain('First CV bullet.');
    expect(itemResult.next.work[0].highlights).toContain('Second CV bullet.');
    expect(itemResult.changes).toContainEqual(expect.objectContaining({
      kind: 'warning', message: 'Duplicate reference to w0.h0; added as a new item',
    }));

    const protectedItemResume = structuredClone(current) as any;
    protectedItemResume.work[0].highlights[0] = { value: 'Protected bullet.', manual: true };
    const protectedItemResult = mergeCv(protectedItemResume, itemExtraction);
    expect(protectedItemResult.next.work[0].highlights).not.toContain('Second CV bullet.');
    expect(protectedItemResult.changes).not.toContainEqual(expect.objectContaining({
      message: 'Duplicate reference to w0.h0; added as a new item',
    }));

    const entryExtraction = structuredClone(same) as any;
    entryExtraction.work = [
      { ...entryExtraction.work[0], position: 'First CV role.' },
      { ...entryExtraction.work[0], position: 'Second CV role.' },
    ];
    const entryResult = mergeCv(current, entryExtraction);
    expect(entryResult.next.work).toContainEqual(expect.objectContaining({ position: 'First CV role.' }));
    expect(entryResult.next.work).toContainEqual(expect.objectContaining({ position: 'Second CV role.' }));
    expect(entryResult.changes).toContainEqual(expect.objectContaining({
      kind: 'warning', message: 'Duplicate reference to w0; added as a new entry',
    }));
  });

  it('never matches entry ids beyond the original section length and preserves unknown item ids as additions', () => {
    const extraction = structuredClone(same) as any;
    extraction.projects = [
      {
        name: 'First appended project', stack: 'TypeScript', startDate: '2026-01',
        highlights: [{ value: 'First appended highlight.' }],
      },
      {
        _id: `p${current.projects.length}`,
        name: 'Must not update appended project', stack: 'TypeScript', startDate: '2026-02',
        highlights: [{ value: 'Unexpected update.' }],
      },
    ];

    const result = mergeCv(current, extraction);
    expect(result.next.projects).toHaveLength(current.projects.length + 1);
    expect(result.next.projects.at(-1)).toEqual(expect.objectContaining({ name: 'First appended project' }));
    expect(result.changes).toContainEqual(expect.objectContaining({
      kind: 'warning', message: `Ignored unknown transient id p${current.projects.length}`,
    }));

    const itemExtraction = structuredClone(same) as any;
    itemExtraction.work[0].highlights = [{
      _id: `w0.h${current.work[0].highlights.length}`,
      value: 'Must not match beyond original highlights.',
    }];
    const itemResult = mergeCv(current, itemExtraction);
    expect(itemResult.next.work[0].highlights).toContain('Must not match beyond original highlights.');
    expect(itemResult.changes).toContainEqual(expect.objectContaining({
      kind: 'warning', message: `Unknown item id w0.h${current.work[0].highlights.length}; added as a new item`,
    }));
    expect(itemResult.changes).toContainEqual(expect.objectContaining({
      kind: 'added', value: 'Must not match beyond original highlights.',
    }));
  });

  it('preserves malformed and cross-entry item ids as additions', () => {
    const extraction = structuredClone(same) as any;
    extraction.work[0].highlights.push(
      { _id: 'not-an-item-id', value: 'Malformed item id.' },
      { _id: 'w1.h0', value: 'Other entry item id.' },
    );

    const result = mergeCv(current, extraction);

    expect(result.next.work[0].highlights).toEqual(expect.arrayContaining([
      'Malformed item id.',
      'Other entry item id.',
    ]));
    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'warning', message: 'Unknown item id not-an-item-id; added as a new item',
      }),
      expect.objectContaining({
        kind: 'warning', message: 'Unknown item id w1.h0; added as a new item',
      }),
      expect.objectContaining({ kind: 'added', value: 'Malformed item id.' }),
      expect.objectContaining({ kind: 'added', value: 'Other entry item id.' }),
    ]));
  });

  it('keeps entries and stable slugs when the CV omits an entry', async () => {
    const dropped = ExtractionSchema.parse(JSON.parse(await readFile(resolve(fixtureDir, 'dropped-project.extraction.json'), 'utf8')));
    const result = mergeCv(current, dropped);
    expect((result.next.projects as unknown[]).length).toBe((current.projects as unknown[]).length);
    expect(result.next.projects.map((project) => project.slug)).toEqual(current.projects.map((project) => project.slug));
    expect(result.changes).toContainEqual(expect.objectContaining({
      kind: 'kept-not-in-cv', path: 'projects[4]', label: 'Star-Schema Data Warehouse',
    }));
  });

  it('enforces protected values and item matching in code', () => {
    const protectedResume = structuredClone(current) as any;
    protectedResume.work[0].position = { value: 'Exact protected role', manual: true };
    protectedResume.work[0].highlights[0] = { value: 'Exact protected bullet', manual: true };
    protectedResume.work[0].highlights[1] = { value: 'Unmatched protected bullet', manual: true };
    protectedResume.skills[0].keywords[0] = { value: 'Exact protected skill', manual: true };
    const result = mergeCv(protectedResume, edge);
    expect((result.next as any).work[0].position).toEqual({ value: 'Exact protected role', manual: true });
    expect((result.next as any).work[0].highlights[0]).toEqual({ value: 'Exact protected bullet', manual: true });
    expect((result.next as any).work[0].highlights).not.toContain('CV wording for a protected bullet.');
    expect(result.changes).toContainEqual(expect.objectContaining({
      kind: 'protected-unmatched', value: 'Unmatched protected bullet',
    }));
    expect(result.changes).toContainEqual(expect.objectContaining({ kind: 'warning' }));
    expect(result.changes).toContainEqual(expect.objectContaining({
      kind: 'removed', value: 'SQL',
    }));
  });

  it('never accepts profiles from extraction', () => {
    expect('profiles' in ExtractionSchema.shape.basics.shape).toBe(false);
    const result = mergeCv(current, same);
    expect(result.next.basics.profiles).toEqual(current.basics.profiles);
  });

  it('cross-checks rename confidence when name and dates both change', () => {
    const extraction = structuredClone(same);
    extraction.work[0].name = 'Renamed employer';
    extraction.work[0].startDate = '2026-01';
    extraction.work[0]._match = 'certain';
    const result = mergeCv(current, extraction);
    expect(result.changes).toContainEqual(expect.objectContaining({
      kind: 'possible-rename', path: 'work[0]',
    }));
  });

  it('generates unique slugs and review flags for new projects', () => {
    const extraction = structuredClone(same);
    extraction.projects.push({
      name: 'AutoML Pipeline', stack: 'Python', startDate: '2026-01',
      highlights: [{ value: 'Built another project.' }],
    });
    const result = mergeCv(current, extraction);
    const added = result.next.projects.at(-1)!;
    expect(added.slug).toBe('automl-pipeline');
    expect(added.graduation).toBe(false);
    expect(result.changes).toContainEqual(expect.objectContaining({ kind: 'new-project-review' }));
  });

  it('logs uncertain matches and unmapped sections', async () => {
    const extraction = ExtractionSchema.parse(JSON.parse(await readFile(resolve(fixtureDir, 'new-layout.extraction.json'), 'utf8')));
    const result = mergeCv(current, extraction);
    expect(result.changes).toContainEqual(expect.objectContaining({ kind: 'possible-rename' }));
    expect(result.changes).toContainEqual({ kind: 'not-mapped', heading: 'Languages', text: 'Arabic, English' });
  });
});
