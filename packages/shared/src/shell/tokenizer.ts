export type Token = { type: 'WORD' | 'PIPE' | 'AND'; value: string; span: [number, number] };

export type ParseError = {
  kind: 'unterminated-quote' | 'empty-stage' | 'unsupported-operator' | 'filter-not-first' | 'not-a-filter';
  message: string;
  at: number;
};

const sequenceError = "syntax error: ';' is not supported — use '&&' to run commands in sequence";
const unsupportedChain = "syntax error: '||' is not supported — use '&&' to run commands in sequence";
const redirectionError = 'syntax error: redirection is not supported — the filesystem is read-only';
const substitutionError = 'syntax error: command substitution is not supported';

function error(message: string, at: number, kind: ParseError['kind'] = 'unsupported-operator'): { error: ParseError } {
  return { error: { kind, message, at } };
}

export function tokenize(line: string): { tokens: Token[] } | { error: ParseError } {
  const tokens: Token[] = [];
  let index = 0;
  while (index < line.length) {
    if (line[index] === ' ' || line[index] === '\t') {
      index++;
      continue;
    }
    const start = index;
    const next = line.slice(index, index + 2);
    if (next === '||') return error(unsupportedChain, index);
    if (next === '&&') {
      tokens.push({ type: 'AND', value: '&&', span: [index, index + 2] });
      index += 2;
      continue;
    }
    if (line[index] === '|') {
      tokens.push({ type: 'PIPE', value: '|', span: [index, ++index] });
      continue;
    }
    if (line[index] === ';') return error(sequenceError, index);
    if ('<>'.includes(line[index])) return error(redirectionError, index);
    if (line[index] === '&') return error('syntax error: background jobs are not supported', index);
    if (line[index] === '`' || next === '$(') return error(substitutionError, index);

    let value = '';
    while (index < line.length) {
      const char = line[index];
      if (char === ' ' || char === '\t' || '|&;<>`'.includes(char) || line.slice(index, index + 2) === '$(') break;
      if (char === '\\') {
        if (index + 1 < line.length) value += line[++index];
        else value += '\\';
        index++;
        continue;
      }
      if (char === "'" || char === '"') {
        const quote = char;
        index++;
        let closed = false;
        while (index < line.length) {
          if (line[index] === quote) {
            closed = true;
            index++;
            break;
          }
          if (quote === '"' && line[index] === '\\' && index + 1 < line.length) {
            const escaped = line[++index];
            value += escaped === '"' || escaped === '\\' ? escaped : `\\${escaped}`;
            index++;
          } else {
            value += line[index++];
          }
        }
        if (!closed) return error(`syntax error: unterminated ${quote} quote`, start, 'unterminated-quote');
        continue;
      }
      value += char;
      index++;
    }
    tokens.push({ type: 'WORD', value, span: [start, index] });
  }
  return { tokens };
}
