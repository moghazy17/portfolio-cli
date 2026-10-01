import { fetchGitHubData, type GitHubStats } from '@ahmed-moghazy/shared';
import { redis } from './redis';

const CACHE_KEY = 'gh:stats:v1';
const CACHE_TTL_SECONDS = 10 * 60;

let memo: { value: GitHubStats; expiresAt: number } | null = null;

async function githubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = process.env.GH_INVENTORY_TOKEN;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function getGitHubStatsCached(signal: AbortSignal): Promise<GitHubStats> {
  if (memo && memo.expiresAt > Date.now()) return memo.value;

  if (redis) {
    try {
      const cached = await redis.get<GitHubStats>(CACHE_KEY);
      if (cached) {
        memo = { value: cached, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
        return cached;
      }
    } catch (error) {
      console.error('[github] cache read failed:', error);
    }
  }

  const value = await fetchGitHubData(signal, githubFetch);
  memo = { value, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
  if (redis) {
    try {
      await redis.set(CACHE_KEY, value, { ex: CACHE_TTL_SECONDS });
    } catch (error) {
      console.error('[github] cache write failed:', error);
    }
  }
  return value;
}
