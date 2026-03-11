import { streamText, convertToModelMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { buildSystemPrompt, cvData } from '@ahmed-moghazy/shared';
import { getGitHubData } from '../../../lib/github-cache';

const ALLOWED_ORIGINS = [
  'https://moghazy.vercel.app',
  'https://moghazy.me',
  'https://www.moghazy.me',
  'http://localhost:3000',
];

const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES = 20;

const ratelimit = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Ratelimit({
      redis: new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }),
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

  // Rate limiting by IP
  if (ratelimit) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
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

  const githubData = await getGitHubData();

  const systemPrompt = buildSystemPrompt(
    cvData,
    githubData ?? undefined,
  );

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
