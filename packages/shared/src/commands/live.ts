import type { CommandContext, CommandOutput, CommandResult, GuestbookEntry } from '../types';
import { validateGuestbookEntry } from '../guestbook/validate';
import { formatRelative } from '../guestbook/time';

export function guestbookEntryOutput(entry: GuestbookEntry, now = new Date()): CommandOutput[] {
  return [
    { type: 'text', content: `${entry.name} · ${formatRelative(entry.at, now)}`, style: { bold: true } },
    { type: 'text', content: entry.message },
  ];
}

export async function whoCommand(ctx: CommandContext): Promise<CommandResult> {
  try {
    if (!ctx.live) throw Error('No live service');
    const { total } = await ctx.live.presence(ctx.signal);
    return { output: [{ type: 'text', content: `${total} ${total === 1 ? 'person' : 'people'} exploring right now` }] };
  } catch {
    return { output: [{ type: 'text', content: 'Live count unavailable right now.', style: { dim: true } }] };
  }
}

export async function guestbookCommand(ctx: CommandContext): Promise<CommandResult> {
  try {
    if (!ctx.live) throw Error('No live service');
    const entries = (await ctx.live.guestbook(ctx.signal)).slice(0, 20);
    if (!entries.length) return { output: [{ type: 'text', content: 'No entries yet — be the first: sign "hello!" --name "you"' }] };
    return { output: [
      { type: 'text', content: 'Guestbook', style: { bold: true } },
      ...entries.flatMap((entry) => guestbookEntryOutput(entry)),
      { type: 'text', content: ctx.surface === 'curl'
        ? `Sign it in the web terminal: ${ctx.origin}`
        : 'Sign it: sign "your message" --name "your name"', style: { dim: true } },
    ] };
  } catch {
    return { output: [{ type: 'text', content: 'Guestbook unavailable right now.', style: { dim: true } }] };
  }
}

export function signCommand(ctx: CommandContext): CommandResult {
  const name = ctx.flags.name;
  if (typeof name !== 'string' || !name.trim()) return {
    status: 'error', output: [{ type: 'error', content: 'Please add your name: sign "…" --name "your name"' }],
  };
  const checked = validateGuestbookEntry({ name, message: ctx.args.join(' ') });
  if (!checked.ok) return { status: 'error', output: [{ type: 'error', content: checked.message }] };
  return { output: [{ type: 'text', content: "Checking you're human…", style: { dim: true } }], sign: { name: checked.name, message: checked.message } };
}
