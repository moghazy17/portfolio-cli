import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import type { CommandContext } from '../src/types';
import { buildFileSystem } from '../src/vfs';
import { resumeCommand } from '../src/commands/resume';
import { createShell } from '../src/shell/shell';
import { renderAnsi } from '../src/render';

const origin = 'https://example.test';

function context(data = content): CommandContext {
  return {
    args: [], flags: {}, argv: [], session: { cwd: '/', lastStatus: 'ok' }, surface: 'web', origin,
    signal: new AbortController().signal, fs: buildFileSystem(data),
  };
}

describe('resume command', () => {
  it('returns a web download whose name is derived from the resume basics', async () => {
    const result = await createShell({ surface: 'web', origin }).run('resume');
    const filename = `${content.resume.basics.name.trim().split(/\s+/).join('-')}-CV.pdf`;
    expect(result.download).toEqual({ url: content.cv.path, filename });
    expect(result.output).toContainEqual({ type: 'text', content: 'Downloading resume…', style: { color: 'success' } });
    expect(result.output).toContainEqual({ type: 'link', text: filename, url: content.cv.path });
  });

  it('prints an absolute PDF address on text surfaces without a download effect', async () => {
    for (const surface of ['curl', 'ssh'] as const) {
      const result = await createShell({ surface, origin }).run('resume');
      const address = new URL(content.cv.path, origin).href;
      expect(result.download).toBeUndefined();
      expect(result.output).toEqual([{ type: 'text', content: `Resume (PDF): ${address}` }]);
      expect(renderAnsi(result.output, { color: false })).toBe(`Resume (PDF): ${address}\n`);
    }
  });

  it('reports an unavailable CV from supplied content', () => {
    const data = structuredClone(content);
    data.cv.available = false;
    expect(resumeCommand(context(data), data)).toEqual({
      status: 'error', output: [{ type: 'error', content: 'resume: CV not published yet' }],
    });
  });

  it('supports the cv alias', async () => {
    const sh = createShell({ surface: 'web', origin });
    expect((await sh.run('cv')).output).toEqual((await sh.run('resume')).output);
  });
});
