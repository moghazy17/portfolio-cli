import type { SequenceStep } from '../types';

export function bootSequence(): SequenceStep[] {
  return [
    '[ OK ] Mounting /content',
    '[ OK ] Loading resume.yaml',
    '[ OK ] Indexing projects',
    '[ OK ] Preparing commands',
    '[ OK ] Starting assistant',
    '[ OK ] Terminal ready',
    'Welcome.',
  ].map((content) => ({ delayMs: 330, output: [{ type: 'text', content }] }));
}
