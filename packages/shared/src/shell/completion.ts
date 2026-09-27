import type { CommandDefinition, CompletionSource } from '../types';
import { content } from '../content';
import { themes } from '../theme';
import { openTargets } from '../commands/utility';
import { tokenize } from './tokenizer';

export interface Completion {
  start: number;
  end: number;
  candidates: string[];
  replacement?: string;
}

function sourceValues(source: CompletionSource, registry: CommandDefinition[]): string[] {
  switch (source) {
    case 'projects': return content.resume.projects.map((item) => item.slug);
    case 'experience': return content.resume.work.map((item) => item.slug);
    case 'skills': return content.resume.skills.map((item) => item.name);
    case 'themes': return Object.keys(themes);
    case 'open-targets': return Object.keys(openTargets);
    case 'commands': return registry.filter((def) => !def.hidden).map((def) => def.name);
    case 'path':
    case 'dir': return [];
  }
}

interface Position { words: string[]; current: string; start: number; afterPipe: boolean }

function scanFallback(line: string): Position {
  let words: string[] = [];
  let current = '';
  let start = -1;
  let quote: string | undefined;
  let afterPipe = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '\\' && index + 1 < line.length) {
      if (start < 0) start = index;
      current += line[++index];
      continue;
    }
    if (quote) {
      if (char === quote) quote = undefined;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      if (start < 0) start = index;
      quote = char;
      continue;
    }
    if (char === ' ' || char === '\t' || char === '|' || (char === '&' && line[index + 1] === '&')) {
      if (start >= 0) {
        words.push(current);
        current = '';
        start = -1;
      }
      if (char === '|' || char === '&') {
        words = [];
        afterPipe = char === '|';
        if (char === '&') index++;
      }
      continue;
    }
    if (start < 0) start = index;
    current += char;
  }
  return { words, current, start: start < 0 ? line.length : start, afterPipe };
}

function position(line: string): Position {
  const result = tokenize(line);
  if ('error' in result) return scanFallback(line);
  let operator = result.tokens.length - 1;
  while (operator >= 0 && result.tokens[operator].type === 'WORD') operator--;
  const stage = result.tokens.slice(operator + 1);
  const last = stage.at(-1);
  const typing = last?.type === 'WORD' && last.span[1] === line.length;
  return {
    words: stage.slice(0, typing ? -1 : undefined).map((token) => token.value),
    current: typing ? last.value : '',
    start: typing ? last.span[0] : line.length,
    afterPipe: operator >= 0 && result.tokens[operator].type === 'PIPE',
  };
}

function longestPrefix(candidates: string[]): string {
  let prefix = candidates[0];
  for (const candidate of candidates.slice(1)) {
    let length = 0;
    while (length < prefix.length && length < candidate.length && prefix[length].toLowerCase() === candidate[length].toLowerCase()) length++;
    prefix = prefix.slice(0, length);
  }
  return prefix;
}

export function complete(line: string, cursor: number, registry: CommandDefinition[]): Completion {
  const end = Math.max(0, Math.min(cursor, line.length));
  const { words, current, start, afterPipe } = position(line.slice(0, end));
  const prefix = current.toLowerCase();
  let values: string[] = [];
  if (!words.length) {
    values = registry.filter((def) => !def.hidden && (afterPipe ? def.kind === 'filter' : def.kind !== 'filter'))
      .filter((def) => [def.name, ...def.aliases].some((name) => name.toLowerCase().startsWith(prefix)))
      .map((def) => def.name);
  } else {
    const def = registry.find((item) => item.name === words[0].toLowerCase() || item.aliases.includes(words[0].toLowerCase()));
    const positionals = def?.args?.positional || [];
    const index = words.length - 1;
    const spec = positionals[index] || (positionals.at(-1)?.variadic ? positionals.at(-1) : undefined);
    values = spec?.complete ? sourceValues(spec.complete, registry).filter((value) => value.toLowerCase().startsWith(prefix)) : [];
  }
  const candidates = [...new Set(values)];
  const quoted = line[start] === '"' || line[start] === "'";
  const wrap = (value: string) => value.includes(' ') || quoted ? `"${value}"` : value;
  let replacement: string | undefined;
  if (candidates.length === 1) replacement = `${wrap(candidates[0])} `;
  else if (candidates.length > 1) {
    const common = longestPrefix(candidates);
    if (common.length > current.length) replacement = wrap(common);
  }
  return { start, end, candidates, ...(replacement !== undefined && { replacement }) };
}
