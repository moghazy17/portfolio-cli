import { streamText, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { buildSystemPrompt, cvData } from '@ahmed-moghazy/shared';
import { getGitHubData } from '../../../lib/github-cache';
import { redis } from '../../../lib/redis';
import { classifyError, logChatEvent } from '../../../lib/chat-log';

const ALLOWED_ORIGINS = [
  'https://moghazy.vercel.app',
  'https://moghazy.me',
  'https://www.moghazy.me',
  'http://localhost:3000',
];

const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES = 20;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, '10 m'),
      prefix: 'ratelimit:chat',
    })
  : null;

export async function POST(req: Request) {
  // Origin check
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limiting by IP — fail open if Redis is unreachable so a cache
  // outage degrades gracefully instead of taking down chat entirely.
  if (ratelimit) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    try {
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        await logChatEvent('rate_limited');
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 },
        );
      }
    } catch (err) {
      console.error('Rate limiter unavailable, allowing request:', err);
    }
  }

  // Input validation
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
  }

  const messages = body.messages.slice(-MAX_MESSAGES);

  for (const msg of messages) {
    if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long. Max ${MAX_MESSAGE_LENGTH} characters.` },
        { status: 400 },
      );
    }
  }

  await logChatEvent('requests');

  const githubData = await getGitHubData();

  const systemPrompt = buildSystemPrompt(
    cvData,
    githubData ?? undefined,
  );

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai('gpt-6-luna'),
    system: systemPrompt,
    messages: modelMessages,
    onError: async ({ error }) => {
      const { kind, status, message } = classifyError(error);
      await logChatEvent(kind, { status, message });
    },
  });

  return result.toUIMessageStreamResponse({
    // Shown to the visitor; details stay in the server log
    onError: (error) =>
      classifyError(error).kind === 'quota_exceeded'
        ? "The AI has hit its free usage limit for now. Try again later, or explore with commands like 'projects' and 'experience'."
        : 'Something went wrong while generating a reply. Please try again.',
  });
}
