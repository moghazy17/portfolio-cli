import { spawnSync } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { CvSyncError } from '../src/cv-sync/error';
import { readPdfText } from '../src/cv-sync/pdf';

const fixtureDir = resolve(import.meta.dirname, 'fixtures', 'cv');
const hasPdftotext = spawnSync('pdftotext', ['-v'], { stdio: 'ignore' }).error === undefined;
const elevenPagePath = resolve(fixtureDir, 'eleven-pages.tmp.pdf');

describe.skipIf(!hasPdftotext)('PDF gate', () => {
  afterAll(async () => {
    await unlink(elevenPagePath).catch(() => undefined);
  });

  it.each(['corrupt.pdf', 'image-only.pdf'])('rejects %s as unreadable', async (file) => {
    await expect(readPdfText(resolve(fixtureDir, file))).rejects.toMatchObject({ code: 'UNREADABLE' });
  });

  it('rejects an eleven-page PDF as too large', async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const source = await readFile(resolve(fixtureDir, 'same-as-current.html'), 'utf8');
      const pageText = '<div style="page-break-after:always">Ahmed Moghazy '.concat('resume '.repeat(30), '</div>');
      await page.setContent(source.replace('{{RESUME}}', pageText.repeat(11)));
      const pdf = await page.pdf({ format: 'A4' });
      await writeFile(elevenPagePath, pdf);
    } finally {
      await browser.close();
    }
    await expect(readPdfText(elevenPagePath)).rejects.toEqual(
      expect.objectContaining<CvSyncError>({ code: 'UNREADABLE', message: expect.stringContaining('too large') }),
    );
  });

  it('reads a normal text CV', async () => {
    await expect(readPdfText(resolve(fixtureDir, 'same-as-current.pdf')))
      .resolves.toContain('Ahmed Moghazy');
  });
});
