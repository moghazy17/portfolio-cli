import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai';
import { createAssistantModel, createAssistantStream } from '@ahmed-moghazy/shared/assistant-server';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { getInventory } from '../../../lib/inventory-store';
import { redis } from '../../../lib/redis';
import { classifyError, logChatEvent } from '../../../lib/chat-log';

const ALLOWED_ORIGINS = [
  'https://moghazy.vercel.app',
  'https://moghazy.me',
  'https://www.moghazy.me',
  'http://localhost:3000',
];

const ERROR_MESSAGE = 'Something went wrong while answering — try again, or explore with `projects` and `experience`.';
const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(15, '10 m'), prefix: 'ratelimit:chat' })
  : null;

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { messages?: unknown; surface?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || !body.messages.length || (body.surface !== 'web' && body.surface !== 'ssh')) {
    return NextResponse.json({ error: 'Invalid messages or surface' }, { status: 400 });
  }
  if (!body.messages.every((message) => message && typeof message === 'object' &&
    (message.role === 'user' || message.role === 'assistant') && Array.isArray(message.parts))) {
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

  if (ratelimit) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    try {
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        await logChatEvent('rate_limited');
        return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
      }
    } catch (err) {
      console.error('Rate limiter unavailable, allowing request:', err);
    }
  }

  await logChatEvent('requests');
  const stream = createAssistantStream({
    messages,
    surface: body.surface,
    deps: { inventory: getInventory, origin: origin ?? '' },
    model: createAssistantModel(process.env, { onFallback: () => logChatEvent('fallback') }),
    signal: req.signal,
    onError: (error) => {
      const { kind, status, message } = classifyError(error);
      void logChatEvent(kind, { status, message });
      return kind === 'quota_exceeded'
        ? "The AI has hit its free usage limit for now. Try again later, or explore with commands like 'projects' and 'experience'."
        : ERROR_MESSAGE;
    },
  });
  return createUIMessageStreamResponse({ stream });
}
