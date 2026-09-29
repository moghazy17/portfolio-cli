import type { CommandDefinition } from '../types';
import { parseShell } from '../shell/parser';

export const MAX_ASSISTANT_COMMAND_LENGTH = 200;
export const MAX_ASSISTANT_PIPELINE_STAGES = 4;

export type AssistantCommandValidation =
  | { ok: true }
  | { ok: false; reason: 'too-long' | 'syntax' | 'chain' | 'too-many-stages' | 'not-allowed'; detail: string };

function findCommand(registry: CommandDefinition[], name: string): CommandDefinition | undefined {
  return registry.find((def) => def.name === name || def.aliases.includes(name));
}

/** Checks that a command line is one short pipeline of commands the assistant may run. */
export function validateAssistantCommandLine(line: string, registry: CommandDefinition[]): AssistantCommandValidation {
  if (line.length > MAX_ASSISTANT_COMMAND_LENGTH) {
    return { ok: false, reason: 'too-long', detail: `command line too long (max ${MAX_ASSISTANT_COMMAND_LENGTH} characters)` };
  }
  const parsed = parseShell(line, (name) => {
    const def = findCommand(registry, name);
    return def ? def.kind || 'command' : undefined;
  });
  if ('error' in parsed) return { ok: false, reason: 'syntax', detail: parsed.error.message };
  const { pipelines } = parsed.chain;
  if (pipelines.length !== 1) {
    return { ok: false, reason: 'chain', detail: pipelines.length ? 'only a single pipeline is allowed' : 'empty command line' };
  }
  const { stages } = pipelines[0];
  if (stages.length > MAX_ASSISTANT_PIPELINE_STAGES) {
    return { ok: false, reason: 'too-many-stages', detail: `too many pipeline stages (max ${MAX_ASSISTANT_PIPELINE_STAGES})` };
  }
  for (const stage of stages) {
    const def = findCommand(registry, stage.name);
    if (!def || !def.assistant || def.hidden) {
      return { ok: false, reason: 'not-allowed', detail: `${stage.name}: not available to the assistant` };
    }
  }
  return { ok: true };
}
