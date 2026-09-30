import { redactSecrets } from '../assistant/sanitize';
import { compileAliases } from './aliases';
import { isExcludedRepo, MIN_LANGUAGE_SHARE, README_CHARS } from './constants';
import { parseManifest } from './manifests';
import { checkInvariants } from './schema';
import type { EvidenceItem, InventorySnapshot, RepoRecord, TechAliasMap } from './types';

export interface BuildInput {
  owner: string;
  generatedAt: string;
  aliases: TechAliasMap;
  repos: Array<{
    meta: { name: string; description: string | null; topics: string[]; fork: boolean; archived: boolean; pushedAt: string; htmlUrl: string };
    languages: Record<string, number>;
    readme: string | null;
    manifests: Array<{ path: string; content: string; skimmed: boolean }>;
  }>;
}
const kindRank: Record<EvidenceItem['kind'], number> = {
  manifest: 0, build: 1, container: 2, workflow: 3, language: 4,
};
const evidenceSort = (a: EvidenceItem, b: EvidenceItem) =>
  b.lastActivity.localeCompare(a.lastActivity) || a.repo.localeCompare(b.repo);
const objectSorted = <T>(entries: [string, T][]) => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) as Record<string, T>;
// Ids and aliases that are also everyday English or shell words ("let's go", "git clone",
// "next steps") would turn most READMEs into false mentions, so they only count through
// their properly capitalised label.
const COMMON_WORD_TERMS = new Set(['go', 'r', 'c', 'next', 'express', 'spark', 'git', 'rest', 'flask', 'dash', 'make', 'swift', 'bash']);
const mention = (text: string, term: string, caseSensitive: boolean) => {
  if (term.includes('*')) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, caseSensitive ? '' : 'i').test(text);
};
const mentionsTech = (text: string, id: string, label: string, aliases: string[]) =>
  mention(text, label, true)
  || [id, ...aliases].some((term) => term.length >= 3 && !COMMON_WORD_TERMS.has(term.toLowerCase()) && mention(text, term, false));
// Every name a visitor might use for a technology, lowercased, pointing at its id.
const buildAliasIndex = (techs: TechAliasMap) => Object.fromEntries(Object.entries(techs)
  .flatMap(([id, entry]) => [id, entry.label, ...entry.aliases]
    .filter((term) => !term.includes('*'))
    .map((term) => [term.toLowerCase(), id] as [string, string]))
  .sort(([a], [b]) => a.localeCompare(b)));

export function buildInventory(input: BuildInput): InventorySnapshot {
  const aliases = compileAliases(input.aliases);
  const repos: Record<string, RepoRecord> = {};
  const techEvidence = new Map<string, EvidenceItem[]>();
  const packages = new Map<string, EvidenceItem[]>();
  const readmeMentions = new Map<string, { repo: string; lastActivity: string }[]>();
  const languageTotals = new Map<string, { bytes: number; repos: number }>();
  let totalBytes = 0;
  for (const { meta, languages, readme, manifests } of [...input.repos].sort((a, b) => a.meta.name.localeCompare(b.meta.name))) {
    if (isExcludedRepo(meta)) continue;
    const languageBytes = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    totalBytes += languageBytes;
    const includedLanguages = Object.entries(languages).filter(([, bytes]) => languageBytes > 0 && bytes / languageBytes >= MIN_LANGUAGE_SHARE)
      .map(([name, bytes]) => ({ name, share: bytes / languageBytes, bytes })).sort((a, b) => a.name.localeCompare(b.name));
    const candidates = new Map<string, EvidenceItem>();
    const add = (match: string, kind: EvidenceItem['kind'], file: string) => {
      const item = { repo: meta.name, file, lastActivity: meta.pushedAt, kind, match };
      const id = aliases.resolve(match);
      if (id) {
        const prior = candidates.get(id);
        if (!prior || kindRank[kind] < kindRank[prior.kind] || (kind === prior.kind && (file.length < prior.file.length || (file.length === prior.file.length && file < prior.file)))) candidates.set(id, item);
      } else {
        const key = match.toLowerCase();
        packages.set(key, [...(packages.get(key) ?? []), item]);
      }
    };
    for (const manifest of manifests) {
      for (const item of parseManifest(manifest.path, manifest.content)) add(item.match, item.kind, manifest.path);
    }
    for (const language of includedLanguages) {
      add(language.name, 'language', '(language statistics)');
      const old = languageTotals.get(language.name) ?? { bytes: 0, repos: 0 };
      languageTotals.set(language.name, { bytes: old.bytes + language.bytes, repos: old.repos + 1 });
    }
    for (const [id, item] of candidates) techEvidence.set(id, [...(techEvidence.get(id) ?? []), item]);
    const excerpt = readme ? redactSecrets(readme.slice(0, README_CHARS)) : null;
    if (excerpt) for (const [id, entry] of Object.entries(aliases.techs)) {
      if (mentionsTech(excerpt, id, entry.label, entry.aliases)) {
        readmeMentions.set(id, [...(readmeMentions.get(id) ?? []), { repo: meta.name, lastActivity: meta.pushedAt }]);
      }
    }
    repos[meta.name] = {
      name: meta.name, url: meta.htmlUrl, description: meta.description ? redactSecrets(meta.description.slice(0, 300)) : null,
      topics: [...meta.topics].sort(), languages: includedLanguages.map(({ name, share }) => ({ name, share })),
      lastActivity: meta.pushedAt, archived: meta.archived, readmeExcerpt: excerpt,
      techs: [...candidates.keys()].sort(), evidenceFiles: [...new Set(manifests.map(({ path }) => path))].sort(),
      skimmed: manifests.filter(({ skimmed }) => skimmed).map(({ path }) => path).sort(),
    };
  }
  const techs = objectSorted([...techEvidence].map(([id, evidence]) => [id, {
    id, label: aliases.techs[id].label, category: aliases.techs[id].category, evidence: evidence.sort(evidenceSort),
  }]));
  const snapshot: InventorySnapshot = {
    version: 1, generatedAt: input.generatedAt, owner: input.owner,
    repos: objectSorted(Object.entries(repos)), techs,
    packages: objectSorted([...packages].map(([name, evidence]) => [name, evidence.sort(evidenceSort)])),
    aliasIndex: buildAliasIndex(aliases.techs),
    readmeMentions: objectSorted([...readmeMentions].map(([id, entries]) => [id, entries.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || a.repo.localeCompare(b.repo))])),
    stats: { repoCount: Object.keys(repos).length, techCount: Object.keys(techs).length,
      topLanguages: [...languageTotals].map(([name, entry]) => ({ name, bytesShare: totalBytes ? entry.bytes / totalBytes : 0, repos: entry.repos }))
        .sort((a, b) => b.bytesShare - a.bytesShare || a.name.localeCompare(b.name)).slice(0, 10) },
  };
  const errors = checkInvariants(snapshot);
  if (errors.length) throw new Error(errors.join('; '));
  return snapshot;
}
