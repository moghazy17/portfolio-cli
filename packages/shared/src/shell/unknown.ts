import type { UnknownCommandHandler } from '../types';

export const defaultUnknownCommandHandler: UnknownCommandHandler = ({ word, suggestion }, ctx) => ({
  output: [
    { type: 'error', content: `command not found: ${word}` },
    ...(suggestion ? [{ type: 'text' as const, content: `did you mean \`${suggestion}\`?` }] : []),
    {
      type: 'text',
      content: ctx.surface === 'curl'
        ? `Type \`help\` for commands, or open ${ctx.origin || 'the website'} to ask the AI.`
        : 'Type `help` for commands or `chat` to ask the AI.',
      style: { dim: true },
    },
  ],
  status: 'error',
});
