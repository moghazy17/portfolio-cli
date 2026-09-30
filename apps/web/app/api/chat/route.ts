import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai';
import { buildLogEntry, classifyOutcome, createAssistantModel, createAssistantStream, resolveVisitorIp } from '@ahmed-moghazy/shared/assistant-server';
import { NextResponse } from 'next/server';
import { getInventory } from '../../../lib/inventory-store';
import { classifyError, logChatEvent } from '../../../lib/chat-log';
import { checkAssistantLimits } from '../../../lib/assistant-limits';
import { logQuestion } from '../../../lib/question-log';
import { createLiveGitHub } from '../../../lib/github-live';

const ALLOWED_ORIGINS = [
  'https://moghazy.vercel.app',
  'https://moghazy.me',
  'https://www.moghazy.me',
  'http://localhost:3000',
];

// Ten short turns plus a question fit easily; anything larger is not a real conversation.
const MAX_BODY_CHARS = 64 * 1024;
const ERROR_MESSAGE = 'Something went wrong while answering — try again, or explore with `projects` and `experience`.';

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { messages?: unknown; surface?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  if (!Array.isArray(body.messages) || !body.messages.length || (body.surface !== 'web' && body.surface !== 'ssh')) {
    return NextResponse.json({ error: 'Invalid messages or surface' }, { status: 400 });
  }
  if (!body.messages.every((message) => message && typeof message === 'object' &&
    (message.role === 'user' || message.role === 'assistant') && Array.isArray(message.parts) &&
    message.parts.every((part: unknown) => part && typeof part === 'object' &&
      (!('type' in part) || part.type !== 'text' || ('text' in part && typeof part.text === 'string'))))) {
    return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
  }
  const messages = body.messages as UIMessage[];
  const last = messages.at(-1);
  if (last?.role !== 'user' || !Array.isArray(last.parts)) {
    return NextResponse.json({ error: 'Last message must be a user message' }, { status: 400 });
  }
  const question = last.parts.filter((part) => part.type === 'text').map((part) => part.text).join('').trim();
  if (!question) {
    return NextResponse.json({ error: 'Empty question' }, { status: 400 });
  }
  if (question.length > 500) {
    const stream = createUIMessageStream({ execute: ({ writer }) => writer.write({ type: 'data-notice', data: { kind: 'too-long', message: 'Question too long (max 500 characters).' } }) });
    return createUIMessageStreamResponse({ stream });
  }

  const ip = resolveVisitorIp(req.headers, process.env.ASSISTANT_RELAY_TOKEN);
  const limit = await checkAssistantLimits(ip);
  if (!limit.ok) {
    const notice = limit.notice;
    await logQuestion(buildLogEntry({ question, outcome: classifyOutcome({ notice: notice.kind, error: false, toolCalls: [] }),
      sources: { commands: [], evidence: [], repos: [] }, surface: body.surface, at: new Date() }));
    await logChatEvent(notice.kind === 'daily-cap' ? 'daily_cap' : 'rate_limited');
    const stream = createUIMessageStream({ execute: ({ writer }) => writer.write({ type: 'data-notice', data: notice }) });
    return createUIMessageStreamResponse({ stream });
  }

  await logChatEvent('requests');
  const stream = createAssistantStream({
    messages,
    surface: body.surface,
    deps: { inventory: getInventory, live: createLiveGitHub(), origin: origin ?? '' },
    model: createAssistantModel(process.env, { onFallback: () => logChatEvent('fallback') }),
    signal: req.signal,
    onError: (error) => {
      const { kind, status, message } = classifyError(error);
      void logChatEvent(kind, { status, message });
      return kind === 'quota_exceeded'
        ? "The AI has hit its free usage limit for now. Try again later, or explore with commands like 'projects' and 'experience'."
        : ERROR_MESSAGE;
    },
    onFinish: async (result) => {
      const outcome = classifyOutcome({ notice: result.notice, error: result.error, toolCalls: result.toolCalls });
      await logQuestion(buildLogEntry({ question, outcome, sources: result.sources, surface: body.surface as 'web' | 'ssh', at: new Date() }));
      if (outcome === 'refused') await logChatEvent('refused');
    },
  });
  return createUIMessageStreamResponse({ stream });
}
