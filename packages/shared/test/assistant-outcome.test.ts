import { describe, expect, it } from 'vitest';
import { buildLogEntry, classifyOutcome } from '../src/assistant/server/outcome';

const none = { notice: undefined, error: false, toolCalls: [] };
const decline = [{ name: 'decline', citable: false }];

describe('classifyOutcome', () => {
  it('is answered by default', () => {
    expect(classifyOutcome(none)).toBe('answered');
    expect(classifyOutcome({ ...none, toolCalls: [{ name: 'lookup_tech', citable: true }] })).toBe('answered');
  });

  it('is limited when a limiter notice was sent', () => {
    expect(classifyOutcome({ ...none, notice: 'limited' })).toBe('limited');
    expect(classifyOutcome({ ...none, notice: 'daily-cap' })).toBe('limited');
  });

  it('is limited even when other signals are present', () => {
    expect(classifyOutcome({ notice: 'limited', error: true, toolCalls: decline })).toBe('limited');
  });

  it('is error when the model or a tool failed', () => {
    expect(classifyOutcome({ ...none, error: true })).toBe('error');
    expect(classifyOutcome({ notice: undefined, error: true, toolCalls: decline })).toBe('error');
  });

  it('treats an unavailable notice as an error', () => {
    expect(classifyOutcome({ ...none, notice: 'unavailable' })).toBe('error');
  });

  it('is refused when decline was called', () => {
    expect(classifyOutcome({ ...none, toolCalls: decline })).toBe('refused');
  });

  it('is no_evidence when lookup_tech found nothing and nothing else was citable', () => {
    const toolCalls = [{ name: 'lookup_tech', citable: false }];
    expect(classifyOutcome({ ...none, toolCalls })).toBe('no_evidence');
  });

  it('is answered when another tool produced citable output', () => {
    const toolCalls = [
      { name: 'lookup_tech', citable: false },
      { name: 'run_command', citable: true },
    ];
    expect(classifyOutcome({ ...none, toolCalls })).toBe('answered');
  });

  it('ignores stale notices', () => {
    expect(classifyOutcome({ ...none, notice: 'stale' })).toBe('answered');
  });
});

describe('buildLogEntry', () => {
  const at = new Date('2026-03-04T05:06:07.000Z');
  const empty = { commands: [], evidence: [], repos: [] };

  it('builds an entry with only the documented fields', () => {
    const entry = buildLogEntry({
      question: 'has he used Kafka?',
      outcome: 'answered',
      sources: { commands: ['skills'], evidence: [{ repo: 'demo', file: 'package.json' }], repos: ['demo'] },
      surface: 'web',
      at,
    });
    expect(entry).toEqual({
      at: '2026-03-04T05:06:07.000Z',
      question: 'has he used Kafka?',
      outcome: 'answered',
      sources: { commands: ['skills'], evidence: ['demo/package.json'] },
      surface: 'web',
    });
  });

  it('redacts secrets and caps the question at 500 characters', () => {
    const secret = `ghp_${'a'.repeat(36)}`;
    const entry = buildLogEntry({
      question: `${secret} ${'x'.repeat(600)}`,
      outcome: 'refused',
      sources: empty,
      surface: 'ssh',
      at,
    });
    expect(entry.question).not.toContain(secret);
    expect(entry.question).toContain('[redacted]');
    expect(entry.question.length).toBeLessThanOrEqual(500);
  });

  it('carries no identity fields', () => {
    const entry = buildLogEntry({ question: 'hi', outcome: 'limited', sources: empty, surface: 'web', at });
    expect(Object.keys(entry).sort()).toEqual(['at', 'outcome', 'question', 'sources', 'surface']);
  });
});
