import { redactSecrets } from '../sanitize';
import { MAX_QUESTION_LENGTH } from '../handler';
import type { AssistantEvent, AssistantSurface, NoticeKind } from '../types';

export type QuestionOutcome = 'answered' | 'refused' | 'no_evidence' | 'error' | 'limited';

export interface QuestionLogEntry {
  at: string;
  question: string;
  outcome: QuestionOutcome;
  sources: { commands: string[]; evidence: string[] };
  surface: AssistantSurface;
}

export interface OutcomeFacts {
  /** The notice sent in place of, or ahead of, the answer, if any. */
  notice: NoticeKind | undefined;
  /** The model or a tool failed. */
  error: boolean;
  /** Every tool call in order; `citable` is whether it produced something a source line can cite. */
  toolCalls: { name: string; citable: boolean }[];
}


/** The first matching rule wins: limited, error, refused, no_evidence, answered. */
export function classifyOutcome({ notice, error, toolCalls }: OutcomeFacts): QuestionOutcome {
  if (notice === 'limited' || notice === 'daily-cap') return 'limited';
  if (error || notice === 'unavailable' || notice === 'error') return 'error';
  if (toolCalls.some((call) => call.name === 'decline')) return 'refused';
  const lookedUp = toolCalls.some((call) => call.name === 'lookup_tech');
  if (lookedUp && !toolCalls.some((call) => call.citable)) return 'no_evidence';
  return 'answered';
}

/** One anonymous log line: nothing here identifies the visitor. */
export function buildLogEntry(input: {
  question: string;
  outcome: QuestionOutcome;
  sources: Pick<Extract<AssistantEvent, { type: 'sources' }>, 'commands' | 'evidence' | 'repos'>;
  surface: AssistantSurface;
  at: Date;
}): QuestionLogEntry {
  return {
    at: input.at.toISOString(),
    question: redactSecrets(input.question.trim()).slice(0, MAX_QUESTION_LENGTH),
    outcome: input.outcome,
    sources: {
      commands: [...input.sources.commands],
      evidence: input.sources.evidence.map(({ repo, file }) => `${repo}/${file}`),
    },
    surface: input.surface,
  };
}
