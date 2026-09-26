import type { ResumeInput } from '../content/schema';

export type MatchConfidence = 'certain' | 'uncertain';

export interface ExtractedItem {
  _id?: string;
  value: string;
}

export interface ExtractedEntry {
  _id?: string;
  _match?: MatchConfidence;
  [key: string]: unknown;
}

export interface CvExtraction {
  basics: Record<string, unknown>;
  education: ExtractedEntry[];
  work: ExtractedEntry[];
  projects: ExtractedEntry[];
  certificates: ExtractedEntry[];
  skills: ExtractedEntry[];
  unmapped: Array<{ heading: string; text: string }>;
}

export type Change =
  | { kind: 'added'; path: string; value: string }
  | { kind: 'updated'; path: string; from: string; to: string }
  | { kind: 'removed'; path: string; value: string }
  | { kind: 'kept-not-in-cv'; path: string; label: string }
  | { kind: 'possible-rename'; path: string; cvLabel: string; resumeLabel: string }
  | { kind: 'protected-unmatched'; path: string; value: string }
  | { kind: 'not-mapped'; heading: string; text: string }
  | { kind: 'not-grounded'; path: string; value: string }
  | { kind: 'new-project-review'; path: string; label: string }
  | { kind: 'warning'; path: string; message: string };

export interface ChangeOperation {
  type: 'set' | 'add' | 'delete';
  path: Array<string | number>;
  value?: unknown;
}

export type AppliedChange = Change & {
  operation?: ChangeOperation;
  groundValues?: Array<{ path: string; value: string }>;
};

export type CvOutcome = 'changes' | 'pdf-only' | 'no-changes' | 'nothing';

export interface CvSyncResult {
  outcome: CvOutcome;
  changes: AppliedChange[];
  fileName?: string;
  sourcePath?: string;
  next?: ResumeInput;
  yaml?: string;
  title?: string;
  prBody?: string;
}
