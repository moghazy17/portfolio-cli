export interface TimedCache<T> {
  get(signal: AbortSignal): Promise<T>;
}

const unavailable = () => new Error('GitHub stats temporarily unavailable');

export function createTimedCache<T>(
  fetchValue: (signal: AbortSignal) => Promise<T>,
  { freshnessMs, cooldownMs, timeoutMs, now = Date.now }: {
    freshnessMs: number;
    cooldownMs: number;
    timeoutMs: number;
    now?: () => number;
  },
): TimedCache<T> {
  let lastGood: { value: T; expiresAt: number } | undefined;
  let retryAt = 0;
  let inFlight: Promise<T> | undefined;

  // The refresh is shared by every waiting caller, so only its own timeout may stop it;
  // a caller that goes away just stops waiting and never starts a cooldown.
  async function refresh(): Promise<T> {
    const controller = new AbortController();
    let rejectStopped: (reason: Error) => void = () => {};
    const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
    const timeout = setTimeout(() => {
      controller.abort();
      rejectStopped(unavailable());
    }, timeoutMs);

    try {
      const value = await Promise.race([fetchValue(controller.signal), stopped]);
      lastGood = { value, expiresAt: now() + freshnessMs };
      retryAt = 0;
      return value;
    } catch {
      retryAt = now() + cooldownMs;
      if (lastGood) return lastGood.value;
      throw unavailable();
    } finally {
      clearTimeout(timeout);
    }
  }

  function waitFor(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(unavailable());
    return new Promise<T>((resolve, reject) => {
      const leave = () => reject(unavailable());
      signal.addEventListener('abort', leave, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', leave));
    });
  }

  return {
    get(signal) {
      if (lastGood && lastGood.expiresAt > now()) return Promise.resolve(lastGood.value);
      if (!inFlight && retryAt > now()) {
        return lastGood ? Promise.resolve(lastGood.value) : Promise.reject(unavailable());
      }
      inFlight ??= refresh().finally(() => { inFlight = undefined; });
      return waitFor(inFlight, signal);
    },
  };
}
