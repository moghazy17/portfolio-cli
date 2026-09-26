import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ExtractionSchema } from '../src/cv-sync/extract';
import { runCvSync } from '../src/cv-sync/index';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const fixtureDir = resolve(import.meta.dirname, 'fixtures', 'cv');

describe('CV sync input outcomes', () => {
  it('treats an empty incoming directory on push as a successful no-op', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'cv-sync-empty-'));
    await expect(runCvSync({ repoRoot, dryRun: true, event: 'push' })).resolves.toEqual({
      outcome: 'nothing',
      changes: [],
    });
  });

  it('fails an empty manual run with NO_INPUT', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'cv-sync-empty-'));
    await expect(runCvSync({ repoRoot, dryRun: true, event: 'workflow_dispatch' }))
      .rejects.toMatchObject({ code: 'NO_INPUT' });
  });

  it('returns YAML that agrees with the merged resume model', async () => {
    const extraction = ExtractionSchema.parse(JSON.parse(
      await readFile(join(fixtureDir, 'new-layout.extraction.json'), 'utf8'),
    ));
    const result = await runCvSync({
      repoRoot,
      pdfPath: 'packages/shared/test/fixtures/cv/new-layout.pdf',
      dryRun: true,
      event: 'workflow_dispatch',
      extract: async () => extraction,
    });

    expect(parse(result.yaml!)).toEqual(result.next);
  });
});
