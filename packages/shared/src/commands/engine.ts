import type { CommandResult } from '../types';
import { commandRegistry } from './registry';
import { createShell, type Shell } from '../shell/shell';
import { MENU_GROUPS } from './groups';

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

export function getMenuGroups(): Array<{ heading: string; items: Array<{ label: string; value: string }> }> {
  const groups = MENU_GROUPS;
  const items = getMenuItems().filter((item, index, menu) => menu.findIndex((entry) => entry.value === item.value) === index);
  return groups.map(({ heading, names }) => ({
    heading,
    items: items.filter((item) => heading === 'Explore'
      ? !groups.slice(0, 2).some((group) => group.names.has(item.value))
      : names.has(item.value)),
  })).filter((group) => group.items.length > 0);
}
