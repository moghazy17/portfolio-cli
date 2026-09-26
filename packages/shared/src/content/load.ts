import { existsSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { LineCounter, isNode, parseDocument } from 'yaml';
import type { Document, Node } from 'yaml';
import type { ZodIssue } from 'zod';
import {
  ResumeSchema,
  SiteSchema,
  WriteupFrontMatterSchema,
  type Content,
  type Resume,
} from './schema';

export interface ContentIssue {
  severity: 'error' | 'warning';
  file: string;
  path: string;
  message: string;
  line?: number;
  col?: number;
}

interface SourceDocument {
  document: Document;
  lineCounter: LineCounter;
  lineOffset: number;
}

export interface LoadedContent {
  content?: Content;
  issues: ContentIssue[];
  contentDir: string;
  resume?: Resume;
  writeupFolders: string[];
  sources: Map<string, SourceDocument>;
}

const frontMatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function contentPath(rootDir: string) {
  const absolute = resolve(rootDir);
  return basename(absolute).toLowerCase() === 'content'
    ? absolute
    : join(absolute, 'content');
}

function displayPath(contentDir: string, file: string) {
  return ['content', relative(contentDir, file)].join('/').split(sep).join('/');
}

function formatPath(path: PropertyKey[]) {
  return path.reduce<string>((result, part) => {
    if (typeof part === 'number') return `${result}[${part}]`;
    if (typeof part !== 'string') return result;
    return result ? `${result}.${part}` : part;
  }, '');
}

function nodeAtPath(document: Document, path: PropertyKey[]): Node | undefined {
  for (let length = path.length; length >= 0; length -= 1) {
    const value = document.getIn(path.slice(0, length) as (string | number)[], true);
    if (isNode(value)) return value;
  }
  return undefined;
}

function zodIssues(
  errors: ZodIssue[],
  file: string,
  source: SourceDocument,
): ContentIssue[] {
  return errors.flatMap((issue) => {
    const keys = issue.code === 'unrecognized_keys' ? issue.keys : [undefined];
    return keys.map((unknownKey) => {
      const path = unknownKey === undefined ? issue.path : [...issue.path, unknownKey];
      const node = nodeAtPath(source.document, path);
      const position = node?.range
        ? source.lineCounter.linePos(node.range[0])
        : undefined;
      return {
        severity: 'error' as const,
        file,
        path: formatPath(path),
        message: unknownKey === undefined
          ? issue.message
          : `unrecognized key "${unknownKey}"`,
        line: position ? position.line + source.lineOffset : 1,
        col: position?.col ?? 1,
      };
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeyIssues(
  file: string,
  source: SourceDocument,
  value: unknown,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const inspect = (entry: unknown, path: (string | number)[], allowed: string[]) => {
    if (!isRecord(entry)) return;
    for (const key of Object.keys(entry)) {
      if (allowed.includes(key) || key.startsWith('x-')) continue;
      const issuePath = [...path, key];
      const node = nodeAtPath(source.document, issuePath);
      const position = node?.range
        ? source.lineCounter.linePos(node.range[0])
        : undefined;
      issues.push({
        severity: 'error',
        file,
        path: formatPath(issuePath),
        message: `unknown key (allowed keys: ${allowed.join(', ')}; extension keys must start with "x-")`,
        line: position?.line ?? 1,
        col: position?.col ?? 1,
      });
    }
  };

  if (!isRecord(value)) return issues;
  inspect(value.basics, ['basics'], ['name', 'label', 'summary', 'email', 'phone', 'location', 'profiles']);
  if (isRecord(value.basics)) {
    inspect(value.basics.location, ['basics', 'location'], ['city', 'countryCode']);
    if (Array.isArray(value.basics.profiles)) {
      value.basics.profiles.forEach((entry, index) => inspect(
        entry,
        ['basics', 'profiles', index],
        ['network', 'url', 'username'],
      ));
    }
  }
  const collections: Array<[string, string[]]> = [
    ['education', ['institution', 'area', 'studyType', 'faculty', 'location', 'score', 'startDate', 'endDate', 'courses']],
    ['work', ['slug', 'name', 'position', 'startDate', 'endDate', 'highlights']],
    ['projects', ['slug', 'name', 'stack', 'graduation', 'startDate', 'endDate', 'highlights']],
    ['certificates', ['name', 'issuer', 'startDate', 'endDate', 'highlights']],
    ['skills', ['name', 'keywords']],
  ];
  for (const [collection, allowed] of collections) {
    const entries = value[collection];
    if (Array.isArray(entries)) {
      entries.forEach((entry, index) => inspect(entry, [collection, index], allowed));
    }
  }
  return issues;
}

async function parseYamlFile(
  filePath: string,
  contentDir: string,
  issues: ContentIssue[],
) {
  const file = displayPath(contentDir, filePath);
  let sourceText: string;
  try {
    sourceText = await readFile(filePath, 'utf8');
  } catch {
    issues.push({
      severity: 'error',
      file,
      path: '',
      message: 'file is missing or unreadable',
      line: 1,
      col: 1,
    });
    return undefined;
  }
  const lineCounter = new LineCounter();
  const document = parseDocument(sourceText, { lineCounter, prettyErrors: false });
  for (const error of document.errors) {
    const position = lineCounter.linePos(error.pos[0]);
    issues.push({
      severity: 'error',
      file,
      path: '',
      message: error.message,
      line: position.line,
      col: position.col,
    });
  }
  return { document, lineCounter, lineOffset: 0 } satisfies SourceDocument;
}

export async function loadContent(rootDir: string): Promise<LoadedContent> {
  const resolvedContentDir = contentPath(rootDir);
  const issues: ContentIssue[] = [];
  const sources = new Map<string, SourceDocument>();
  const resumeFile = join(resolvedContentDir, 'resume.yaml');
  const siteFile = join(resolvedContentDir, 'site.yaml');
  const resumeSource = await parseYamlFile(resumeFile, resolvedContentDir, issues);
  const siteSource = await parseYamlFile(siteFile, resolvedContentDir, issues);
  const resumeDisplay = displayPath(resolvedContentDir, resumeFile);
  const siteDisplay = displayPath(resolvedContentDir, siteFile);
  if (resumeSource) sources.set(resumeDisplay, resumeSource);
  if (siteSource) sources.set(siteDisplay, siteSource);

  const resumeValue = resumeSource?.document.toJS();
  const siteValue = siteSource?.document.toJS();
  const resumeResult = resumeSource
    ? ResumeSchema.safeParse(resumeValue)
    : undefined;
  const siteResult = siteSource
    ? SiteSchema.safeParse(siteValue)
    : undefined;
  if (resumeResult && !resumeResult.success) {
    issues.push(...zodIssues(resumeResult.error.issues, resumeDisplay, resumeSource!));
  }
  if (resumeSource) {
    issues.push(...unknownKeyIssues(resumeDisplay, resumeSource, resumeValue));
  }
  if (siteResult && !siteResult.success) {
    issues.push(...zodIssues(siteResult.error.issues, siteDisplay, siteSource!));
  }

  const writeups: Content['writeups'] = {};
  const writeupFolders: string[] = [];
  const projectsDir = join(resolvedContentDir, 'projects');
  let entries: Dirent[] = [];
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const readme = join(projectsDir, slug, 'README.md');
    if (!existsSync(readme)) continue;
    writeupFolders.push(slug);
    const file = displayPath(resolvedContentDir, readme);
    const markdown = await readFile(readme, 'utf8');
    const match = markdown.match(frontMatterPattern);
    const frontMatter = match?.[1] ?? '';
    const body = match ? markdown.slice(match[0].length) : markdown;
    const lineCounter = new LineCounter();
    const document = parseDocument(frontMatter, { lineCounter, prettyErrors: false });
    const source = { document, lineCounter, lineOffset: match ? 1 : 0 };
    sources.set(file, source);
    for (const error of document.errors) {
      const position = lineCounter.linePos(error.pos[0]);
      issues.push({
        severity: 'error',
        file,
        path: '',
        message: error.message,
        line: position.line + source.lineOffset,
        col: position.col,
      });
    }
    const result = WriteupFrontMatterSchema.safeParse(document.toJS() ?? {});
    if (!result.success) {
      issues.push(...zodIssues(result.error.issues, file, source));
    } else {
      writeups[slug] = { ...result.data, body };
    }
  }

  const resume = resumeResult?.success ? resumeResult.data : undefined;
  const site = siteResult?.success ? siteResult.data : undefined;
  const content = resume && site
    ? {
        schemaVersion: 1 as const,
        resume,
        site,
        writeups,
        cv: {
          available: existsSync(join(resolvedContentDir, 'cv', 'latest.pdf')),
          path: '/cv/latest.pdf' as const,
        },
      }
    : undefined;

  return {
    content,
    issues,
    contentDir: resolvedContentDir,
    resume,
    writeupFolders,
    sources,
  };
}
