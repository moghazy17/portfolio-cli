import type { CommandResult } from '../types';

export function chatCommand(): CommandResult {
  return {
    output: [
      {
        type: 'text',
        content: "Entering AI chat mode — ask me anything about Ahmed!",
        style: { color: 'primary', bold: true },
      },
      {
        type: 'text',
        content: 'Type "exit" to return to command mode.',
        style: { dim: true },
      },
    ],
    mode: 'chat',
  };
}
