import type { AssistantEvent } from './types';

type SourcesEvent = Pick<Extract<AssistantEvent, { type: 'sources' }>, 'commands' | 'evidence' | 'repos'>;

/** One dim line naming what an answer drew on, or an empty string when it drew on nothing. */
export function formatSourcesLine({ commands, evidence, repos }: SourcesEvent): string {
  const parts = [...new Set([...commands, ...evidence.map(({ repo, file }) => `${repo}/${file}`), ...repos])];
  return parts.length ? `sources: ${parts.join(' · ')}` : '';
}
