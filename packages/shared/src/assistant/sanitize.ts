const secretPattern = /-----BEGIN ([A-Z ]*KEY)-----[\s\S]*?-----END \1-----|\bgh[pousr]_[A-Za-z0-9_]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b|\bxox[a-z]-[A-Za-z0-9-]+|\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b(?:password|secret|token)\s*[:=]\s*\S{8,}/gi;

export function redactSecrets(text: string): string {
  return text.replace(secretPattern, '[redacted]');
}

export function sanitizeAssistantText(text: string): string {
  return text
    .replace(/^\s*```[^\r\n]*(?:\r?\n|$)/gm, '')
    .replace(/```/g, '')
    // `__` is left alone: it is far more often a name (`__init__.py`) than bold.
    .replace(/\*\*/g, '')
    .replace(/^ {0,3}#{1,6}\s+/gm, '');
}

export function createStreamingRedactor(): { push(delta: string): string; flush(): string } {
  let buffer = '';

  return {
    push(delta) {
      buffer += delta;
      let end = Math.max(0, buffer.length - 64);
      // Keep whole tokens and key blocks when they extend beyond the carry buffer.
      while (end > 0 && !/\s/.test(buffer[end - 1])) end--;
      for (const match of buffer.matchAll(secretPattern)) {
        if (match.index < end && match.index + match[0].length > end) end = match.index;
      }
      const assignment = /\b(?:password|secret|token)\s*[:=]\s*\S{0,7}$/i.exec(buffer);
      if (assignment?.index !== undefined) end = Math.min(end, assignment.index);
      const begin = buffer.lastIndexOf('-----BEGIN ');
      if (begin >= 0 && !/-----END [A-Z ]*KEY-----/i.test(buffer.slice(begin))) end = Math.min(end, begin);
      const result = redactSecrets(buffer.slice(0, end));
      buffer = buffer.slice(end);
      return result;
    },
    flush() {
      const result = redactSecrets(buffer);
      buffer = '';
      return result;
    },
  };
}
