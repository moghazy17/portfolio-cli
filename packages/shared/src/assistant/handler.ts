import type { UnknownCommandHandler } from '../types';
import { defaultUnknownCommandHandler } from '../shell/unknown';

export const MAX_QUESTION_LENGTH = 500;

// Free text contains apostrophes, so the shell tokenizer would reject it. A quote only
// opens at the start of a word and only counts when it closes again; `what's` never
// hides a pipe, while `"a|b"` does.
function hasUnquotedPipe(raw: string): boolean {
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if ((char === '"' || char === "'") && (i === 0 || /\s/.test(raw[i - 1]))) {
      const close = raw.indexOf(char, i + 1);
      if (close > 0) {
        i = close;
        continue;
      }
    }
    if (char === '|') return true;
  }
  return false;
}

/** Routes unknown shell input to the assistant, or to the default not-found reply. */
export function createAssistantUnknownHandler(): UnknownCommandHandler {
  return (input, ctx) => {
    if (ctx.surface === 'curl') return defaultUnknownCommandHandler(input, ctx);
    if (/^\S+$/.test(input.raw.trim()) && input.suggestion) return defaultUnknownCommandHandler(input, ctx);
    if (hasUnquotedPipe(input.raw)) return defaultUnknownCommandHandler(input, ctx);
    const question = input.raw.trim();
    if (question.length > MAX_QUESTION_LENGTH) {
      return { output: [{ type: 'error', content: `question too long (max ${MAX_QUESTION_LENGTH} characters)` }], status: 'error' };
    }
    return { output: [], ask: { question } };
  };
}
