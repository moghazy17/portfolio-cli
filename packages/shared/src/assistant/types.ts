import type { CommandOutput } from '../types';

export type AssistantSurface = 'web' | 'ssh';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export type NoticeKind = 'limited' | 'daily-cap' | 'unavailable' | 'stale' | 'too-long' | 'error';
export type DeclineCategory = 'off_topic' | 'personal' | 'instructions';

export type AssistantEvent =
  | { type: 'command'; id: string; commandLine: string; output: CommandOutput[]; status: 'ok' | 'error' }
  | { type: 'text'; delta: string }
  | { type: 'sources'; commands: string[]; evidence: { repo: string; file: string }[]; repos: string[] }
  | { type: 'notice'; kind: NoticeKind; message: string; retryAfterSec?: number }
  | { type: 'declined'; category: DeclineCategory }
  | { type: 'done' };
