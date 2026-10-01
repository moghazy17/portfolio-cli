import { Octokit } from 'octokit';
import { MAX_MANIFESTS_PER_REPO, SKIM_BYTES, SKIM_THRESHOLD, SKIP_DIRS } from './constants';

export function createGitHub(token: string) {
  // Wait out GitHub's primary and secondary rate limits twice, then fail the run.
  const retryTwice = (_retryAfter: number, _options: object, _octokit: unknown, retryCount: number) => retryCount < 2;
  return new Octokit({
    auth: token,
    retry: { enabled: true, retries: 2 },
    throttle: { enabled: true, onRateLimit: retryTwice, onSecondaryRateLimit: retryTwice },
  });
}
export type GitHubClient = ReturnType<typeof createGitHub>;

export async function listPublicRepos(github: GitHubClient, owner: string) {
  const repos = await github.paginate('GET /users/{username}/repos', { username: owner, per_page: 100, type: 'owner' });
  return repos.filter((repo) => !repo.private).map((repo) => ({
    name: repo.name, description: repo.description, topics: repo.topics ?? [], fork: repo.fork,
    archived: repo.archived, pushedAt: repo.pushed_at ?? repo.updated_at ?? new Date(0).toISOString(), htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
  }));
}
export async function getLanguages(github: GitHubClient, owner: string, repo: string) {
  const { data } = await github.request('GET /repos/{owner}/{repo}/languages', { owner, repo });
  return data;
}
export async function getReadme(github: GitHubClient, owner: string, repo: string): Promise<string | null> {
  try {
    const { data } = await github.request('GET /repos/{owner}/{repo}/readme', { owner, repo, mediaType: { format: 'raw' } });
    return typeof data === 'string' ? data : Buffer.from(data.content ?? '', 'base64').toString('utf8');
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}
export async function getTree(github: GitHubClient, owner: string, repo: string, branch: string) {
  let data;
  try {
    ({ data } = await github.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: branch, recursive: '1' }));
  } catch (error) {
    if ((error as { status?: number }).status === 409) return [];
    throw error;
  }
  if (!data.truncated) return data.tree.filter((item) => item.type === 'blob').map((item) => item.path!).filter(Boolean);
  const root = await github.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: branch });
  return root.data.tree.filter((item) => item.type === 'blob').map((item) => item.path!).filter(Boolean);
}
export function selectManifests(paths: string[]) {
  const matches = paths.filter((path) => {
    const parts = path.split('/');
    if (parts.some((part) => SKIP_DIRS.includes(part))) return false;
    if (parts.length > 4 && !path.startsWith('.github/workflows/')) return false;
    const name = parts.at(-1) ?? '';
    return /^(package\.json|requirements.*\.txt|pyproject\.toml|Pipfile|environment\.ya?ml|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(?:\.kts)?|Dockerfile|.*\.Dockerfile|(?:docker-compose.*|compose)\.ya?ml)$/i.test(name)
      || /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path);
  });
  return matches.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)).slice(0, MAX_MANIFESTS_PER_REPO);
}
export async function getFileContent(github: GitHubClient, owner: string, repo: string, path: string): Promise<{ content: string; skimmed: boolean }> {
  const { data } = await github.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path });
  if (Array.isArray(data) || data.type !== 'file') return { content: '', skimmed: false };
  const raw = Buffer.from(data.content ?? '', 'base64');
  const skimmed = raw.length > SKIM_THRESHOLD;
  return { content: raw.subarray(0, skimmed ? SKIM_BYTES : undefined).toString('utf8'), skimmed };
}
