import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExtractionSchema } from '../src/cv-sync/extract';
import { CvSyncError } from '../src/cv-sync/error';
import { runCvSync } from '../src/cv-sync/index';
import { renderStepSummary } from '../src/cv-sync/report';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(packageRoot, '..', '..');
const args = process.argv.slice(2);

function option(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const event = option('--event') ?? 'workflow_dispatch';
if (event !== 'push' && event !== 'workflow_dispatch') {
  console.error('--event must be push or workflow_dispatch');
  process.exit(1);
}

async function writeSummary(summary: string) {
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}

try {
  const extractionPath = option('--extraction');
  const extraction = extractionPath
    ? ExtractionSchema.parse(JSON.parse(await readFile(resolve(repoRoot, extractionPath), 'utf8')))
    : undefined;
  const result = await runCvSync({
    repoRoot,
    pdfPath: option('--pdf'),
    dryRun: args.includes('--dry-run'),
    event,
    extract: extraction ? async () => extraction : undefined,
  });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `outcome=${result.outcome}\n`);
    if (result.fileName) await appendFile(process.env.GITHUB_OUTPUT, `file_name=${result.fileName}\n`);
    if (result.title) await appendFile(process.env.GITHUB_OUTPUT, `title=${result.title}\n`);
  }
  await writeSummary(renderStepSummary(result));
} catch (error) {
  const failure = error instanceof CvSyncError
    ? error
    : new CvSyncError('EXTRACTION_FAILED', error instanceof Error ? error.message : String(error));
  await writeSummary(renderStepSummary(failure));
  process.exitCode = 1;
}
