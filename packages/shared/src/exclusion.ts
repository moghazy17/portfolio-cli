export const EXCLUDE_TOPIC = 'portfolio-exclude';

export function isExcludedRepo(repo: { fork?: boolean; topics?: string[] }): boolean {
  return Boolean(repo.fork || repo.topics?.some((topic) => topic.toLowerCase() === EXCLUDE_TOPIC));
}
