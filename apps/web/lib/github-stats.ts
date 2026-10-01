import { createTimedCache, fetchGitHubData, type GitHubStats } from '@ahmed-moghazy/shared';
import { redis } from './redis';

const CACHE_KEY = 'gh:stats:v1';
const CACHE_TTL_SECONDS = 10 * 60;

async function githubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = process.env.GH_INVENTORY_TOKEN;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

const cache = createTimedCache<GitHubStats>(async (signal) => {
  if (redis) {
    try {
      const cached = await redis.get<GitHubStats>(CACHE_KEY);
      if (cached) return cached;
    } catch (error) {
      console.error('[github] cache read failed:', error);
    }
  }

  if (signal.aborted) throw new Error('GitHub stats temporarily unavailable');
  const value = await fetchGitHubData(signal, githubFetch);
  if (redis) {
    void redis.set(CACHE_KEY, value, { ex: CACHE_TTL_SECONDS }).catch((error) => {
      console.error('[github] cache write failed:', error);
    });
  }
  return value;
}, {
  freshnessMs: CACHE_TTL_SECONDS * 1000,
  cooldownMs: 60_000,
  timeoutMs: 5_000,
});

export function getGitHubStatsCached(signal: AbortSignal): Promise<GitHubStats> {
  return cache.get(signal);
}
