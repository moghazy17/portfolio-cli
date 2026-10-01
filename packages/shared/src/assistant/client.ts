import { DefaultChatTransport, type UIMessage, type UIMessageChunk } from 'ai';
import type { CommandOutput } from '../types';
import { createStreamingRedactor, sanitizeAssistantText } from './sanitize';
import type { AssistantEvent, AssistantSurface, AssistantTurn, DeclineCategory, NoticeKind } from './types';

export interface AskAssistantOptions {
  endpoint: string;
  question: string;
  history: AssistantTurn[];
  surface: AssistantSurface;
  signal: AbortSignal;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export const MAX_HISTORY_TURNS = 10;
export const ASSISTANT_ERROR_MESSAGE = 'Something went wrong while answering — try again, or explore with `projects` and `experience`.';

const noticeKinds: readonly NoticeKind[] = ['limited', 'daily-cap', 'unavailable', 'stale', 'too-long', 'error'];
const declineCategories: readonly DeclineCategory[] = ['off_topic', 'personal', 'instructions'];

/**
 * The history a client sends: the last messages as text only. Command output and other
 * data parts are for rendering, and the server ignores them, so they never go on the wire.
 */
export function toRequestMessages<M extends UIMessage>(messages: M[], limit = MAX_HISTORY_TURNS): UIMessage[] {
  return messages.slice(-limit).map(({ id, role, parts }) => {
    // A refusal stands alone: text written before the decline marker is not part of it.
    const declinedAt = parts.findIndex((part) => part.type === 'data-decline');
    return {
      id, role, parts: parts.flatMap((part, index) => (
        part.type === 'text' && index > declinedAt ? [{ type: 'text' as const, text: part.text }] : []
      )),
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function toMessage(turn: AssistantTurn | { role: 'user'; text: string }, index: number): UIMessage {
  return { id: `m${index}`, role: turn.role, parts: [{ type: 'text', text: turn.text }] };
}

/** Maps one streamed data part to a host event. Anything malformed or unrecognised yields undefined. */
export function parseAssistantDataPart(type: string, data: unknown): AssistantEvent | undefined {
  if (!isRecord(data)) return undefined;
  if (type === 'data-command') {
    if (typeof data.commandLine !== 'string' || !Array.isArray(data.output)) return undefined;
    return {
      type: 'command',
      id: typeof data.id === 'string' ? data.id : data.commandLine,
      commandLine: data.commandLine,
      output: data.output as CommandOutput[],
      status: data.status === 'error' ? 'error' : 'ok',
    };
  }
  if (type === 'data-sources') {
    const evidence = Array.isArray(data.evidence)
      ? data.evidence.flatMap((item) => (isRecord(item) && typeof item.repo === 'string' && typeof item.file === 'string' ? [{ repo: item.repo, file: item.file }] : []))
      : [];
    return {
      type: 'sources',
      commands: isStringArray(data.commands) ? data.commands : [],
      evidence,
      repos: isStringArray(data.repos) ? data.repos : [],
    };
  }
  if (type === 'data-notice') {
    if (!noticeKinds.includes(data.kind as NoticeKind) || typeof data.message !== 'string') return undefined;
    return {
      type: 'notice',
      kind: data.kind as NoticeKind,
      message: data.message,
      ...(typeof data.retryAfterSec === 'number' && { retryAfterSec: data.retryAfterSec }),
    };
  }
  if (type === 'data-decline') {
    return declineCategories.includes(data.category as DeclineCategory)
      ? { type: 'declined', category: data.category as DeclineCategory }
      : undefined;
  }
  return undefined;
}

/**
 * Sends a question to the assistant endpoint and yields host-neutral events. Transport and
 * HTTP failures become an error notice; an abort ends the iteration quietly.
 */
export async function* askAssistant(options: AskAssistantOptions): AsyncGenerator<AssistantEvent, void, undefined> {
  const { endpoint, question, history, surface, signal } = options;
  const errorEvents: AssistantEvent[] = [{ type: 'notice', kind: 'error', message: ASSISTANT_ERROR_MESSAGE }, { type: 'done' }];
  if (signal.aborted) return;

  const transport = new DefaultChatTransport<UIMessage>({
    api: endpoint,
    body: { surface },
    ...(options.headers && { headers: options.headers }),
    ...(options.fetch && { fetch: options.fetch }),
  });
  const messages = [...history.slice(-MAX_HISTORY_TURNS), { role: 'user' as const, text: question }].map(toMessage);

  let stream: ReadableStream<UIMessageChunk>;
  try {
    stream = await transport.sendMessages({
      trigger: 'submit-message', chatId: 'assistant', messageId: undefined, messages, abortSignal: signal,
    });
  } catch {
    if (signal.aborted) return;
    yield* errorEvents;
    return;
  }

  const reader = stream.getReader();
  const onAbort = () => { reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', onAbort, { once: true });
  const redactor = createStreamingRedactor();
  const cleanText = (raw: string): AssistantEvent[] => {
    const delta = sanitizeAssistantText(raw);
    return delta ? [{ type: 'text', delta }] : [];
  };

  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (signal.aborted) return;
      if (done) break;
      if (chunk.type === 'text-delta') {
        yield* cleanText(redactor.push(chunk.delta));
      } else if (chunk.type === 'text-end') {
        yield* cleanText(redactor.flush());
      } else if (chunk.type === 'error') {
        yield* cleanText(redactor.flush());
        yield errorEvents[0];
      } else if (chunk.type.startsWith('data-')) {
        const event = parseAssistantDataPart(chunk.type, (chunk as { data?: unknown }).data);
        if (event) yield event;
      }
    }
    yield* cleanText(redactor.flush());
    yield { type: 'done' };
  } catch {
    if (signal.aborted) return;
    yield* errorEvents;
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.cancel().catch(() => undefined);
  }
}
