import { APICallError } from 'ai';
import type { LanguageModelV3, LanguageModelV3CallOptions, LanguageModelV3StreamPart } from '@ai-sdk/provider';

export interface FallbackModelOptions {
  primary: LanguageModelV3;
  fallback?: LanguageModelV3;
  firstChunkTimeoutMs?: number;
  breakerMs?: number;
  onFallback?: (reason: string) => void | Promise<void>;
}

const breakers = new Map<string, number>();

function fallbackReason(error: unknown): string | undefined {
  if (APICallError.isInstance(error)) {
    const data = error.data as { code?: unknown; error?: { code?: unknown } } | undefined;
    const code = data?.error?.code ?? data?.code;
    if (code === 'insufficient_quota' || code === 'rate_limit_exceeded') return code;
    const status = error.statusCode;
    if (status === 408 || status === 429 || (status !== undefined && status >= 500 && status <= 599)) return `http_${status}`;
    if (status === undefined && error.cause) return fallbackReason(error.cause);
    return undefined;
  }
  if (error instanceof Error) {
    const code = 'code' in error ? error.code : undefined;
    if (code === 'insufficient_quota' || code === 'rate_limit_exceeded') return code;
    if (typeof code === 'string' && /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|UND_ERR_.*)$/.test(code)) return 'network';
    if (/fetch failed|failed to fetch|network|socket hang up|connection reset/i.test(error.message)) return 'network';
    if (error.cause) return fallbackReason(error.cause);
  }
  return undefined;
}

export function createFallbackModel({
  primary, fallback, firstChunkTimeoutMs = 8000, breakerMs = 60000, onFallback,
}: FallbackModelOptions): LanguageModelV3 {
  if (!fallback) return primary;
  const backup = fallback;
  const key = `${primary.provider}:${primary.modelId}`;
  let switched = false;

  function switchToFallback(reason: string, failed = true): void {
    switched = true;
    if (failed) breakers.set(key, Date.now() + breakerMs);
    try {
      void Promise.resolve(onFallback?.(reason)).catch(() => {});
    } catch { /* Logging must not interrupt a response. */ }
  }

  function current(): LanguageModelV3 {
    if (!switched) {
      const until = breakers.get(key);
      if (until !== undefined && until > Date.now()) switchToFallback('circuit_breaker', false);
      else if (until !== undefined) breakers.delete(key);
    }
    return switched ? backup : primary;
  }

  return {
    specificationVersion: 'v3',
    get provider() { return current().provider; },
    get modelId() { return current().modelId; },
    get supportedUrls() { return current().supportedUrls; },
    async doGenerate(options) {
      const selected = current();
      try {
        return await selected.doGenerate(options);
      } catch (error) {
        const reason = fallbackReason(error);
        if (selected === backup || options.abortSignal?.aborted || !reason) throw error;
        switchToFallback(reason);
        return backup.doGenerate(options);
      }
    },
    async doStream(options: LanguageModelV3CallOptions) {
      if (current() === backup) return backup.doStream(options);
      const controller = new AbortController();
      let reader: ReadableStreamDefaultReader<LanguageModelV3StreamPart> | undefined;
      let abandoned = false;
      let waitingForFirstChunk = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Error('First chunk timed out');
      let rejectAbort: (reason: unknown) => void = () => {};
      const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
      const abort = () => {
        controller.abort(options.abortSignal?.reason);
        if (waitingForFirstChunk) rejectAbort(options.abortSignal?.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      options.abortSignal?.addEventListener('abort', abort, { once: true });
      if (options.abortSignal?.aborted) abort();
      const cleanup = () => options.abortSignal?.removeEventListener('abort', abort);
      try {
        const first = (async () => {
          const result = await primary.doStream({ ...options, abortSignal: controller.signal });
          if (abandoned) {
            void result.stream.cancel().catch(() => {});
            throw timeout;
          }
          reader = result.stream.getReader();
          // Metadata parts arrive with the response headers, before any output, so the
          // decision waits for the first part that carries content.
          const held: LanguageModelV3StreamPart[] = [];
          for (;;) {
            const next = await reader.read();
            if (next.done) return { result, held, chunk: next };
            if (next.value.type === 'error') throw next.value.error;
            if (next.value.type === 'stream-start' || next.value.type === 'response-metadata') held.push(next.value);
            else return { result, held, chunk: next };
          }
        })();
        // The losing branch of the race still settles later; keep that from surfacing
        // as an unhandled rejection.
        first.catch(() => {});
        const { result, held, chunk } = await Promise.race([
          first, aborted,
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timeout), firstChunkTimeoutMs); }),
        ]);
        waitingForFirstChunk = false;
        clearTimeout(timer);
        const source = reader!;
        return {
          ...result,
          stream: new ReadableStream<LanguageModelV3StreamPart>({
            start(c) {
              for (const part of held) c.enqueue(part);
              if (chunk.done) { c.close(); cleanup(); source.releaseLock(); }
              else c.enqueue(chunk.value);
            },
            async pull(c) {
              try {
                const next = await source.read();
                if (next.done) { c.close(); cleanup(); source.releaseLock(); }
                else c.enqueue(next.value);
              } catch (error) { c.error(error); cleanup(); source.releaseLock(); }
            },
            async cancel(reason) {
              cleanup();
              controller.abort(reason);
              try { await source.cancel(reason); } finally { source.releaseLock(); }
            },
          }),
        };
      } catch (error) {
        waitingForFirstChunk = false;
        abandoned = true;
        clearTimeout(timer);
        cleanup();
        controller.abort();
        if (reader) void reader.cancel().catch(() => {}).finally(() => reader?.releaseLock());
        const reason = error === timeout ? 'first_chunk_timeout' : fallbackReason(error);
        if (options.abortSignal?.aborted || !reason) throw error;
        switchToFallback(reason);
        return backup.doStream(options);
      }
    },
  };
}
