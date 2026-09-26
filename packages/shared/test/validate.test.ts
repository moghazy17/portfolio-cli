import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/load';
import { formatIssues, validateContent } from '../src/content/validate';

const repoRoot = resolve(import.meta.dirname, '../../..');
const tempRoots: string[] = [];

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-content-'));
  tempRoots.push(root);
  await cp(join(repoRoot, 'content'), join(root, 'content'), { recursive: true });
  return root;
}

async function editResume(root: string, transform: (source: string) => string) {
  const file = join(root, 'content', 'resume.yaml');
  const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
  await writeFile(file, transform(source));
}

async function errors(root: string) {
  return validateContent(await loadContent(root));
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('content validation', () => {
  it.each([
    [
      'a missing required text field',
      (source: string) => source.replace('    position: Software Developer (AI & Backend)\n', ''),
      'work[0].position',
      'expected a non-empty string, received undefined',
    ],
    [
      'a wrong text type',
      (source: string) => source.replace('    position: Software Developer (AI & Backend)', '    position: 42'),
      'work[0].position',
      'expected a non-empty string, received number',
    ],
    [
      'a bad month',
      (source: string) => source.replace('    startDate: 2025-10', '    startDate: Oct 2025'),
      'work[0].startDate',
      'expected YYYY-MM (e.g. 2025-10), received "Oct 2025"',
    ],
  ])('reports %s with its expected message', async (_name, transform, path, message) => {
    const root = await fixtureRoot();
    await editResume(root, transform);
    expect(await errors(root)).toContainEqual(expect.objectContaining({ path, message }));
  });

  it('reports missing and unknown keys together', async () => {
    const root = await fixtureRoot();
    await editResume(root, (source) => source.replace(
      '    position: Software Developer (AI & Backend)',
      '    positon: Software Developer (AI & Backend)',
    ));
    expect(await errors(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'work[0].position',
        message: 'expected a non-empty string, received undefined',
      }),
      expect.objectContaining({
        path: 'work[0].positon',
        message: 'unknown key (allowed keys: slug, name, position, startDate, endDate, highlights; extension keys must start with "x-")',
      }),
    ]));
  });

  it.each([
    ['missing position', (source: string) => source.replace('    position: Software Developer (AI & Backend)\n', '')],
    ['missing label', (source: string) => source.replace('  label: Data Science & ML Engineer\n', '')],
    ['human date', (source: string) => source.replace('    startDate: 2025-10', '    startDate: Oct 2025')],
    ['unknown entry key', (source: string) => source.replace('    position: Software Developer', '    positon: Software Developer')],
    ['manual typo', (source: string) => source.replace('  name: Ahmed Moghazy', '  name: { value: Ahmed Moghazy, manul: true }')],
    ['end before start', (source: string) => source.replace('    endDate: 2025-04', '    endDate: 2024-09')],
  ])('reports %s with a located path', async (_name, transform) => {
    const root = await fixtureRoot();
    await editResume(root, transform);
    const result = await errors(root);
    expect(result.some((issue) => issue.severity === 'error')).toBe(true);
    const formatted = formatIssues(result);
    expect(formatted).toMatch(/✖ content\/resume\.yaml:\d+:\d+  \S+/);
  });

  it('reports duplicate project slugs and names both locations', async () => {
    const root = await fixtureRoot();
    await editResume(root, (source) => source.replace('  - slug: automl', '  - slug: news-aggregator'));
    expect(formatIssues(await errors(root))).toContain(
      'duplicate slug "news-aggregator" (also projects[0].slug)',
    );
  });

  it('reports an orphan write-up folder with known slugs', async () => {
    const root = await fixtureRoot();
    const folder = join(root, 'content', 'projects', 'orphan');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'README.md'), 'Body\n');
    const formatted = formatIssues(await errors(root));
    expect(formatted).toContain('folder "orphan" does not match any projects[].slug');
    expect(formatted).toContain('news-aggregator');
  });

  it('rejects title in write-up front matter', async () => {
    const root = await fixtureRoot();
    const folder = join(root, 'content', 'projects', 'automl');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'README.md'), '---\ntitle: Wrong\n---\nBody\n');
    expect(formatIssues(await errors(root))).toContain('title');
  });

  it('requires exactly one GitHub profile', async () => {
    const root = await fixtureRoot();
    await editResume(root, (source) => source.replace(
      /    - network: GitHub\n      url: https:\/\/github\.com\/moghazy17\n      username: moghazy17\n/,
      '',
    ));
    expect(formatIssues(await errors(root))).toContain('expected exactly one GitHub profile');
  });

  it('reports a missing site file', async () => {
    const root = await fixtureRoot();
    await rm(join(root, 'content', 'site.yaml'));
    expect(formatIssues(await errors(root))).toContain('content/site.yaml:1:1');
  });

  it('rejects an unknown site key', async () => {
    const root = await fixtureRoot();
    await writeFile(join(root, 'content', 'site.yaml'), `${await readFile(join(root, 'content', 'site.yaml'), 'utf8')}tagline: no\n`);
    expect(formatIssues(await errors(root))).toContain('tagline');
  });

  it('preserves write-up bodies verbatim and changes canonical content', async () => {
    const root = await fixtureRoot();
    const folder = join(root, 'content', 'projects', 'automl');
    await mkdir(folder, { recursive: true });
    const body = '# AutoML\n\nExact body.\n';
    await writeFile(join(folder, 'README.md'), `---\nfeatured: true\n---\n${body}`);
    const first = await loadContent(root);
    expect(first.content?.writeups.automl.body).toBe(body);
    const firstVersion = createHash('sha256').update(JSON.stringify(first.content)).digest('hex');
    await writeFile(join(folder, 'README.md'), `---\nfeatured: true\n---\n${body}Changed.\n`);
    const second = await loadContent(root);
    const secondVersion = createHash('sha256').update(JSON.stringify(second.content)).digest('hex');
    expect(secondVersion).not.toBe(firstVersion);
  });

  it('warns, but does not error, for two education entries', async () => {
    const root = await fixtureRoot();
    await editResume(root, (source) => source.replace('\nwork:\n', `\n${source.match(/education:\n([\s\S]*?)\nwork:/)![1]}\nwork:\n`));
    const result = await errors(root);
    expect(result.filter((issue) => issue.severity === 'warning')).toHaveLength(1);
    expect(result.filter((issue) => issue.severity === 'error')).toHaveLength(0);
  });

  it('allows projects without write-ups', async () => {
    const root = await fixtureRoot();
    expect(await errors(root)).toEqual([]);
  });

  it('validates a resume with CRLF line endings', async () => {
    const root = await fixtureRoot();
    const file = join(root, 'content', 'resume.yaml');
    const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
    await writeFile(file, source.replace(/\n/g, '\r\n'));
    expect(await errors(root)).toEqual([]);
  });
});
