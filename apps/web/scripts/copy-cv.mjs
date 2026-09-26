import { access, copyFile, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(webRoot, '../../content/cv/latest.pdf');
const destination = resolve(webRoot, 'public/cv/latest.pdf');

try {
  await access(source, constants.R_OK);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
