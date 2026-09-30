export { loadContent } from './load';
import { loadContent } from './load';
import { validateContent } from './validate';
import type { TechAliasMap } from './schema';

export async function loadTechAliases(rootDir: string): Promise<TechAliasMap> {
  const loaded = await loadContent(rootDir);
  if (!loaded.techAliases || validateContent(loaded).some((issue) => issue.severity === 'error')) throw new Error('Invalid technology aliases');
  return loaded.techAliases;
}
export type { ContentIssue, LoadedContent } from './load';
export { validateContent, formatIssues } from './validate';
export {
  Text,
  Month,
  Slug,
  Url,
  ResumeSchema,
  SiteSchema,
  WriteupFrontMatterSchema,
} from './schema';
export type {
  Content,
  Resume,
  ResumeInput,
  Site,
  SiteInput,
  WriteupFrontMatter,
} from './schema';
