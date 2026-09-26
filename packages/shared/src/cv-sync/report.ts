import { basename } from 'node:path';
import { CvSyncError } from './error';
import type { AppliedChange, CvOutcome, CvSyncResult } from './types';

export interface PrBodyMeta {
  sourcePath: string;
  destinationPath?: string;
}

function inline(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function bullet(change: AppliedChange) {
  if (change.kind === 'added') return `- \`${change.path}\` ${inline(change.value)}`;
  if (change.kind === 'removed') return `- \`${change.path}\` ${inline(change.value)}`;
  if (change.kind === 'updated') {
    return `- \`${change.path}\`\n  - from: ${inline(change.from)}\n  - to:   ${inline(change.to)}`;
  }
  if (change.kind === 'possible-rename') {
    return `- \`${change.path}\` CV: ${inline(change.cvLabel)} · resume: ${inline(change.resumeLabel)}`;
  }
  if (change.kind === 'not-grounded') return `- \`${change.path}\` ${inline(change.value)}`;
  if (change.kind === 'protected-unmatched') return `- \`${change.path}\` ${inline(change.value)}`;
  if (change.kind === 'new-project-review') return `- \`${change.path}\` ${inline(change.label)}`;
  if (change.kind === 'kept-not-in-cv') return `- \`${change.path}\` ${inline(change.label)}`;
  if (change.kind === 'not-mapped') return `- **${inline(change.heading)}:** ${inline(change.text)}`;
  if (change.kind === 'warning') return `- \`${change.path}\` ${inline(change.message)}`;
  return '';
}

function section(lines: string[], title: string, changes: AppliedChange[]) {
  if (changes.length === 0) return;
  lines.push(title, ...changes.map(bullet));
}

export function renderPrBody(changes: AppliedChange[], meta: PrBodyMeta): string {
  const added = changes.filter((change) => change.kind === 'added');
  const updated = changes.filter((change) => change.kind === 'updated');
  const removed = changes.filter((change) => change.kind === 'removed');
  const possibleRename = changes.filter((change) => change.kind === 'possible-rename');
  const notGrounded = changes.filter((change) => change.kind === 'not-grounded');
  const protectedUnmatched = changes.filter((change) => change.kind === 'protected-unmatched');
  const newProject = changes.filter((change) => change.kind === 'new-project-review');
  const warnings = changes.filter((change) => change.kind === 'warning');
  const needsLook = possibleRename.length + notGrounded.length
    + protectedUnmatched.length + newProject.length + warnings.length;
  const kept = changes.filter((change) => change.kind === 'kept-not-in-cv');
  const unmapped = changes.filter((change) => change.kind === 'not-mapped');
  const destination = meta.destinationPath ?? 'content/cv/latest.pdf';
  const lines = [
    `**Source:** \`${meta.sourcePath}\` → \`${destination}\``,
    `**Summary:** ${added.length} added · ${updated.length} updated · ${removed.length} removed · ${needsLook} needs a look`,
  ];
  section(lines, '### Added', added);
  section(lines, '### Updated', updated);
  section(lines, '### Removed (no longer in the CV)', removed);
  if (needsLook > 0 || warnings.length > 0) {
    lines.push('### ⚠ Needs a look');
    section(lines, '#### Possible rename / duplicate', possibleRename);
    section(lines, '#### Not found verbatim in CV — please check', notGrounded);
    section(lines, '#### Protected, not matched in CV', protectedUnmatched);
    section(lines, '#### New project — set `graduation` if needed', newProject);
    section(lines, '#### Extraction warnings', warnings);
  }
  section(lines, '### Not in CV, kept', kept);
  section(lines, '### In CV, not mapped', unmapped);
  lines.push(
    '---',
    'Protected fields are never changed. To protect a field, write it as `{ value: "…", manual: true }`.',
  );
  return `${lines.join('\n')}\n`;
}

export function renderTitle(outcome: CvOutcome, count: number, fileName: string): string {
  if (outcome === 'pdf-only') return `CV update: PDF only (${basename(fileName)})`;
  return `CV update: ${count} changes from ${basename(fileName)}`;
}

function failureSummary(error: CvSyncError) {
  if (error.code === 'NO_INPUT') {
    return 'No PDF in content/cv/incoming/. (manual runs only)';
  }
  if (error.code === 'UNREADABLE') {
    return `The CV could not be read (corrupt, password-protected, image-only, or too large): ${error.message}`;
  }
  if (error.code === 'EXTRACTION_FAILED') {
    return `The AI extraction failed after 2 attempts: ${error.message}.`;
  }
  return `The updated resume failed validation:\n${error.message}`;
}

export function renderStepSummary(result: CvSyncResult | CvSyncError): string {
  if (result instanceof CvSyncError) return `${failureSummary(result)}\n`;
  if (result.outcome === 'nothing') return 'Nothing to process\n';
  if (result.outcome === 'no-changes') return 'No changes\n';
  if (result.outcome === 'pdf-only') return 'PDF only\n';
  return result.prBody ?? 'CV changes prepared\n';
}
