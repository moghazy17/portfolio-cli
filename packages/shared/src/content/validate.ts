import type { ContentIssue, LoadedContent } from './load';
import { isNode } from 'yaml';

function locationFor(
  loaded: LoadedContent,
  file: string,
  path: (string | number)[],
) {
  const source = loaded.sources.get(file);
  if (!source) return { line: 1, col: 1 };
  for (let length = path.length; length >= 0; length -= 1) {
    const node = source.document.getIn(path.slice(0, length), true);
    if (isNode(node) && node.range) {
      const position = source.lineCounter.linePos(node.range[0]);
      return { line: position.line + source.lineOffset, col: position.col };
    }
  }
  return { line: 1, col: 1 };
}

function pathText(path: (string | number)[]) {
  return path.reduce<string>(
    (result, part) => typeof part === 'number'
      ? `${result}[${part}]`
      : result ? `${result}.${part}` : part,
    '',
  );
}

function duplicateSlugIssues(
  loaded: LoadedContent,
  section: 'work' | 'projects',
): ContentIssue[] {
  const resume = loaded.resume;
  if (!resume) return [];
  const entries = resume[section];
  const first = new Map<string, number>();
  const issues: ContentIssue[] = [];
  for (const [index, entry] of entries.entries()) {
    const prior = first.get(entry.slug);
    if (prior === undefined) {
      first.set(entry.slug, index);
      continue;
    }
    const path = [section, index, 'slug'];
    issues.push({
      severity: 'error',
      file: 'content/resume.yaml',
      path: pathText(path),
      message: `duplicate slug "${entry.slug}" (also ${section}[${prior}].slug)`,
      ...locationFor(loaded, 'content/resume.yaml', path),
    });
  }
  return issues;
}

export function validateContent(loaded: LoadedContent): ContentIssue[] {
  const issues = [...loaded.issues];
  const resume = loaded.resume;
  if (!resume) return issues;

  issues.push(...duplicateSlugIssues(loaded, 'work'));
  issues.push(...duplicateSlugIssues(loaded, 'projects'));

  const knownSlugs = resume.projects.map((project) => project.slug);
  for (const folder of loaded.writeupFolders) {
    if (!knownSlugs.includes(folder)) {
      issues.push({
        severity: 'error',
        file: `content/projects/${folder}/README.md`,
        path: '',
        message: `folder "${folder}" does not match any projects[].slug (known: ${knownSlugs.join(', ')})`,
        line: 1,
        col: 1,
      });
    }
  }

  for (const network of ['LinkedIn', 'GitHub']) {
    const matches = resume.basics.profiles
      .map((profile, index) => ({ profile, index }))
      .filter(({ profile }) => profile.network === network);
    if (matches.length !== 1) {
      const path = ['basics', 'profiles'];
      issues.push({
        severity: 'error',
        file: 'content/resume.yaml',
        path: pathText(path),
        message: `expected exactly one ${network} profile, received ${matches.length}`,
        ...locationFor(loaded, 'content/resume.yaml', path),
      });
    }
  }

  if (resume.education.length > 1) {
    const path = ['education'];
    issues.push({
      severity: 'warning',
      file: 'content/resume.yaml',
      path: 'education',
      message: `${resume.education.length} entries; commands currently show only the first`,
      ...locationFor(loaded, 'content/resume.yaml', path),
    });
  }

  return issues;
}

export function formatIssues(issues: ContentIssue[]): string {
  const sorted = [...issues].sort((left, right) =>
    left.severity === right.severity ? 0 : left.severity === 'error' ? -1 : 1,
  );
  const lines = sorted.map((issue) => {
    const marker = issue.severity === 'error' ? '✖' : '⚠';
    const location = issue.line && issue.col
      ? `${issue.file}:${issue.line}:${issue.col}`
      : issue.file;
    return `${marker} ${location}  ${issue.path}  ${issue.message}`;
  });
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  lines.push(`${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`);
  return lines.join('\n');
}
