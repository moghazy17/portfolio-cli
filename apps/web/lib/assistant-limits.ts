import { Ratelimit } from '@upstash/ratelimit';
import type { AssistantEvent } from '@ahmed-moghazy/shared';
import { redis } from './redis';

type Notice = Omit<Extract<AssistantEvent, { type: 'notice' }>, 'type'>;

export type AssistantLimitResult = { ok: true } | { ok: false; notice: Notice };

const VISITOR_LIMIT = 15;
const DEFAULT_DAILY_CAP = 1000;

const visitorLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(VISITOR_LIMIT, '1 h'),
      prefix: 'rl:assistant:visitor',
    })
  : null;

const globalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(Number(process.env.ASSISTANT_DAILY_CAP) || DEFAULT_DAILY_CAP, '1 d'),
      prefix: 'rl:assistant:global',
    })
  : null;

/**
 * Per-visitor and site-wide question limits. Without Redis there are no limits. With Redis
 * configured but failing, the assistant refuses rather than run unmetered.
 */
export async function checkAssistantLimits(ip: string): Promise<AssistantLimitResult> {
  if (!visitorLimiter || !globalLimiter) return { ok: true };

  const unavailable: AssistantLimitResult = {
    ok: false,
    notice: {
      kind: 'unavailable',
      message: 'The assistant is unavailable right now — commands like `projects` still work.',
    },
  };

  try {
    const visitor = await visitorLimiter.limit(ip);
    // On a Redis timeout the library answers success with reason "timeout"; that is not a
    // counted request, so it must not pass.
    if (visitor.reason === 'timeout') return unavailable;
    if (!visitor.success) {
      const retryAfterSec = Math.max(1, Math.ceil((visitor.reset - Date.now()) / 1000));
      const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
      return {
        ok: false,
        notice: {
          kind: 'limited',
          message: `You've reached the question limit — try again in ~${minutes} min. Commands like \`projects\` still work.`,
          retryAfterSec,
        },
      };
    }

    const global = await globalLimiter.limit('global');
    if (global.reason === 'timeout') return unavailable;
    if (!global.success) {
      return {
        ok: false,
        notice: {
          kind: 'daily-cap',
          message: 'The assistant has reached its daily question limit — try again tomorrow. Commands like `projects` still work.',
        },
      };
    }
    return { ok: true };
  } catch (err) {
    console.error('[assistant] limiter unavailable, refusing the question:', err);
    return unavailable;
  }
}
