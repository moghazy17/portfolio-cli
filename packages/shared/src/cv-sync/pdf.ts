import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { CvSyncError } from './error';

const execFileAsync = promisify(execFile);
const maxBytes = 10 * 1024 * 1024;

export function normalizeText(value: string): string {
  return value
    .replace(/([\p{L}\p{N}])-\s*\r?\n\s*([\p{L}\p{N}])/gu, '$1$2')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function readPdfText(path: string): Promise<string> {
  const file = await stat(path).catch((error: unknown) => {
    throw new CvSyncError('UNREADABLE', `could not open the PDF: ${String(error)}`);
  });
  if (file.size > maxBytes) {
    throw new CvSyncError('UNREADABLE', `too large: ${file.size} bytes (limit 10 MB)`);
  }

  let stdout: string;
  try {
    const result = await execFileAsync('pdftotext', ['-layout', path, '-'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (error) {
    throw new CvSyncError('UNREADABLE', `pdftotext failed: ${String(error)}`);
  }

  const pages = stdout.length === 0
    ? 0
    : stdout.split('\f').filter((page) => page.trim().length > 0).length;
  if (pages > 10) {
    throw new CvSyncError('UNREADABLE', `too large: ${pages} pages (limit 10)`);
  }
  const characterCount = stdout.replace(/\s/g, '').length;
  if (characterCount < 200) {
    throw new CvSyncError(
      'UNREADABLE',
      `image-only or empty PDF: ${characterCount} characters of text found`,
    );
  }
  return stdout;
}
