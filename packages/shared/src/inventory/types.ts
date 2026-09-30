export type TechId = string;
export type TechAliasMap = Record<TechId, {
  label: string;
  category: 'language' | 'ai' | 'data' | 'web' | 'infra' | 'tooling' | 'other';
  aliases: string[];
}>;

export interface EvidenceItem {
  repo: string;
  file: string;
  lastActivity: string;
  kind: 'manifest' | 'build' | 'container' | 'workflow' | 'language';
  match: string;
}
export interface ReadmeMention { repo: string; lastActivity: string }
export interface RepoRecord {
  name: string;
  url: string;
  description: string | null;
  topics: string[];
  languages: { name: string; share: number }[];
  lastActivity: string;
  archived: boolean;
  readmeExcerpt: string | null;
  techs: TechId[];
  evidenceFiles: string[];
  skimmed: string[];
}
export interface TechEntry {
  id: TechId;
  label: string;
  category: TechAliasMap[TechId]['category'];
  evidence: EvidenceItem[];
}
export interface InventorySnapshot {
  version: 1;
  generatedAt: string;
  owner: string;
  repos: Record<string, RepoRecord>;
  techs: Record<TechId, TechEntry>;
  packages: Record<string, EvidenceItem[]>;
  readmeMentions: Record<TechId, ReadmeMention[]>;
  aliasIndex?: Record<string, TechId>;        // lowercased id, label and non-glob aliases → id
  stats: {
    repoCount: number;
    techCount: number;
    topLanguages: { name: string; bytesShare: number; repos: number }[];
  };
}
