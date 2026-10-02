import type { Suggestion, Surface } from '../types';
import { commandRegistry } from '../commands/registry';

const QUESTION: Suggestion = { label: 'What RAG work has he done?', line: 'What RAG work has he done?', kind: 'question' };
const LABELS: Record<string, string> = { tour: 'take the tour', gui: 'regular page' };
const FIRST = ['projects', 'skills', 'tour', 'guestbook', 'gui'];
const DEFAULT = ['projects', 'skills', 'experience', 'guestbook', 'gui', 'tour', 'about', 'contact'];
const NEXT: Record<string, string[]> = {
  projects: ['skills', 'experience', 'github', 'guestbook', 'gui'],
  skills: ['projects', 'experience', 'certifications', 'guestbook', 'gui'],
  experience: ['projects', 'timeline', 'skills', 'contact', 'gui'],
  guestbook: ['projects', 'skills', 'contact', 'tour', 'gui'],
  tour: ['projects', 'skills', 'guestbook', 'contact', 'gui'],
  gui: ['projects', 'skills', 'guestbook', 'tour', 'contact'],
  about: ['experience', 'projects', 'skills', 'contact', 'gui'],
  contact: ['projects', 'experience', 'guestbook', 'skills', 'gui'],
};

export const PROMPT_EXAMPLES = [
  'try: projects', 'try: skills llm', 'ask: What RAG work has he done?',
  'try: neofetch', 'try: guestbook', 'try: tour',
];

export function suggestionsFor(context: { firstVisit: boolean; lastCommand?: string; surface: Surface }): Suggestion[] {
  const last = commandRegistry.find((item) => item.name === context.lastCommand || item.aliases.includes(context.lastCommand ?? ''))?.name;
  const candidates = context.firstVisit ? FIRST : [...(NEXT[last ?? ''] ?? []), ...DEFAULT];
  const commands: Suggestion[] = [];
  for (const name of candidates) {
    if (name === last || commands.some((item) => item.line === name)) continue;
    const definition = commandRegistry.find((item) => item.name === name);
    if (!definition || definition.hidden || (definition.surfaces && !definition.surfaces.includes(context.surface))) continue;
    commands.push({ label: LABELS[name] ?? name, line: name, kind: 'command' });
    if (commands.length === (context.surface === 'curl' ? 5 : 4)) break;
  }
  if (context.surface !== 'curl') commands.push(QUESTION);
  return commands;
}
