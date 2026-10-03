import { describe, expect, it } from 'vitest';
import { commandRegistry } from '../src/commands/registry';
import { helpUsage, parseArgs, renderSynopsis } from '../src/shell/args';

const command = (name: string) => commandRegistry.find((entry) => entry.name === name)!;

describe('argument parsing', () => {
  it.each([['-n', '3'], ['-n3'], ['--lines=3'], ['--lines', '3'], ['-3']])('accepts head line counts', (...argv) => {
    expect(parseArgs(command('head'), argv)).toEqual({ args: [], flags: { lines: '3' } });
  });

  it('supports groups and the terminator', () => {
    expect(parseArgs(command('grep'), ['-iv', '--', '-v'])).toEqual({ args: ['-v'], flags: { 'ignore-case': true, 'invert-match': true } });
  });

  it('reports unknown options and lets legacy commands receive all arguments', () => {
    expect(parseArgs(command('grep'), ['-z'])).toEqual({ error: "grep: unknown option '-z'" });
    expect(parseArgs(command('projects'), ['-x'])).toEqual({ args: ['-x'], flags: {} });
  });

  it('renders synopsis and help', () => {
    expect(renderSynopsis(command('grep'))).toBe('grep [-i] [-v] [-c] [-h] [-E] <pattern>');
    expect(renderSynopsis(command('head'))).toBe('head [-n N]');
    expect(renderSynopsis({ ...command('head'), name: 'ls', args: { flags: [], positional: [{ name: 'path', variadic: true }] } })).toBe('ls [path…]');
    expect(helpUsage(command('grep'))).toEqual([
      { type: 'text', content: 'usage: grep [-i] [-v] [-c] [-h] [-E] <pattern>' },
      { type: 'text', content: "See 'man grep' for details." },
    ]);
  });
});
