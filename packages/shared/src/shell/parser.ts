import { tokenize, type ParseError, type Token } from './tokenizer';

export interface Stage { name: string; argv: string[]; span: [number, number] }
export interface Pipeline { stages: Stage[] }
export interface Chain { pipelines: Pipeline[] }
export type KindResolver = (name: string) => 'command' | 'filter' | undefined;

function parseError(message: string, at: number, kind: ParseError['kind']): { error: ParseError } {
  return { error: { message, at, kind } };
}

function stage(words: Token[]): Stage {
  return { name: words[0].value.toLowerCase(), argv: words.slice(1).map((token) => token.value), span: [words[0].span[0], words[words.length - 1].span[1]] };
}

export function parseShell(line: string, resolveKind: KindResolver): { chain: Chain } | { error: ParseError } {
  if (line.length > 1000) return parseError('error: input too long (max 1000 characters)', 1000, 'unsupported-operator');
  const tokenized = tokenize(line);
  if ('error' in tokenized) return tokenized;
  const pipelines: Pipeline[] = [];
  let stages: Stage[] = [];
  let words: Token[] = [];
  let lastOperator: Token | undefined;

  function finishStage(): void {
    stages.push(stage(words));
    words = [];
  }

  for (const token of tokenized.tokens) {
    if (token.type === 'WORD') {
      words.push(token);
      continue;
    }
    if (!words.length) return parseError(`syntax error: missing command around '${token.value}'`, token.span[0], 'empty-stage');
    finishStage();
    lastOperator = token;
    if (token.type === 'AND') {
      pipelines.push({ stages });
      stages = [];
    }
  }
  if (!words.length && lastOperator) return parseError(`syntax error: missing command around '${lastOperator.value}'`, lastOperator.span[0], 'empty-stage');
  if (words.length) finishStage();
  if (stages.length) pipelines.push({ stages });
  for (const pipeline of pipelines) {
    if (pipeline.stages.length > 8) return parseError('syntax error: too many pipeline stages (max 8)', pipeline.stages[8].span[0], 'unsupported-operator');
    for (const [index, current] of pipeline.stages.entries()) {
      const kind = resolveKind(current.name);
      if (index === 0 && kind === 'filter') return parseError(`${current.name}: expects piped input`, current.span[0], 'filter-not-first');
      if (index > 0 && kind === 'command') return parseError(`${current.name}: cannot receive piped input (try grep, head, tail, wc, sort)`, current.span[0], 'not-a-filter');
    }
  }
  return { chain: { pipelines } };
}
