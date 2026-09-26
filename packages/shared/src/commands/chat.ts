import type { CommandResult } from '../types';
import { profile } from '../content';

export function chatCommand(): CommandResult {
  return {
    output: [
      {
        type: 'text',
        content: `Entering AI chat mode — ask me anything about ${profile.firstName}!`,
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
