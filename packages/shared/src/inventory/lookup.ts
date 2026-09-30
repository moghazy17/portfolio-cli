import { osaDistance } from '../shell/suggest';
import { STALE_AFTER_MS } from './constants';
import type { EvidenceItem, InventorySnapshot } from './types';

export interface LookupResult {
  query: string;
  matchedTech: { id: string; label: string } | null;
  matchedVia: 'id' | 'alias' | 'package' | 'fuzzy' | null;
  evidence: Pick<EvidenceItem, 'repo' | 'file' | 'lastActivity' | 'kind'>[];
  totalRepos: number;
  readmeOnly: { repo: string; lastActivity: string }[];
  inventoryGeneratedAt: string;
  stale: boolean;
  matchedTechs?: { id: string; label: string; evidence: Pick<EvidenceItem, 'repo' | 'file' | 'lastActivity' | 'kind'>[] }[];
}

export function lookupTech(snapshot: InventorySnapshot, query: string, now = new Date()): LookupResult {
  const q = query.trim().toLowerCase();
  const techs = Object.values(snapshot.techs);
  let via: LookupResult['matchedVia'] = null;
  let matches = techs.filter((tech) => tech.id.toLowerCase() === q);
  if (matches.length) via = 'id';
  if (!matches.length) { matches = techs.filter((tech) => tech.label.toLowerCase() === q); if (matches.length) via = 'alias'; }
  if (!matches.length) {
    // A package name the owner actually depends on, e.g. "kafka-python" → Kafka.
    matches = techs.filter((tech) => tech.evidence.some((item) => item.match.toLowerCase() === q));
    if (matches.length) via = 'alias';
  }
  const words = q.split(/\s+/).filter(Boolean);
  if (!matches.length && words.length > 1) {
    // Category phrases such as "vector database": every word must be a whole word of the
    // technology's id or label, never a fragment of some package name.
    matches = techs.filter((tech) => {
      const vocabulary = new Set(`${tech.id} ${tech.label}`.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean));
      return words.every((word) => vocabulary.has(word));
    });
    if (matches.length) via = 'alias';
  }
  let packageEvidence: EvidenceItem[] = [];
  if (!matches.length && snapshot.packages[q]) { packageEvidence = snapshot.packages[q]; via = 'package'; }
  if (!matches.length && !packageEvidence.length && q.length >= 5) {
    matches = techs.filter((tech) => osaDistance(q, tech.id) <= 1 || osaDistance(q, tech.label) <= 1).slice(0, 3);
    if (matches.length) via = 'fuzzy';
  }
  const evidence = (matches.length ? matches.flatMap((tech) => tech.evidence) : packageEvidence)
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || a.repo.localeCompare(b.repo));
  const readmeOnly = evidence.length ? [] : (snapshot.readmeMentions[q] ?? matches.flatMap((tech) => snapshot.readmeMentions[tech.id] ?? []))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)).slice(0, 3);
  const slim = (item: EvidenceItem) => ({ repo: item.repo, file: item.file, lastActivity: item.lastActivity, kind: item.kind });
  return {
    query, matchedTech: matches[0] ? { id: matches[0].id, label: matches[0].label } : null, matchedVia: via,
    evidence: evidence.slice(0, 3).map(slim), totalRepos: new Set(evidence.map((item) => item.repo)).size,
    readmeOnly, inventoryGeneratedAt: snapshot.generatedAt,
    stale: now.getTime() - new Date(snapshot.generatedAt).getTime() > STALE_AFTER_MS,
    ...(matches.length > 1 ? { matchedTechs: matches.slice(0, 3).map((tech) => ({ id: tech.id, label: tech.label, evidence: tech.evidence.slice(0, 3).map(slim) })) } : {}),
  };
}

export function listRepos(snapshot: InventorySnapshot, filters: {
  tech?: string; topic?: string; activeWithinDays?: number; limit?: number; now?: Date;
} = {}) {
  const now = filters.now ?? new Date();
  const all = Object.values(snapshot.repos).filter((repo) =>
    (!filters.tech || repo.techs.includes(filters.tech.toLowerCase()))
    && (!filters.topic || repo.topics.includes(filters.topic.toLowerCase()))
    && (!filters.activeWithinDays || now.getTime() - new Date(repo.lastActivity).getTime() <= filters.activeWithinDays * 86400000))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || a.name.localeCompare(b.name));
  return { repos: all.slice(0, Math.min(10, Math.max(1, filters.limit ?? 5))).map((repo) => ({
    name: repo.name, url: repo.url, lastActivity: repo.lastActivity, archived: repo.archived,
    languages: repo.languages.map((language) => language.name), techs: repo.techs,
    untrusted_text: repo.description ?? '',
  })), total: all.length };
}
