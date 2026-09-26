import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CvSyncError } from '../src/cv-sync/error';
import { runCvSync } from '../src/cv-sync/index';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(packageRoot, '..', '..');
const fixtureDir = resolve(packageRoot, 'test', 'fixtures', 'cv');
const expectations = JSON.parse(await readFile(resolve(fixtureDir, 'expectations.json'), 'utf8'));
const current = parse(await readFile(resolve(repoRoot, 'content', 'resume.yaml'), 'utf8')) as { work: unknown[] };
const rows: Array<{ fixture: string; result: 'PASS' | 'FAIL'; detail: string }> = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function evaluate(name: string) {
  try {
    const result = await runCvSync({
      repoRoot,
      pdfPath: resolve(fixtureDir, `${name}.pdf`),
      dryRun: true,
      event: 'workflow_dispatch',
    });
    const expected = expectations[name];
    if (expected.outcomes) assert(expected.outcomes.includes(result.outcome), `unexpected outcome ${result.outcome}`);
    if (expected.addedWork) {
      const count = result.changes.filter((change) => change.kind === 'added' && /^work\[\d+\]$/.test('path' in change ? change.path : '')).length;
      assert(count === expected.addedWork, `expected ${expected.addedWork} added work entry, received ${count}`);
    }
    if (expected.duplicatedWork !== undefined) {
      const workCountBefore = current.work.length;
      const workCountAfter = result.next?.work.length ?? 0;
      assert(workCountAfter === workCountBefore, `work entry count changed from ${workCountBefore} to ${workCountAfter}`);
      const addedWork = result.changes.filter((change) => change.kind === 'added' && /^work\[\d+\]$/.test('path' in change ? change.path : ''));
      assert(addedWork.length === 0, `${addedWork.length} work entries were added`);
      for (const heading of expected.notMapped) {
        const normalizedHeading = heading.trim().toLocaleLowerCase();
        assert(result.changes.some((change) => change.kind === 'not-mapped' && change.heading.trim().toLocaleLowerCase() === normalizedHeading), `missing unmapped ${heading}`);
      }
    }
    if (expected.keptProjectSlugs) {
      for (const slug of expected.keptProjectSlugs) {
        const index = result.next?.projects.findIndex((project) => project.slug === slug) ?? -1;
        assert(result.changes.some((change) => change.kind === 'kept-not-in-cv' && change.path === `projects[${index}]`), `missing kept project ${slug}`);
      }
    }
    if (name === 'real-cv') {
      const kept = result.changes.filter((change) => change.kind === 'kept-not-in-cv' && /^(work|projects)\[/.test(change.path));
      assert(kept.length === 0, `${kept.length} work/project entries were not matched`);
      const duplicateEntries = result.changes.filter((change) => change.kind === 'added' && /^(work|projects)\[\d+\]$/.test(change.path));
      assert(duplicateEntries.length === 0, `${duplicateEntries.length} work/project entries were duplicated`);
      const currentSkillCount = 7;
      assert((result.next?.skills.length ?? 0) > currentSkillCount, 'no skill category was added');
    }
    rows.push({ fixture: name, result: 'PASS', detail: result.outcome });
  } catch (error) {
    const expected = expectations[name];
    if (expected.error && error instanceof CvSyncError && error.code === expected.error) {
      rows.push({ fixture: name, result: 'PASS', detail: error.code });
      return;
    }
    rows.push({
      fixture: name,
      result: 'FAIL',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

for (const fixture of Object.keys(expectations)) await evaluate(fixture);

console.log('| Fixture | Result | Detail |');
console.log('|---|---|---|');
for (const row of rows) console.log(`| ${row.fixture} | ${row.result} | ${row.detail.replaceAll('|', '\\|')} |`);
if (rows.some((row) => row.result === 'FAIL')) process.exitCode = 1;
