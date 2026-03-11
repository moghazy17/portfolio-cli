import type { CommandResult, CommandOutput } from '../types';
import { cvData } from '../data';
import { fetchGitHubData, GITHUB_USERNAME } from '../github';

export async function githubCommand(): Promise<CommandResult> {
  try {
    const stats = await fetchGitHubData();

    const output: CommandOutput[] = [
      {
        type: 'section',
        title: `GitHub — @${GITHUB_USERNAME}`,
        children: [
          ...(stats.user.bio ? [{ type: 'text' as const, content: stats.user.bio, style: { dim: true } }] : []),
          { type: 'divider' },
          {
            type: 'table',
            headers: ['Metric', 'Value'],
            rows: [
              ['Public Repos', String(stats.user.publicRepos)],
              ['Own Repos (non-fork)', String(stats.ownRepos.length)],
              ['Total Stars', String(stats.totalStars)],
              ['Followers', String(stats.user.followers)],
              ['Following', String(stats.user.following)],
              ['Account Age', `${stats.user.accountAge} year${stats.user.accountAge !== 1 ? 's' : ''}`],
            ],
          },
        ],
      },
    ];

    if (stats.topLanguages.length > 0) {
      output.push({
        type: 'section',
        title: 'Top Languages',
        children: [{ type: 'list', items: stats.topLanguages.map((l) => `${l.language} (${l.count} repos)`) }],
      });
    }

    if (stats.topRepos.length > 0) {
      output.push({
        type: 'section',
        title: 'Top Repos by Stars',
        children: [
          {
            type: 'table',
            headers: ['Repository', 'Stars', 'Language'],
            rows: stats.topRepos.map((r) => [r.name, String(r.stars), r.language || '—']),
          },
        ],
      });
    }

    output.push({ type: 'link', text: 'View on GitHub', url: cvData.contact.github });

    return { output };
  } catch (err) {
    const message = err instanceof Error && err.message.includes('403')
      ? 'GitHub API rate limit exceeded. Try again later.'
      : err instanceof Error && err.message.includes('HTTP')
        ? err.message
        : 'Failed to connect to GitHub API. Check your network connection.';
    return {
      output: [
        { type: 'text', content: message, style: { color: 'error' } },
      ],
    };
  }
}
