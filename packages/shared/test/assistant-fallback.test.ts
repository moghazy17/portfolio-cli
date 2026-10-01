import { afterEach, describe, expect, it, vi } from 'vitest';
import { APICallError } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { createFallbackModel } from '../src/assistant/server/fallback';

const options = { prompt: [] };
const chunk: LanguageModelV3StreamPart = { type: 'text-delta', id: 'text', delta: 'answer' };
let modelNumber = 0;

function model(doStream?: LanguageModelV3['doStream']) {
  return new MockLanguageModelV3({
    modelId: `model-${modelNumber++}`,
    doStream: doStream ?? (async () => ({
      stream: new ReadableStream({ start(c) { c.enqueue(chunk); c.close(); } }),
      response: { headers: { source: 'mock' } },
    })),
  });
}

function apiError(statusCode: number, code?: string) {
  return new APICallError({
    message: 'Provider rejected request', url: 'https://provider.invalid', requestBodyValues: {},
    statusCode, data: { error: { code } },
  });
}

afterEach(() => vi.useRealTimers());

describe('fallback model', () => {
  it('preserves the primary first chunk and metadata without calling fallback', async () => {
    const primary = model();
    const fallback = model();
    const result = await createFallbackModel({ primary, fallback }).doStream(options);
    expect(result.response?.headers).toEqual({ source: 'mock' });
    const reader = result.stream.getReader();
    expect(await reader.read()).toEqual({ value: chunk, done: false });
    expect((await reader.read()).done).toBe(true);
    expect(fallback.doStreamCalls).toHaveLength(0);
  });

  it.each([
    apiError(408), apiError(429), apiError(503), apiError(400, 'insufficient_quota'),
    apiError(400, 'rate_limit_exceeded'), new TypeError('fetch failed'),
    Object.assign(new Error('socket disconnected'), { code: 'ECONNRESET' }),
  ])('switches on eligible failures: %s', async (error) => {
    const primary = model(async () => { throw error; });
    const fallback = model();
    const onFallback = vi.fn();
    const wrapped = createFallbackModel({ primary, fallback, onFallback });
    const result = await wrapped.doStream(options);
    expect((await result.stream.getReader().read()).value).toEqual(chunk);
    expect(onFallback).toHaveBeenCalledOnce();
    expect(onFallback).toHaveBeenCalledWith(
      APICallError.isInstance(error)
        ? error.data?.error?.code ?? `http_${error.statusCode}`
        : 'network',
    );
    await wrapped.doStream(options);
    expect(primary.doStreamCalls).toHaveLength(1);
    expect(fallback.doStreamCalls).toHaveLength(2);
  });

  it.each([false, true])('times out before the first chunk (pending response: %s)', async (pending) => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    let signal: AbortSignal | undefined;
    const primary = model(async (args) => {
      signal = args.abortSignal;
      if (pending) return new Promise(() => {});
      return { stream: new ReadableStream({ cancel }) };
    });
    const fallback = model();
    const result = createFallbackModel({ primary, fallback }).doStream(options);
    await vi.advanceTimersByTimeAsync(7999);
    expect(fallback.doStreamCalls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(fallback.doStreamCalls).toHaveLength(1);
    expect(signal?.aborted).toBe(true);
    if (!pending) expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('switches when the first read rejects', async () => {
    const primary = model(async () => ({ stream: new ReadableStream({
      start(c) { c.error(apiError(503)); },
    }) }));
    const fallback = model();
    await createFallbackModel({ primary, fallback }).doStream(options);
    expect(fallback.doStreamCalls).toHaveLength(1);
  });

  it('switches on an eligible error part before output', async () => {
    const primary = model(async () => ({ stream: new ReadableStream({
      start(c) { c.enqueue({ type: 'error', error: apiError(429) }); c.close(); },
    }) }));
    const fallback = model();
    await createFallbackModel({ primary, fallback }).doStream(options);
    expect(fallback.doStreamCalls).toHaveLength(1);
  });

  it('switches on an error that follows only metadata parts', async () => {
    const primary = model(async () => ({ stream: new ReadableStream({
      start(c) {
        c.enqueue({ type: 'stream-start', warnings: [] });
        c.enqueue({ type: 'response-metadata', id: 'r1' });
        c.enqueue({ type: 'error', error: apiError(429) });
        c.close();
      },
    }) }));
    const fallback = model();
    await createFallbackModel({ primary, fallback }).doStream(options);
    expect(fallback.doStreamCalls).toHaveLength(1);
  });

  it('replays held metadata parts before the first content part', async () => {
    const start: LanguageModelV3StreamPart = { type: 'stream-start', warnings: [] };
    const primary = model(async () => ({ stream: new ReadableStream({
      start(c) { c.enqueue(start); c.enqueue(chunk); c.close(); },
    }) }));
    const reader = (await createFallbackModel({ primary, fallback: model() }).doStream(options)).stream.getReader();
    expect((await reader.read()).value).toEqual(start);
    expect((await reader.read()).value).toEqual(chunk);
    expect((await reader.read()).done).toBe(true);
  });

  it('does not leave an unhandled rejection when the timed-out primary settles later', async () => {
    vi.useFakeTimers();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    let rejectLate: (error: unknown) => void = () => {};
    const primary = model(() => new Promise((_, reject) => { rejectLate = reject; }));
    const result = createFallbackModel({ primary, fallback: model() }).doStream(options);
    await vi.advanceTimersByTimeAsync(8000);
    await result;
    rejectLate(apiError(503));
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('propagates a failure after the first chunk without switching', async () => {
    let controller: ReadableStreamDefaultController<LanguageModelV3StreamPart>;
    const error = apiError(503);
    const primary = model(async () => ({ stream: new ReadableStream({
      start(c) { controller = c; c.enqueue(chunk); },
    }) }));
    const fallback = model();
    const result = await createFallbackModel({ primary, fallback }).doStream(options);
    const reader = result.stream.getReader();
    expect((await reader.read()).value).toEqual(chunk);
    controller!.error(error);
    await expect(reader.read()).rejects.toBe(error);
    expect(fallback.doStreamCalls).toHaveLength(0);
  });

  it('shares the breaker across wrappers and retries primary after 60 seconds', async () => {
    vi.useFakeTimers();
    const primary = model(async () => { throw apiError(503); });
    const fallback = model();
    const onFallback = vi.fn();
    await createFallbackModel({ primary, fallback }).doStream(options);
    await vi.advanceTimersByTimeAsync(59999);
    await createFallbackModel({ primary, fallback, onFallback }).doStream(options);
    expect(primary.doStreamCalls).toHaveLength(1);
    expect(onFallback).toHaveBeenCalledWith('circuit_breaker');
    await vi.advanceTimersByTimeAsync(1);
    await createFallbackModel({ primary, fallback }).doStream(options);
    expect(primary.doStreamCalls).toHaveLength(2);
  });

  it.each([apiError(401), apiError(404), new Error('Invalid input')])('does not retry unrelated failures: %s', async (error) => {
    const primary = model(async () => { throw error; });
    const fallback = model();
    await expect(createFallbackModel({ primary, fallback }).doStream(options)).rejects.toBe(error);
    expect(fallback.doStreamCalls).toHaveLength(0);
  });

  it('passes through unchanged without a fallback', async () => {
    const primary = model();
    expect(createFallbackModel({ primary })).toBe(primary);
  });

  it('propagates fallback failures', async () => {
    const error = apiError(503);
    const primary = model(async () => { throw apiError(429); });
    const fallback = model(async () => { throw error; });
    await expect(createFallbackModel({ primary, fallback }).doStream(options)).rejects.toBe(error);
  });

  it('does not switch when the caller aborts before the first chunk', async () => {
    const primary = model(async () => ({ stream: new ReadableStream() }));
    const fallback = model();
    const controller = new AbortController();
    const result = createFallbackModel({ primary, fallback }).doStream({ ...options, abortSignal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(fallback.doStreamCalls).toHaveLength(0);
  });

  it('delegates generation and stays on fallback after a generation failure', async () => {
    const primary = model();
    const fallback = model();
    const generated = {
      content: [{ type: 'text' as const, text: 'answer' }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
      warnings: [],
    };
    primary.doGenerate = vi.fn().mockRejectedValue(apiError(429));
    fallback.doGenerate = vi.fn().mockResolvedValue(generated);
    const wrapped = createFallbackModel({ primary, fallback });
    expect(await wrapped.doGenerate(options)).toBe(generated);
    await wrapped.doStream(options);
    expect(primary.doStreamCalls).toHaveLength(0);
    expect(fallback.doStreamCalls).toHaveLength(1);
  });
});
