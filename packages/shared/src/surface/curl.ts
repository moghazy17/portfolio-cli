import { ASCII_BANNER, WELCOME_SUBTITLE } from '../ascii';
import { cvData, slugify } from '../content';
import { renderAnsi } from '../render';
import { createShell, isKnownCommandLine } from '../shell';
import { createAssistantUnknownHandler } from '../assistant';
import type { CommandOutput } from '../types';
import type { GitHubStats } from '../github';
import type { AddressResult } from './address';

export interface TextRequest {
  address: AddressResult;
  color: boolean;
  origin: string;
  github?: (signal: AbortSignal) => Promise<GitHubStats>;
}

export interface TextResponse {
  status: 200 | 400 | 404;
  body: string;
}

function withTrailingNewline(body: string): string {
  return body.endsWith('\n') ? body : `${body}\n`;
}

function originUrl(origin: string): string {
  return origin || 'https://moghazy.me';
}

export function curlIndex(origin: string): CommandOutput[] {
  const host = originUrl(origin);
  const skill = slugify(cvData.skills[0]?.name ?? 'skills');
  const company = cvData.experience[0]?.shortName ?? 'company';
  return [
    { type: 'ascii', content: ASCII_BANNER, style: { color: 'primary' } },
    { type: 'text', content: WELCOME_SUBTITLE, style: { bold: true } },
    { type: 'divider' },
    {
      type: 'section',
      title: 'Try',
      children: [
        { type: 'text', content: `curl ${host}/about` },
        { type: 'text', content: `curl ${host}/projects` },
        { type: 'text', content: `curl ${host}/skills/${skill}` },
        { type: 'text', content: `curl ${host}/experience/${company}` },
        { type: 'text', content: `curl "${host}/?cmd=projects | grep -i rag"`, style: { dim: true } },
        { type: 'text', content: 'Quote spaces or encode them as %20.', style: { dim: true } },
        { type: 'text', content: `curl "${host}/projects?nocolor"` },
        { type: 'text', content: `alias portfolio='curl -s "${host}/?nocolor&cmd="'`, style: { dim: true } },
        { type: 'text', content: `Interactive terminal and AI assistant: ${host}` },
      ],
    },
  ];
}

export async function runTextRequest({ address, color, origin, github }: TextRequest): Promise<TextResponse> {
  if (address.kind === 'root') {
    return { status: 200, body: withTrailingNewline(renderAnsi(curlIndex(origin), { color })) };
  }
  if (address.kind === 'invalid') {
    const output: CommandOutput[] = [
      { type: 'error', content: `error: this link couldn't be used (${address.reason})` },
      { type: 'text', content: `try: curl ${originUrl(origin)}` },
    ];
    return { status: 404, body: withTrailingNewline(renderAnsi(output, { color })) };
  }

  const shell = createShell({ surface: 'curl', origin, onUnknownCommand: createAssistantUnknownHandler(), github });
  const result = await shell.run(address.line);
  const body = withTrailingNewline(renderAnsi(result.output, { color }));
  if (!isKnownCommandLine(address.line)) return { status: 404, body };
  return { status: result.status === 'error' ? 400 : 200, body };
}

export interface TextRateLimiter {
  limit(id: string): Promise<{ success: boolean; reset: number }>;
}

export async function rateLimitedResponse(
  limiter: TextRateLimiter | null,
  id: string,
  now = Date.now(),
): Promise<{ status: 429; retryAfter: number; body: string } | null> {
  if (!limiter) return null;
  try {
    const result = await limiter.limit(id);
    if (result.success) return null;
    const retryAfter = Math.max(1, Math.ceil((result.reset - now) / 1000));
    return {
      status: 429,
      retryAfter,
      body: `Slow down — 60 requests per minute. Try again in ${retryAfter}s.\n`,
    };
  } catch (error) {
    console.error('[curl] rate limiter unavailable, allowing request:', error);
    return null;
  }
}
