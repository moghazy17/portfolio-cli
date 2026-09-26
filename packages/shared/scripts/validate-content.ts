import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatIssues, loadContent, validateContent } from '../src/content/node';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const loaded = await loadContent(repoRoot);
const issues = validateContent(loaded);
console.log(formatIssues(issues));
if (issues.some((issue) => issue.severity === 'error')) process.exitCode = 1;
