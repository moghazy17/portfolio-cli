import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatIssues, loadContent, validateContent } from '../src/content/node';

const sharedRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(sharedRoot, '../..');
const loaded = await loadContent(repoRoot);
const issues = validateContent(loaded);
console.log(formatIssues(issues));

if (issues.some((issue) => issue.severity === 'error') || !loaded.content) {
  process.exitCode = 1;
} else {
  const canonicalJson = JSON.stringify(loaded.content);
  const contentVersion = `sha256:${createHash('sha256').update(canonicalJson).digest('hex')}`;
  const output = [
    '// GENERATED — do not edit.',
    "import type { Content } from './schema';",
    '',
    `export const content: Content = ${JSON.stringify(loaded.content, null, 2)};`,
    `export const contentVersion = ${JSON.stringify(contentVersion)};`,
    `export const generatedAt = ${JSON.stringify(new Date().toISOString())};`,
    '',
  ].join('\n');
  const outputFile = resolve(sharedRoot, 'src/content/generated.ts');
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, output);
}
