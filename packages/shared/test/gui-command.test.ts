import { describe, expect, it } from 'vitest';
import { getMenuItems, toAddress } from '../src';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';

const origin = 'https://example.test';

const text = (output: Parameters<typeof toLines>[0]) => toLines(output).map((line) => line.text).join('\n');

describe('gui command', () => {
  it.each(['gui', 'startx'])('%s switches to the regular page on the web', async (command) => {
    const result = await createShell({ surface: 'web', origin }).run(command);
    expect(result.status).toBe('ok');
    expect(result.view).toBe('gui');
    expect(text(result.output)).toContain('Opening the regular page…');
  });

  it.each(['gui', 'startx'])('%s points curl at the page without a view effect', async (command) => {
    const result = await createShell({ surface: 'curl', origin }).run(command);
    expect(result.status).toBe('ok');
    expect(result.view).toBeUndefined();
    expect(text(result.output)).toBe(`Prefer a regular web page? Open ${origin}/`);
  });

  it('is listed in help, the menu and the manual page', async () => {
    const shell = createShell({ surface: 'web', origin });
    expect(text((await shell.run('help')).output)).toMatch(/^gui\s/m);
    expect(getMenuItems().map((item) => item.value)).toContain('gui');
    const man = text((await shell.run('man gui')).output);
    expect(man).toContain('startx');
    expect((await shell.run('man startx')).status).toBe('ok');
  });

  it('has a plain address', () => {
    expect(toAddress('gui')).toBe('/gui');
  });
});
