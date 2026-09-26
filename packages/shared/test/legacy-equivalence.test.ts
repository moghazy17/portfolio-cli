import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import legacyCVData from './fixtures/legacy-cvdata.json';
import legacyCommands from './fixtures/legacy-command-output.json';
import { loadContent } from '../src/content/load';
import { toCVData } from '../src/content/view';
import { executeCommand } from '../src/commands';

const repoRoot = resolve(import.meta.dirname, '../../..');

describe('legacy equivalence', () => {
  it('maps content to the byte-equivalent CVData view', async () => {
    const loaded = await loadContent(repoRoot);
    expect(loaded.content).toBeDefined();
    expect(toCVData(loaded.content!)).toEqual(legacyCVData);
  });

  it('preserves every captured command result', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    for (const [command, expected] of Object.entries(legacyCommands)) {
      expect(await executeCommand(command)).toEqual(expected);
    }
    vi.restoreAllMocks();
  });
});
