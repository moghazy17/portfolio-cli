import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { parse } from 'yaml';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(packageRoot, '..', '..');
const fixtureDir = resolve(packageRoot, 'test', 'fixtures', 'cv');
const resume = parse(await readFile(resolve(repoRoot, 'content', 'resume.yaml'), 'utf8'));

function value(input: unknown) {
  if (typeof input === 'object' && input !== null && 'value' in input) {
    return String((input as { value: unknown }).value);
  }
  return String(input ?? '');
}

function escape(input: unknown) {
  return value(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function list(values: unknown[]) {
  return `<ul>${values.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`;
}

function dated(entry: Record<string, unknown>) {
  return [entry.startDate, entry.endDate ?? 'Present'].filter(Boolean).map(value).join(' to ');
}

function render(fixture: string) {
  const work = structuredClone(resume.work) as Record<string, unknown>[];
  const projects = (structuredClone(resume.projects) as Record<string, unknown>[])
    .filter((project) => fixture !== 'dropped-project' || project.slug !== 'star-schema');
  if (fixture === 'new-role') {
    work.push({
      name: 'Acme AI',
      position: 'ML Engineer',
      startDate: '2026-08',
      highlights: [
        'Built reliable machine learning services for production workloads.',
        'Improved model monitoring with automated drift detection.',
      ],
    });
  }
  if (fixture === 'new-layout') work[0].name = 'ACT';

  const basics = resume.basics;
  const profiles = basics.profiles.map((profile: Record<string, unknown>) => escape(profile.url)).join(' · ');
  const header = `<header><h1>${escape(basics.name)}</h1><p>${escape(basics.label)}</p><p>${escape(basics.email)} · ${escape(basics.phone)} · ${escape(basics.location.city)}, ${escape(basics.location.countryCode)}</p><p>${profiles}</p><p>${escape(basics.summary)}</p></header>`;
  const education = `<section><h2>Education</h2>${resume.education.map((entry: Record<string, unknown>) => `<h3>${escape(entry.institution)} — ${escape(entry.area)}, ${escape(entry.studyType)}</h3><p>${escape(entry.faculty)} · ${escape(entry.location)} · GPA ${escape(entry.score)} · ${dated(entry)}</p>${list(entry.courses as unknown[])}`).join('')}</section>`;
  const experience = `<section><h2>Experience</h2>${work.map((entry) => `<h3>${escape(entry.name)} — ${escape(entry.position)}</h3><p>${dated(entry)}</p>${list(entry.highlights as unknown[])}`).join('')}</section>`;
  const projectSection = `<section><h2>Projects</h2>${projects.map((entry) => `<h3>${escape(entry.name)} — ${escape(entry.stack)}</h3><p>${dated(entry)}</p>${list(entry.highlights as unknown[])}`).join('')}</section>`;
  const certificates = `<section><h2>Certifications</h2>${resume.certificates.map((entry: Record<string, unknown>) => `<h3>${escape(entry.name)} — ${escape(entry.issuer)}</h3><p>${dated(entry)}</p>${list(entry.highlights as unknown[])}`).join('')}</section>`;
  const skills = `<section><h2>Skills</h2>${resume.skills.map((entry: Record<string, unknown>) => `<h3>${escape(entry.name)}</h3><p>${(entry.keywords as unknown[]).map(escape).join(', ')}</p>`).join('')}</section>`;
  const languages = fixture === 'new-layout'
    ? '<section><h2>Languages</h2><p>Arabic, English</p></section>'
    : '';
  const sections = fixture === 'new-layout'
    ? `${skills}${experience}${projectSection}${education}${certificates}${languages}`
    : `${education}${experience}${projectSection}${certificates}${skills}`;
  return `${header}<main class="${fixture === 'new-layout' ? 'columns' : ''}">${sections}</main>`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
  for (const fixture of ['same-as-current', 'new-role', 'new-layout', 'dropped-project']) {
    const source = await readFile(resolve(fixtureDir, `${fixture}.html`), 'utf8');
    await page.setContent(source.replace('{{RESUME}}', render(fixture)), { waitUntil: 'load' });
    await page.pdf({
      path: resolve(fixtureDir, `${fixture}.pdf`),
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });
  }

  const sameSource = await readFile(resolve(fixtureDir, 'same-as-current.html'), 'utf8');
  await page.setContent(sameSource.replace('{{RESUME}}', render('same-as-current')));
  const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
  const image = screenshot.toString('base64');
  await page.setContent(`<html><body><img style="width:100%" src="data:image/png;base64,${image}"></body></html>`);
  await page.pdf({ path: resolve(fixtureDir, 'image-only.pdf'), format: 'A4' });

  const validPdf = await readFile(resolve(fixtureDir, 'same-as-current.pdf'));
  await writeFile(resolve(fixtureDir, 'corrupt.pdf'), validPdf.subarray(0, 300));
  await copyFile(resolve(repoRoot, 'Ahmed_Moghazy.pdf'), resolve(fixtureDir, 'real-cv.pdf'));
} finally {
  await browser.close();
}
