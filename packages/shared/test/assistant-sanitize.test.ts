import { describe, expect, it } from 'vitest';
import { createStreamingRedactor, redactSecrets, sanitizeAssistantText } from '../src/assistant/sanitize';

const secrets = [
  ...['p', 'o', 'u', 's', 'r'].map((kind) => `gh${kind}_${'a'.repeat(36)}`),
  `github_pat_${'a'.repeat(82)}`, `sk-proj-${'b'.repeat(100)}`,
  `AKIA${'A'.repeat(16)}`, 'xoxb-123456789-abcdefghijk', 'xoxc-123456789-abcdefghijk',
  `-----BEGIN PRIVATE KEY-----\n${'a'.repeat(120)}\n-----END PRIVATE KEY-----`,
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.abcdefghijklmnop',
  'password = abcdefghijkl', 'secret: abcdefghijkl', 'token=abcdefghijkl',
];

describe('assistant text sanitization', () => {
  it.each(secrets)('redacts %s', (secret) => {
    expect(redactSecrets(`before ${secret} after`)).toBe('before [redacted] after');
  });

  it('leaves normal prose, URLs and versions unchanged', () => {
    const text = 'A secret is private. Use https://example.com/docs?v=1.2.3 and version 3.0.129. A token = short. '
      + 'Flags like sk-v2 or ghp_x stay; scikit-learn stays.';
    expect(redactSecrets(text)).toBe(text);
  });

  it('removes markdown markers while preserving code contents and bullets', () => {
    expect(sanitizeAssistantText('# Heading\n## More\n**bold** in __init__.py\n```ts\nconst n = 1;\n```\n• item'))
      .toBe('Heading\nMore\nbold in __init__.py\nconst n = 1;\n• item');
  });

  it.each(secrets)('redacts across every delta boundary: %s', (secret) => {
    for (let split = 1; split < secret.length; split++) {
      const redactor = createStreamingRedactor();
      const result = redactor.push(`before ${secret.slice(0, split)}`)
        + redactor.push(`${secret.slice(split)} after ${'ordinary text '.repeat(10)}`)
        + redactor.flush();
      expect(result).toBe(`before [redacted] after ${'ordinary text '.repeat(10)}`);
      expect(redactor.flush()).toBe('');
    }
  });

  it('holds the last 64 characters and streams safe prose', () => {
    const redactor = createStreamingRedactor();
    expect(redactor.push('word '.repeat(20))).toBe('word '.repeat(7));
    expect(redactor.flush()).toBe('word '.repeat(13));
  });

  it('holds an assignment across a long gap before its value', () => {
    const redactor = createStreamingRedactor();
    const text = `token = ${' '.repeat(80)}abcdefghijk`;
    const result = redactor.push(text.slice(0, -11)) + redactor.push(text.slice(-11)) + redactor.flush();
    expect(result).toBe('[redacted]');
  });
});
