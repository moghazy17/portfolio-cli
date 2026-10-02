import type { SkillCategory, SkillEvidence, SkillEvidenceDetails } from '../types';
import { lookupTechWithRepos } from './lookup';
import type { InventorySnapshot } from './types';

export function skillEvidenceWithRepos(snapshot: InventorySnapshot, skills: SkillCategory[]): SkillEvidenceDetails {
  const evidence: SkillEvidence = {};
  const repos: Record<string, string[]> = {};
  for (const category of skills) for (const label of category.skills) {
    const base = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const acronym = label.match(/\(([A-Z]{2,6})\)\s*$/)?.[1];
    const parts = base.includes('/') ? base.split('/').map((part) => part.trim()).filter(Boolean) : [];
    const matches = [base, ...parts, ...(acronym ? [acronym] : [])].map((name) => lookupTechWithRepos(snapshot, name));
    const best = matches.reduce((winner, match) => match.totalRepos > winner.totalRepos ? match : winner);
    evidence[label] = best.totalRepos;
    repos[label] = best.repos;
  }
  return { evidence, repos };
}

export function skillEvidence(snapshot: InventorySnapshot, skills: SkillCategory[]): SkillEvidence {
  return skillEvidenceWithRepos(snapshot, skills).evidence;
}
