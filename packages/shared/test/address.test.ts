import { describe, expect, it } from 'vitest';
import { commandRegistry } from '../src/commands/registry';
import { tokenize } from '../src/shell/tokenizer';
import {
  isTextClient,
  MAX_LINK_LENGTH,
  parseAddress,
  routableCommandNames,
  toAddress,
  wantsColor,
} from '../src/surface/address';

describe('surface addresses', () => {
  it.each([
    ['/', { kind: 'root' }],
    ['/projects', { kind: 'command', line: 'projects', form: 'path' }],
    ['/Projects/', { kind: 'command', line: 'projects', form: 'path' }],
    ['/skills/llm', { kind: 'command', line: 'skills llm', form: 'path' }],
    ['/?cmd=projects%20%7C%20grep%20-i%20rag', { kind: 'command', line: 'projects | grep -i rag', form: 'query' }],
    ['/?cmd=what%20RAG%20work%3F', { kind: 'command', line: 'what RAG work?', form: 'query' }],
    [`/?cmd=${'x'.repeat(MAX_LINK_LENGTH + 1)}`, { kind: 'invalid', reason: 'too-long' }],
    ['/projects?cmd=skills', { kind: 'invalid', reason: 'ambiguous' }],
    ['/nonsense', { kind: 'not-command', line: 'nonsense' }],
    ['/projct', { kind: 'not-command', line: 'projct' }],
    ['/sudo/hire-me', { kind: 'not-command', line: 'sudo hire-me' }],
    ['/?cmd=sudo%20hire-me', { kind: 'command', line: 'sudo hire-me', form: 'query' }],
  ])('parses %s', (address, expected) => {
    const [pathname, search = ''] = address.split('?');
    expect(parseAddress(pathname, search ? `?${search}` : '')).toEqual(expected);
  });

  it('round-trips visible commands and compound command lines', () => {
    const lines = [
      ...commandRegistry
        .filter((command) => !command.hidden && command.kind !== 'filter')
        .flatMap((command) => [command.name, ...command.aliases]),
      'projects | grep -i rag',
      'skills "machine learning"',
      'cd /projects && ls',
      ...['ls', 'cat', 'tree'].flatMap((command) => ['.', '..', 'about.md', '/projects', '~'].map((arg) => `${command} ${arg}`)),
      ...Array.from({ length: 120 }, (_, index) => {
        const alphabet = 'abcXYZ09._~-/ $`|&;<>\\\'"';
        let state = index + 1;
        const arg = Array.from({ length: 1 + index % 12 }, () => {
          state = (state * 1664525 + 1013904223) >>> 0;
          return alphabet[state % alphabet.length];
        }).join('');
        return `cat "${arg.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
      }),
    ];

    for (const line of lines) {
      const address = toAddress(line);
      const url = new URL(address, 'https://example.test');
      const result = parseAddress(url.pathname, url.search);
      expect(result).toMatchObject({ kind: 'command' });
      if (result.kind === 'command') {
        const actual = tokenize(result.line);
        const expected = tokenize(line);
        expect('tokens' in actual && actual.tokens.map(({ type, value }) => ({ type, value }))).toEqual(
          'tokens' in expected && expected.tokens.map(({ type, value }) => ({ type, value })),
        );
      }
    }
  });

  it('accepts the maximum line length and rejects longer lines', () => {
    expect(parseAddress('/', `?cmd=${'x'.repeat(MAX_LINK_LENGTH)}`)).toEqual({
      kind: 'command',
      line: 'x'.repeat(MAX_LINK_LENGTH),
      form: 'query',
    });
    expect(parseAddress('/', `?cmd=${'x'.repeat(MAX_LINK_LENGTH + 1)}`)).toEqual({ kind: 'invalid', reason: 'too-long' });
  });

  it('rejects undecodable and control-character input while normalizing tabs', () => {
    expect(parseAddress('/%E0%A4%A', '')).toEqual({ kind: 'invalid', reason: 'undecodable' });
    expect(parseAddress('/', '?cmd=projects%0A')).toEqual({ kind: 'invalid', reason: 'control-chars' });
    for (const value of ['%7F', '%C2%80', '%C2%9B', '%C2%9F']) {
      expect(parseAddress('/', `?cmd=cat+${value}`)).toEqual({ kind: 'invalid', reason: 'control-chars' });
      expect(parseAddress(`/cat/${value}`, '')).toEqual({ kind: 'invalid', reason: 'control-chars' });
    }
    expect(parseAddress('/', '?cmd=skills%09llm')).toEqual({ kind: 'command', line: 'skills llm', form: 'query' });
  });

  it('normalizes path segments and reserves the path form for visible commands', () => {
    expect(parseAddress('//Projects///', '')).toEqual({ kind: 'command', line: 'projects', form: 'path' });
    expect(toAddress('grep x')).toBe('/?cmd=grep+x');
    expect(parseAddress('/grep', '')).toEqual({ kind: 'not-command', line: 'grep' });
    expect(toAddress('sudo hire-me')).toBe('/?cmd=sudo+hire-me');
    expect(toAddress('cat about.md')).toBe('/?cmd=cat+about.md');
    expect(toAddress('ls ..')).toBe('/?cmd=ls+..');
    expect(toAddress('cat .')).toBe('/?cmd=cat+.');
    expect(parseAddress('/whatever/else', '')).toEqual({ kind: 'not-command', line: 'whatever else' });
  });

  it('quotes path segments so each stays one argument', () => {
    for (const segment of ['$(x)', '`x`', 'a$b', 'a"b', "a'b", 'a\\b', 'a b', 'a|b', 'a&&b', 'a;b', 'a>b']) {
      const result = parseAddress(`/skills/${encodeURIComponent(segment)}`, '');
      expect(result).toMatchObject({ kind: 'command', form: 'path' });
      if (result.kind !== 'command') continue;
      const tokenized = tokenize(result.line);
      expect('tokens' in tokenized && tokenized.tokens.map((token) => token.value)).toEqual(['skills', segment]);
    }
  });

  it('detects text clients', () => {
    for (const userAgent of ['curl/8.7.1', 'Wget/1.21', 'HTTPie/3.2.2', 'xh/0.22']) {
      expect(isTextClient(userAgent)).toBe(true);
    }
    for (const userAgent of ['Chrome/1', 'Safari/1', 'Firefox/1', 'Slackbot-LinkExpanding', '', null]) {
      expect(isTextClient(userAgent)).toBe(false);
    }
  });

  it('honors no-color query parameters', () => {
    for (const search of ['?nocolor', '?nocolor=1', '?no_color', '?cmd=x&nocolor']) {
      expect(wantsColor(search)).toBe(false);
    }
    expect(wantsColor('?cmd=x')).toBe(true);
  });

  it('exposes only visible non-filter command names', () => {
    expect(routableCommandNames).toContain('projects');
    expect(routableCommandNames).toContain('proj');
    expect(routableCommandNames).not.toContain('sudo');
    expect(routableCommandNames).not.toContain('grep');
  });
});
