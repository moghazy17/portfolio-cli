import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { parseDocument } from 'yaml';
import type { Document } from 'yaml';
import { ResumeSchema, type ResumeInput } from '../content/schema';
import { loadContent } from '../content/load';
import { validateContent } from '../content/validate';
import { CvSyncError } from './error';
import { extractCv } from './extract';
import { findUngrounded } from './ground';
import { mergeCv } from './merge';
import { readPdfText } from './pdf';
import { renderPrBody, renderTitle } from './report';
import type { CvExtraction, CvSyncResult } from './types';
import { applyToDocument } from './write-yaml';

const execFileAsync = promisify(execFile);

export interface RunCvSyncOptions {
  repoRoot: string;
  pdfPath?: string;
  dryRun?: boolean;
  event: 'push' | 'workflow_dispatch';
  extract?: (options: {
    pdfPath: string;
    pdfText: string;
    current: ResumeInput;
  }) => Promise<CvExtraction>;
}

function slashPath(value: string) {
  return value.split(sep).join('/');
}

async function addedAt(repoRoot: string, path: string) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '-1', '--format=%ct', '--diff-filter=A', '--', slashPath(relative(repoRoot, path))],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    return Number(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

async function pickPdf(repoRoot: string) {
  const incoming = join(repoRoot, 'content', 'cv', 'incoming');
  const names = await readdir(incoming).catch(() => []);
  const pdfs = names
    .filter((name) => name.toLocaleLowerCase().endsWith('.pdf'))
    .map((name) => join(incoming, name));
  const dated = await Promise.all(pdfs.map(async (path) => ({
    path,
    timestamp: await addedAt(repoRoot, path),
  })));
  dated.sort((left, right) => right.timestamp - left.timestamp || right.path.localeCompare(left.path));
  return dated[0]?.path;
}

function digest(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function issuePath(path: PropertyKey[]) {
  return path.reduce<string>((result, part) => typeof part === 'number'
    ? `${result}[${part}]`
    : typeof part === 'string' ? (result ? `${result}.${part}` : part) : result, '');
}

function validateNext(next: ResumeInput, loaded: Awaited<ReturnType<typeof loadContent>>) {
  const parsed = ResumeSchema.safeParse(next);
  if (!parsed.success) {
    throw new CvSyncError(
      'INVALID_RESULT',
      parsed.error.issues.map((issue) => `${issuePath(issue.path)}  ${issue.message}`).join('\n'),
    );
  }
  const issues = validateContent({
    ...loaded,
    issues: [],
    resume: parsed.data,
    content: loaded.content ? { ...loaded.content, resume: parsed.data } : undefined,
  }).filter((issue) => issue.severity === 'error');
  if (issues.length > 0) {
    throw new CvSyncError(
      'INVALID_RESULT',
      issues.map((issue) => `${issue.path}  ${issue.message}`).join('\n'),
    );
  }
}

export async function runCvSync(options: RunCvSyncOptions): Promise<CvSyncResult> {
  const repoRoot = resolve(options.repoRoot);
  const selected = options.pdfPath
    ? resolve(repoRoot, options.pdfPath)
    : await pickPdf(repoRoot);
  if (!selected) {
    if (options.event === 'push') {
      if (!options.dryRun) {
        const outputDir = join(repoRoot, '.cv-sync');
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'pr-body.md'), 'Nothing to process\n');
        await writeFile(join(outputDir, 'title.txt'), '');
      }
      return { outcome: 'nothing', changes: [] };
    }
    throw new CvSyncError('NO_INPUT', 'no PDF was selected');
  }

  const pdfText = await readPdfText(selected);
  const loaded = await loadContent(repoRoot);
  const currentErrors = validateContent(loaded).filter((issue) => issue.severity === 'error');
  if (!loaded.resume || currentErrors.length > 0) {
    throw new CvSyncError(
      'INVALID_RESULT',
      currentErrors.map((issue) => `${issue.path}  ${issue.message}`).join('\n'),
    );
  }

  const resumePath = join(repoRoot, 'content', 'resume.yaml');
  const currentYaml = await readFile(resumePath, 'utf8');
  const document = parseDocument(currentYaml) as Document;
  const current = document.toJS() as ResumeInput;
  const extraction = await (options.extract ?? extractCv)({
    pdfPath: selected,
    pdfText,
    current,
  });
  const merged = mergeCv(current, extraction);
  merged.changes.push(...findUngrounded(merged.changes, pdfText));
  const nextYaml = merged.changes.some((change) => change.operation)
    ? applyToDocument(document, merged.changes)
    : currentYaml;
  const nextDocument = parseDocument(nextYaml) as Document;
  if (nextDocument.errors.length > 0) {
    throw new CvSyncError(
      'INVALID_RESULT',
      `written resume YAML is invalid: ${nextDocument.errors.map((error) => error.message).join('\n')}`,
    );
  }
  const writtenNext = nextDocument.toJS();
  validateNext(writtenNext as ResumeInput, loaded);
  if (!isDeepStrictEqual(writtenNext, merged.next)) {
    throw new CvSyncError(
      'INVALID_RESULT',
      'written resume YAML diverges from the merged resume model',
    );
  }
  const resumeChanged = nextYaml !== currentYaml;

  const pdf = await readFile(selected);
  const latestPath = join(repoRoot, 'content', 'cv', 'latest.pdf');
  const latest = existsSync(latestPath) ? await readFile(latestPath) : undefined;
  const pdfChanged = !latest || digest(pdf) !== digest(latest);
  const outcome = resumeChanged ? 'changes' : pdfChanged ? 'pdf-only' : 'no-changes';
  const sourcePath = slashPath(relative(repoRoot, selected));
  const prBody = renderPrBody(merged.changes, { sourcePath });
  const changeCount = merged.changes.filter((change) =>
    change.kind === 'added' || change.kind === 'updated' || change.kind === 'removed').length;
  const title = renderTitle(outcome, changeCount, basename(selected));
  const result: CvSyncResult = {
    outcome,
    changes: merged.changes,
    fileName: basename(selected),
    sourcePath,
    next: merged.next,
    yaml: nextYaml,
    title,
    prBody,
  };

  if (!options.dryRun) {
    const outputDir = join(repoRoot, '.cv-sync');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'pr-body.md'), prBody);
    await writeFile(join(outputDir, 'title.txt'), `${title}\n`);
    if (outcome !== 'no-changes') {
      if (resumeChanged) await writeFile(resumePath, nextYaml);
      await mkdir(join(repoRoot, 'content', 'cv'), { recursive: true });
      await copyFile(selected, latestPath);
      const incoming = join(repoRoot, 'content', 'cv', 'incoming');
      const incomingFiles = await readdir(incoming).catch(() => []);
      await Promise.all(incomingFiles
        .filter((name) => name.toLocaleLowerCase().endsWith('.pdf'))
        .map((name) => unlink(join(incoming, name))));
    }
  }
  return result;
}

export { CvSyncError } from './error';
export { ExtractionSchema, assignTransientIds, extractCv, resolveCvSyncModel } from './extract';
export { findUngrounded } from './ground';
export { mergeCv } from './merge';
export { normalizeText, readPdfText } from './pdf';
export { renderPrBody, renderStepSummary, renderTitle } from './report';
export { applyToDocument } from './write-yaml';
export type { AppliedChange, Change, CvExtraction, CvOutcome, CvSyncResult } from './types';
