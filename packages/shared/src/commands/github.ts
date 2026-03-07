import type { CommandResult, CommandOutput } from '../types';
import { cvData } from '../data';

const GITHUB_USERNAME = cvData.contact.github.replace('https://github.com/', '');

interface GitHubUser {
  public_repos: number;
  followers: number;
  following: number;
  bio: string | null;
  created_at: string;
}

interface GitHubRepo {
  name: string;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  description: string | null;
}

export async function githubCommand(): Promise<CommandResult> {
  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}`),
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=stars`),
    ]);

    if (!userRes.ok || !reposRes.ok) {
      if (userRes.status === 403 || reposRes.status === 403) {
        return {
          output: [
            { type: 'text', content: 'GitHub API rate limit exceeded. Try again later.', style: { color: 'error' } },
          ],
        };
      }
      return {
        output: [
          { type: 'text', content: `Failed to fetch GitHub data (HTTP ${userRes.status}).`, style: { color: 'error' } },
        ],
      };
    }

    const user: GitHubUser = await userRes.json();
    const repos: GitHubRepo[] = await reposRes.json();

    const ownRepos = repos.filter((r) => !r.fork);
    const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);

    // Top languages by repo count
    const langCount: Record<string, number> = {};
    for (const repo of ownRepos) {
      if (repo.language) {
        langCount[repo.language] = (langCount[repo.language] || 0) + 1;
      }
    }
    const topLangs = Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => `${lang} (${count} repos)`);

    // Top repos by stars
    const topRepos = ownRepos
      .filter((r) => r.stargazers_count > 0)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5);

    // Account age
    const createdYear = new Date(user.created_at).getFullYear();
    const accountAge = new Date().getFullYear() - createdYear;

    const output: CommandOutput[] = [
      {
        type: 'section',
        title: `GitHub — @${GITHUB_USERNAME}`,
        children: [
          ...(user.bio ? [{ type: 'text' as const, content: user.bio, style: { dim: true } }] : []),
          { type: 'divider' },
          {
            type: 'table',
            headers: ['Metric', 'Value'],
            rows: [
              ['Public Repos', String(user.public_repos)],
              ['Own Repos (non-fork)', String(ownRepos.length)],
              ['Total Stars', String(totalStars)],
              ['Followers', String(user.followers)],
              ['Following', String(user.following)],
              ['Account Age', `${accountAge} year${accountAge !== 1 ? 's' : ''}`],
            ],
          },
        ],
      },
    ];

    if (topLangs.length > 0) {
      output.push({
        type: 'section',
        title: 'Top Languages',
        children: [{ type: 'list', items: topLangs }],
      });
    }

    if (topRepos.length > 0) {
      output.push({
        type: 'section',
        title: 'Top Repos by Stars',
        children: [
          {
            type: 'table',
            headers: ['Repository', 'Stars', 'Language'],
            rows: topRepos.map((r) => [r.name, String(r.stargazers_count), r.language || '—']),
          },
        ],
      });
    }

    output.push({ type: 'link', text: 'View on GitHub', url: cvData.contact.github });

    return { output };
  } catch {
    return {
      output: [
        { type: 'text', content: 'Failed to connect to GitHub API. Check your network connection.', style: { color: 'error' } },
      ],
    };
  }
}
