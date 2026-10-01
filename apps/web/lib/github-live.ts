import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { GITHUB_USERNAME, isExcludedRepo, redactSecrets } from '@ahmed-moghazy/shared';
import type { CodeHit, LiveRepo, LiveRepoDetail, RecentActivity } from '@ahmed-moghazy/shared/assistant-server';
import { redis } from './redis';

const API_BASE = 'https://api.github.com';
const OWNER = GITHUB_USERNAME;

const REPOS_TTL_SEC = 10 * 60;
const ACTIVITY_TTL_SEC = 60 * 60;
const DAY_SEC = 24 * 60 * 60;
const ACTIVITY_WINDOW_MS = 30 * DAY_SEC * 1000;
const MAX_REPO_PAGES = 5;
const MAX_EVENT_PAGES = 3;
const MAX_ACTIVITY = 10;
const MAX_HITS = 10;
const MAX_README_CHARS = 3000;
const MAX_FRAGMENT_CHARS = 160;
const SEARCH_TERMS = /^[\w .+#-]{1,64}$/;

type ActivityKind = RecentActivity['kinds'][number];

interface RepoPayload {
  name: string;
  fork: boolean;
  topics?: string[];
  pushed_at: string | null;
  archived: boolean;
  html_url: string;
  description: string | null;
}

interface EventPayload {
  type: string;
  repo: { name: string };
  created_at: string;
  payload?: { ref_type?: string };
}

const searchLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, '1 m'), prefix: 'rl:assistant:search' })
  : null;

async function github(path: string, accept = 'application/vnd.github+json'): Promise<Response> {
  const token = process.env.GH_INVENTORY_TOKEN;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'portfolio-cli',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    cache: 'no-store',
  });
  if (!response.ok && response.status !== 404) throw new Error(`GitHub API error (HTTP ${response.status})`);
  return response;
}

async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  if (!redis) return load();
  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // a cache read failure falls through to a live read
  }
  const value = await load();
  try {
    await redis.set(key, value, { ex: ttlSec });
  } catch {
    // an unwritable cache only costs the next request a live read
  }
  return value;
}

async function loadRepos(): Promise<LiveRepo[]> {
  const repos: LiveRepo[] = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page += 1) {
    const response = await github(`/users/${OWNER}/repos?type=owner&per_page=100&page=${page}`);
    if (!response.ok) throw new Error('GitHub API error (HTTP 404)');
    const batch: RepoPayload[] = await response.json();
    repos.push(...batch.map((repo) => ({
      name: repo.name,
      fork: repo.fork,
      topics: repo.topics ?? [],
      pushedAt: repo.pushed_at ?? '',
      archived: repo.archived,
      url: repo.html_url,
      description: repo.description,
    })));
    if (batch.length < 100) break;
  }
  return repos;
}

function currentRepos(): Promise<LiveRepo[]> {
  return cached('gh:repos:v1', REPOS_TTL_SEC, loadRepos);
}

function eventKind(event: EventPayload): ActivityKind | null {
  if (event.type === 'PushEvent') return 'push';
  if (event.type === 'CreateEvent') return event.payload?.ref_type === 'repository' ? 'created' : null;
  if (event.type === 'ReleaseEvent') return 'release';
  if (event.type === 'PublicEvent') return 'public';
  return null;
}

async function loadActivity(): Promise<RecentActivity[]> {
  const cutoff = Date.now() - ACTIVITY_WINDOW_MS;
  const activity = new Map<string, RecentActivity>();
  for (const repo of await currentRepos()) {
    if (isExcludedRepo(repo) || Date.parse(repo.pushedAt) < cutoff) continue;
    activity.set(repo.name, { repo: repo.name, lastActivity: repo.pushedAt, pushes: 0, kinds: [] });
  }

  for (let page = 1; page <= MAX_EVENT_PAGES && activity.size > 0; page += 1) {
    const response = await github(`/users/${OWNER}/events/public?per_page=100&page=${page}`);
    if (!response.ok) break;
    const events: EventPayload[] = await response.json();
    for (const event of events) {
      const entry = activity.get(event.repo.name.split('/').pop() ?? '');
      const kind = eventKind(event);
      if (!entry || !kind || Date.parse(event.created_at) < cutoff) continue;
      if (kind === 'push') entry.pushes += 1;
      if (!entry.kinds.includes(kind)) entry.kinds.push(kind);
    }
    if (events.length < 100) break;
  }

  return [...activity.values()]
    .sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity))
    .slice(0, MAX_ACTIVITY);
}

async function loadReadme(name: string): Promise<{ text: string | null }> {
  const response = await github(`/repos/${OWNER}/${name}/readme`, 'application/vnd.github.raw+json');
  if (!response.ok) return { text: null };
  return { text: redactSecrets(await response.text()).slice(0, MAX_README_CHARS) };
}

async function loadRepo(name: string): Promise<LiveRepoDetail | null> {
  const listed = (await currentRepos()).find((repo) => repo.name.toLowerCase() === name.toLowerCase());
  if (!listed || isExcludedRepo(listed)) return null;

  const [languagesRes, readme] = await Promise.all([
    github(`/repos/${OWNER}/${listed.name}/languages`),
    cached(`gh:readme:v1:${listed.name}`, DAY_SEC, () => loadReadme(listed.name)),
  ]);
  const languages: Record<string, number> = languagesRes.ok ? await languagesRes.json() : {};
  return {
    ...listed,
    url: listed.url ?? `https://github.com/${OWNER}/${listed.name}`,
    description: listed.description ?? null,
    languages: Object.keys(languages),
    readmeExcerpt: readme.text,
  };
}

async function loadSearch(terms: string): Promise<CodeHit[]> {
  const query = encodeURIComponent(`${terms} user:${OWNER}`);
  const response = await github(`/search/code?q=${query}&per_page=30`, 'application/vnd.github.text-match+json');
  if (!response.ok) throw new Error('GitHub API error (HTTP 404)');
  const body: {
    items?: Array<{ path: string; repository: { name: string }; text_matches?: Array<{ fragment?: string }> }>;
  } = await response.json();
  const included = new Set((await currentRepos()).filter((repo) => !isExcludedRepo(repo)).map((repo) => repo.name));
  return (body.items ?? [])
    .filter((item) => included.has(item.repository.name))
    .slice(0, MAX_HITS)
    .map((item) => ({
      repo: item.repository.name,
      path: item.path,
      fragment: redactSecrets((item.text_matches?.[0]?.fragment ?? '').replace(/\s+/g, ' ').trim()).slice(0, MAX_FRAGMENT_CHARS),
    }));
}

async function searchCode(terms: string): Promise<CodeHit[] | { rateLimited: true }> {
  const trimmed = terms.trim();
  if (!SEARCH_TERMS.test(trimmed)) return [];
  const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
  const key = `gh:search:v1:${createHash('sha1').update(normalized).digest('hex')}`;

  if (redis) {
    try {
      const hit = await redis.get<CodeHit[]>(key);
      if (hit) return hit;
    } catch {
      // fall through to a live search
    }
  }
  if (searchLimiter) {
    const { success } = await searchLimiter.limit('global');
    if (!success) return { rateLimited: true };
  }
  // The cache was already checked above, so load and store directly.
  const hits = await loadSearch(normalized);
  if (redis) {
    try { await redis.set(key, hits, { ex: DAY_SEC }); } catch { /* the next search just runs live */ }
  }
  return hits;
}

export function createLiveGitHub() {
  return {
    currentRepos,
    recentActivity: (): Promise<RecentActivity[]> => cached('gh:activity:v1', ACTIVITY_TTL_SEC, loadActivity),
    repo: loadRepo,
    searchCode,
  };
}
