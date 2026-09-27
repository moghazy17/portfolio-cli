import { describe, expect, it } from 'vitest';
import { commandRegistry } from '../src/commands/registry';
import { rmCommand } from '../src/commands/easter-eggs';
import { createShell } from '../src/shell/shell';
import { toLines } from '../src/shell/lines';
import { suggestCommand } from '../src/shell/suggest';

describe('read-only commands', () => {
  it('rejects write attempts', async () => {
    const sh = createShell({ surface: 'web', origin: '' });
    for (const command of ['mkdir x', 'touch x', 'mv a b', 'cp a b', 'rmdir x', 'nano x', 'vim x', 'vi x', 'chmod x', 'rm about.md']) {
      const name = command.split(' ')[0];
      const result = await sh.run(command);
      expect(result.status).toBe('error');
      expect(toLines(result.output).map((line) => line.text)).toEqual([`${name}: read-only file system — this portfolio is look-but-don't-touch 🙂`]);
    }
  });

  it('preserves legacy rm forms and hides write commands', async () => {
    const sh = createShell({ surface: 'web', origin: '' });
    for (const command of ['rm', 'rm -rf /', 'rm -fr /', 'rm -Rf /*', 'rm -rf ~']) {
      expect((await sh.run(command)).output).toEqual(rmCommand().output);
    }
    const hidden = ['mkdir', 'touch', 'mv', 'cp', 'rmdir', 'nano', 'vim', 'vi', 'chmod', 'rm'];
    const help = toLines((await sh.run('help')).output).map((line) => line.text).join('\n');
    for (const name of hidden) {
      expect(commandRegistry.find((def) => def.name === name)?.hidden).toBe(true);
      expect(sh.complete(name).candidates).not.toContain(name);
      expect(suggestCommand(`${name}x`, commandRegistry)).not.toBe(name);
      expect(help).not.toMatch(new RegExp(`^${name}\\b`, 'm'));
    }
  });
});
