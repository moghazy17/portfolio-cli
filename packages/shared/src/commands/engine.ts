import type { CommandResult } from '../types';
import { commandRegistry } from './registry';
import { placeholderFs } from '../vfs/placeholder';

export async function executeCommand(input: string): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { output: [] };
  }

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = commandRegistry.find(
    (c) => c.name === cmdName || c.aliases.includes(cmdName),
  );

  if (!command) {
    return {
      output: [
        {
          type: 'text',
          content: `Command not found: "${cmdName}". Type "help" for available commands.`,
          style: { color: 'error' },
        },
      ],
    };
  }

  return command.execute({
    args,
    flags: {},
    argv: args,
    session: { cwd: '/', lastStatus: 'ok' },
    surface: 'web',
    origin: '',
    signal: new AbortController().signal,
    fs: placeholderFs,
  });
}

export function getCompletions(partial: string): string[] {
  const lower = partial.toLowerCase();
  const all: string[] = [];
  for (const cmd of commandRegistry) {
    all.push(cmd.name, ...cmd.aliases);
  }
  if (!lower) return all;
  return all.filter((name) => name.startsWith(lower));
}

export function getMenuItems(): Array<{ label: string; value: string }> {
  return commandRegistry
    .filter((c) => c.menu && !c.hidden)
    .map((c) => ({
      label: `${c.name.padEnd(16)} ${c.description}`,
      value: c.name,
    }));
}
