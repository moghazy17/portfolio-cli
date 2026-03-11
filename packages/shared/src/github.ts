import { cvData } from './data';

export const GITHUB_USERNAME = cvData.contact.github.replace('https://github.com/', '');
export const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubUser {
  public_repos: number;
  followers: number;
  following: number;
  bio: string | null;
  created_at: string;
}

export interface GitHubRepo {
  name: string;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  description: string | null;
}

export interface GitHubStats {
  user: {
    publicRepos: number;
    followers: number;
    following: number;
    bio: string | null;
    accountAge: number;
  };
  ownRepos: { name: string; stars: number; language: string | null }[];
  totalStars: number;
  topLanguages: { language: string; count: number }[];
  topRepos: { name: string; stars: number; language: string | null }[];
}

export async function fetchGitHubData(): Promise<GitHubStats> {
  const [userRes, reposRes] = await Promise.all([
    fetch(`${GITHUB_API_BASE}/users/${GITHUB_USERNAME}`, {
      headers: { 'User-Agent': 'portfolio-cli' },
    }),
    fetch(`${GITHUB_API_BASE}/users/${GITHUB_USERNAME}/repos?per_page=100&sort=stars`, {
      headers: { 'User-Agent': 'portfolio-cli' },
    }),
  ]);

  if (!userRes.ok || !reposRes.ok) {
    const status = !userRes.ok ? userRes.status : reposRes.status;
    throw new Error(`GitHub API error (HTTP ${status})`);
  }

  const user: GitHubUser = await userRes.json();
  const repos: GitHubRepo[] = await reposRes.json();

  const ownRepos = repos.filter((r) => !r.fork);
  const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);

  const langCount: Record<string, number> = {};
  for (const repo of ownRepos) {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1;
    }
  }
  const topLanguages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([language, count]) => ({ language, count }));

  const topRepos = ownRepos
    .filter((r) => r.stargazers_count > 0)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((r) => ({ name: r.name, stars: r.stargazers_count, language: r.language }));

  const accountAge = new Date().getFullYear() - new Date(user.created_at).getFullYear();

  return {
    user: {
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      bio: user.bio,
      accountAge,
    },
    ownRepos: ownRepos.map((r) => ({ name: r.name, stars: r.stargazers_count, language: r.language })),
    totalStars,
    topLanguages,
    topRepos,
  };
}
