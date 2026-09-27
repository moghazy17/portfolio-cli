import { describe, expect, it } from 'vitest';
import { tokenize } from '../src/shell/tokenizer';

describe('tokenize', () => {
  it('joins bare, quoted, and escaped pieces while keeping wildcards literal', () => {
    expect(tokenize('projects a"b c"d \'literal | $*?\' x\\ y "a\\\"b\\\\c\\q"')).toEqual({ tokens: [
      { type: 'WORD', value: 'projects', span: [0, 8] },
      { type: 'WORD', value: 'ab cd', span: [9, 16] },
      { type: 'WORD', value: 'literal | $*?', span: [17, 32] },
      { type: 'WORD', value: 'x y', span: [33, 37] },
      { type: 'WORD', value: 'a"b\\c\\q', span: [38, 49] },
    ] });
  });

  it('recognizes operators outside quotes', () => {
    expect(tokenize('help|grep "a|b" && projects')).toMatchObject({ tokens: [
      { type: 'WORD', value: 'help' }, { type: 'PIPE' },
      { type: 'WORD', value: 'grep' }, { type: 'WORD', value: 'a|b' },
      { type: 'AND' }, { type: 'WORD', value: 'projects' },
    ] });
  });

  it.each([
    ['help || about', "syntax error: '||' is not supported — use '&&' to run commands in sequence"],
    ['help ; about', "syntax error: ';' is not supported — use '&&' to run commands in sequence"],
    ['help > f', 'syntax error: redirection is not supported — the filesystem is read-only'],
    ['help >> f', 'syntax error: redirection is not supported — the filesystem is read-only'],
    ['help < f', 'syntax error: redirection is not supported — the filesystem is read-only'],
    ['help & ', 'syntax error: background jobs are not supported'],
    ['help `x`', 'syntax error: command substitution is not supported'],
    ['help $(x)', 'syntax error: command substitution is not supported'],
    ['projects "rag', 'syntax error: unterminated " quote'],
    ["projects 'rag", "syntax error: unterminated ' quote"],
  ])('rejects %s', (input, message) => {
    expect(tokenize(input)).toMatchObject({ error: { message } });
  });
});
