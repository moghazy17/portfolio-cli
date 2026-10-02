import type { TourStep } from '../types';

export function tourSteps(): TourStep[] {
  return [
    { line: 'welcome', pauseMs: 12_000 },
    { line: 'skills', pauseMs: 14_000 },
    { line: 'What RAG work has he done?', pauseMs: 14_000 },
    { line: 'theme crt', pauseMs: 12_000, motion: true },
    { line: 'who', pauseMs: 0 },
  ];
}
