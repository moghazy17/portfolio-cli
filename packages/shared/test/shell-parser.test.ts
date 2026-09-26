import { describe, expect, it } from 'vitest';
import { parseShell } from '../src/shell/parser';

const kind = (name: string) => ['grep', 'head', 'tail', 'wc', 'sort'].includes(name) ? 'filter' as const : 'command' as const;

describe('parseShell', () => {
  it.each([
    ['projects "rag pipeline"', [[['projects', 'rag pipeline']]]],
    ['skills | grep -i python | sort', [[['skills'], ['grep', '-i', 'python'], ['sort']]]],
    ['cd projects && ls', [[['cd', 'projects']], [['ls']]]],
    ['rm -rf /', [[['rm', '-rf', '/']]]],
  ])('parses %s', (input, expected) => {
    const parsed = parseShell(input, kind);
    expect('chain' in parsed && parsed.chain.pipelines.map((p) => p.stages.map((s) => [s.name, ...s.argv]))).toEqual(expected);
  });

  it.each([
    ['help |', "syntax error: missing command around '|'"],
    ['| help', "syntax error: missing command around '|'"],
    ['help | | sort', "syntax error: missing command around '|'"],
    ['help &&', "syntax error: missing command around '&&'"],
    ['&& help', "syntax error: missing command around '&&'"],
    ['grep x', 'grep: expects piped input'],
    ['projects | about', 'about: cannot receive piped input (try grep, head, tail, wc, sort)'],
    [`help | ${Array(8).fill('sort').join(' | ')}`, 'syntax error: too many pipeline stages (max 8)'],
    [`help ${'x'.repeat(1000)}`, 'error: input too long (max 1000 characters)'],
  ])('rejects %s', (input, message) => {
    expect(parseShell(input, kind)).toMatchObject({ error: { message } });
  });
});
