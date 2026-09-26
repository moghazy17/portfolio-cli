import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

const workflowsDir = resolve(import.meta.dirname, '..', '..', '..', '.github', 'workflows');

describe('GitHub workflows', () => {
  it('contains only valid YAML documents', async () => {
    const files = await readdir(workflowsDir);
    await Promise.all(files.map(async (file) => {
      const document = parseDocument(await readFile(resolve(workflowsDir, file), 'utf8'));
      expect(document.errors, file).toEqual([]);
    }));
  });
});
