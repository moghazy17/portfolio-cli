import type { CommandResult } from '../types';
import { commandRegistry } from './registry';
import { createShell, type Shell } from '../shell/shell';

let defaultShell: Shell | undefined;

function shell(): Shell {
  return defaultShell ??= createShell({ surface: 'web', origin: '' });
}

export async function executeCommand(input: string): Promise<CommandResult> {
  return shell().run(input);
}

export function getCompletions(partial: string): string[] {
  const lower = partial.toLowerCase();
  return commandRegistry
    .filter((cmd) => !cmd.hidden && cmd.kind !== 'filter' && cmd.name.startsWith(lower))
    .map((cmd) => cmd.name);
}

export function getMenuItems(): Array<{ label: string; value: string }> {
  return commandRegistry
    .filter((c) => c.menu && !c.hidden)
    .map((c) => ({
      label: `${c.name.padEnd(16)} ${c.description}`,
      value: c.name,
    }));
}
