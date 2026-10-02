import type { TourStep } from '../types';

export function tourSteps(): TourStep[] {
  return [
    { line: 'about', pauseMs: 9_000 },
    { line: 'skills', pauseMs: 13_000 },
    { line: 'What RAG work has he done?', pauseMs: 13_000 },
    { line: 'theme crt', pauseMs: 10_000, motion: true },
    { line: 'who', pauseMs: 0 },
  ];
}
