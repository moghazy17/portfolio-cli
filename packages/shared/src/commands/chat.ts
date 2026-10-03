import type { CommandContext, CommandResult } from '../types';

/** `chat`, `ask` and `ai` are shortcuts: questions go to the assistant straight from the prompt. */
export function chatCommand(ctx: CommandContext): CommandResult {
  const question = ctx.args.join(' ').trim();
  if (question) return { output: [], ask: { question } };
  return {
    output: [
      { type: 'text', content: 'No chat mode needed: type your question right at the prompt.', style: { bold: true } },
      { type: 'text', content: 'For example: What RAG work has he done?', style: { dim: true } },
    ],
  };
}
