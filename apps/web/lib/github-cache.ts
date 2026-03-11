import { Redis } from '@upstash/redis';
import { fetchGitHubData } from '@ahmed-moghazy/shared';

const redis = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : null;

const CACHE_KEY = 'github:profile';
const CACHE_TTL = 86400; // 24 hours

export async function getGitHubData(): Promise<string | null> {
  try {
    const cached = redis ? await redis.get<string>(CACHE_KEY) : null;
    if (cached) return cached;

    const stats = await fetchGitHubData();

    const topLangs = stats.topLanguages
      .map((l) => `${l.language} (${l.count} repos)`)
      .join(', ');

    const topRepos = stats.topRepos
      .map((r) => `${r.name} (${r.stars} stars)`)
      .join(', ');

    const data = [
      `Public repos: ${stats.user.publicRepos}`,
      `Followers: ${stats.user.followers}`,
      `Total stars: ${stats.totalStars}`,
      `Account created: ${new Date().getFullYear() - stats.user.accountAge}`,
      `Top languages: ${topLangs}`,
      `Top repos: ${topRepos}`,
    ].join('\n');

    if (redis) await redis.set(CACHE_KEY, data, { ex: CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}
